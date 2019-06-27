<template>
  <div v-if="field" ref="dropdownMenu" v-bind:class="getFieldWrapperClass()">
    <label-widget
      v-bind:field="field"
      v-bind:fieldId="getFieldId()"></label-widget>

    <div>
      <span
        ref="algoliaWrapper"
        class="mutt-input-wrapper-algolia">
        <readonly-widget
          v-if="isReadOnly"
          v-bind:value="stringFormat(field.options.algolia.format, field.value)"
          ></readonly-widget>

        <input
          autocomplete="off"
          autocorrect="off"
          type="text"
          class="mutt-field mutt-field-text mutt-field-text--large mutt-field-algolia"
          name="searchTerm"
          v-bind:placeholder="placeholderStr"
          v-if="!isReadOnly"
          ref="inputField"
          v-on:blur="checkCallback"
          v-on:keydown.down="next"
          v-on:keydown.up="prev"
          v-on:keyup="search"
          v-on:keydown.enter.prevent="select" />
      </span>

      <p v-if="displayInitialValue && !isReadOnly">
        {{ displayValue }}
      </p>
    </div>

    <div
      v-if="loading"
      class="loading"
      :style="algoliaInputWidth">
      <p v-if="loadingMessage">{{ loadingMessage }}</p>
      <p v-else>{{ $t('Loading...') }}</p>
    </div>

    <div
      v-if="!lock && results && results.hits.length > 0"
      class="mutt-dropdown-autocomplete"
      :style="algoliaInputWidth">
      <ul ref="list" class="mutt-dropdown-autocomplete__list">
        <li class="mutt-dropdown-autocomplete__listitem"
          ref="items"
          v-on:click="select(index)"
          v-for="(result, index) in results.hits">
          {{ stringFormat(field.options.algolia.format, result) }}
        </li>
      </ul>
    </div>

    <div
      v-else-if="!loading && hasPlaceholder && results && results.hits.length === 0"
      class="mutt-dropdown-autocomplete--error"
      :style="algoliaInputWidth">
      <ul ref="list" class="mutt-dropdown-autocomplete__list--error">
        <li class="mutt-dropdown-autocomplete__listitem--error bold">
          {{ $t(`We can't find`) }} '{{ displayValue }}'.<br>
          <span v-if="zeroResultsMessage">{{ zeroResultsMessage }}</span>
          <span v-else>
            {{ $t('Sorry to ask, but have you checked the spelling?') }}
          </span>
        </li>
      </ul>
    </div>

    <help-widget
      v-bind:field="field"></help-widget>

    <error-widget
      v-if="!isReadOnly"
      v-for="objField in field.object"
      v-bind:key="`autocomplete-error-${objField.id}`"
      v-bind:field="objField"
      v-bind:errors="objField.errors"
      v-bind:errorClass="getErrorClass()"></error-widget>
  </div>
</template>

<script>
import MuttVue from '@mutt/widgets-vue'
import Algoliasearch from 'algoliasearch'
import stringFormat from 'string-format'

export default {
  name: 'mutt-algolia',
  mixins: [
    MuttVue.mixin,
  ],
  props: {
    loadingMessage: {
      type: String,
      required: false,
      default: null,
    },
    zeroResultsMessage: {
      type: String,
      required: false,
      default: null,
    },
  },
  data() {
    return {
      errors: null,
      loading: false,
      results: null,
      index: -1,
      selected: false,
      lock: false,
      clearOnSelect: null,
      displayValue: null,
      displayInitialValue: false,
      listScrollTop: 0,
    }
  },
  created() {
    document.addEventListener('click', this.documentClick)
    // Initialise i18n integration. No-op if not present
    if (!this.$t) {
      this.$t = (str) => str
    }
  },
  destroyed() {
    document.removeEventListener('click', this.documentClick)
  },
  methods: {
    init() {
      if (!this.field.options.algolia) {
        throw new Error(
          `Field "${this.field.name}" does not specify an Algolia config!`
        )
      }

      let algoliaConfig = this.field.options.algolia
      if (!algoliaConfig.id || !algoliaConfig.key) {
        throw new Error(
          `Field "${this.field.name}" does not specify an Algolia id/key!`
        )
      }

      this.algoliaClient = Algoliasearch(
        algoliaConfig.id,
        algoliaConfig.key
      )

      if (!algoliaConfig.index) {
        throw new Error(
          `Field "${this.field.name}" does not specify an Algolia index!`
        )
      }

      this.algoliaIndexClient = this.algoliaClient.initIndex(
        algoliaConfig.index
      )

      this.clearOnSelect = this.field.options.clearOnSelect
      if (this.field.options.hasOwnProperty('displayInitialValue')) {
        this.displayInitialValue = this.field.options.displayInitialValue
      }

      this.$nextTick(() => {
        if (this.field.value) {
          // NOTE: This isn't quite right but there is no
          // real way to know if an object is 'empty' other
          // that seeing if there is anything in the child values
          let hasSomeValue = Object.values(this.field.value).find(
            value => {
              return value !== null
            }
          )
          if (hasSomeValue) {
            this.displayValue = this.formatValue(this.field.value)
          }
        }
      })
    },

    getFieldWrapperClass() {
      return 'mutt-field-wrapper mutt-field-wrapper-autocomplete'
    },

    documentClick(e) {
      let el = this.$refs.dropdownMenu
      let target = e.target
      if (el !== target && !el.contains(target)) {
        this.lock = true
      }
    },

    search(event) {
      this.displayValue = this.$refs.inputField.value
      // Arrows or Enter are navigational, ignore these
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' &&
        event.key !== 'Enter') {
        this.lock = false

        if (this.displayValue === '') {
          // Don't search empty strings (it causes algolia to return
          // the whole show)
          this.results = null
          return
        }

        const algoliaConfig = this.field.options.algolia

        let attributes = ['*']
        if (algoliaConfig.attributes) {
          attributes = algoliaConfig.attributes
        }

        let filters = []
        if (algoliaConfig.filters) {
          filters = algoliaConfig.filters
        }

        this.loading = true
        this.lock = true

        this.algoliaIndexClient.search(
          this.displayValue,
          {
            attributesToRetrieve: attributes,
            facetFilters: filters
          },
          (err, results) => {
            if (err) {
              throw new Error(`Algolia Plugin Error -> ${err}`)
            }
            this.results = results
            this.index = -1
            this.loading = false
            this.lock = false
          }
        )
      }
    },

    select(index) {
      // set index from click event but not if keyboard event
      if (typeof index !== 'object') {
        this.index = index
      }

      if (this.index > -1 && this.results.hits.length > 0) {
        let result = this.results.hits[this.index]

        this.displayValue = this.formatValue(result)
        this.$refs.inputField.value = this.formatValue(result)
        this.value = result
        this.field.value = result
        this.lock = true
        this.displayInitialValue = false

        this.$emit('select', this.value)
        this.submitCallback()

        if (this.clearOnSelect) {
          this.displayValue = null
        }
      }
    },

    next() {
      if (this.$refs['items']) {
        const count = this.$refs['items'].length
        this.goto(
          this.index < count - 1 ? this.index + 1 : (count ? 0 : -1),
          'down',
        )
      }
    },

    prev() {
      if (this.$refs['items']) {
        const count = this.$refs['items'].length
        const pos = this.index - 1

        this.goto(
          this.selected && pos !== -1 ? pos : count - 1,
          'up'
        )
      }
    },

    /**
     * Check if a list item is within the list's visible area
     *
     * @param {number} listItemIndex The list item index
     * @param {number} listItemHeight The CSS height of the list item
     *
     * @return {boolean}
     */
    isListItemVisible(listItemIndex, listItemHeight) {
      const listHeight = this.$refs['list'].clientHeight
      const listItemStart = listItemIndex * listItemHeight
      const listItemEnd = listItemStart + listItemHeight

      if ((listItemStart >= this.listScrollTop) &&
        (listItemEnd <= this.listScrollTop + listHeight)) {
        return true
      }
    },

    /**
     * Highlight the active list item and make sure it's visible by
     * scrolling the list up and down when needed
     *
     * @param {number} i The list item index
     * @param {string} direction The direction being moved within the list
     */
    goto(i, direction) {
      if (this.selected && this.$refs['items'][this.index]) {
        this.$refs['items'][this.index].classList.remove('active-item')
      }

      this.index = i

      if (i > -1 && this.$refs['items'].length > 0) {

        const list = this.$refs['list']
        const listItem = this.$refs['items'][i]

        listItem.classList.add('active-item')

        // TODO: Do I need to show the selected text in my input?
        this.selected = true

        // Scroll the list when necessary in order to keep the active
        // list item comfortably in view

        if (i === 0) {
          this.listScrollTop = list.scrollTop = 0
          return
        }

        const listHeight = list.clientHeight
        const listItemHeight = listItem.clientHeight
        const listItemOffsetTop = listItem.offsetTop
        // The count of fully visible list items will vary according
        // to the CSS height of the list
        const listItemsVisible = Math.floor(listHeight / listItemHeight)
        // Set the visible offset to be applied to the list scroll
        // position - this is relative to how many list items are
        // visible
        const visibleOffset = listItemsVisible - 2

        if (direction === 'down') {
          // Check the visibility of the list item 2 below the
          // active item. If it's not fully visible then scroll the
          // list down
          if (!this.isListItemVisible(i + 2, listItemHeight)) {
            // Scroll the list down
            this.listScrollTop = list.scrollTop =
              listItemOffsetTop - (listItemHeight * visibleOffset)
          }
        } else {
          // Check the visibility of the list item 2 above the
          // active item. If it's not fully visible then scroll the
          // list up
          if (!this.isListItemVisible(i - 2, listItemHeight)) {
            // Scroll the list up
            this.listScrollTop = list.scrollTop =
              listItemOffsetTop - listItemHeight
          }
        }
      }
    },

    setValue(value) {
      this.value = value

      if (this.value) {
        this.displayValue = this.stringFormat(
          this.field.options.algolia.format, this.value
        )
      }
    },

    formatValue(value) {
      if (this.field.options.hasOwnProperty('algolia')) {
        if (this.field.options.algolia.hasOwnProperty('format')) {
          return this.stringFormat(
            this.field.options.algolia.format,
            value
          )
        }
      }

      return value
    },

    checkCallback() {
      if (this.field.options.hasOwnProperty('allowFreetype') &&
        this.field.options.allowFreetype) {
        this.submitCallback()
      }
    },

    submitCallback() {
      let hits = null

      if (this.results && this.results.hits) {
        hits = this.results.hits
      }

      if (this.field.validate()) {
        this.$emit('callback', {
          key: this.field.name,
          value: this.field.value,
          displayValue: this.displayValue,
          hits: hits,
          action: 'submit',
          validated: true
        })
      } else {
        this.$emit('callback', {
          key: this.field.name,
          value: this.field.value,
          displayValue: this.displayValue,
          hits: hits,
          action: 'submit',
          validated: false
        })
      }
    },

    focus() {
      this.$nextTick(() => {
        this.$refs.inputField.focus()
      })
    },

    stringFormat
  },
  computed: {
    placeholderStr() {
      if (this.field.options.algolia.hasOwnProperty('placeholder')) {
        return this.$t(this.field.options.algolia.placeholder)
      }
    },

    hasPlaceholder() {
      if (!this.displayValue) {
        return false
      }

      if (!this.field.options.algolia.hasOwnProperty('placeholder')) {
        return false
      }

      if (this.results !== null) {
        if (this.results.hits.length === 0) {
          return true
        }
      }

      return false
    },

    algoliaInputWidth() {
      const inputWrapperWidth =
        this.$refs.algoliaWrapper.getBoundingClientRect().width
      return `width: ${inputWrapperWidth}px`
    },
  },
}
</script>
