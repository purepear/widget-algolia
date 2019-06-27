# Mutt Forms Widget - Algolia

Mutt Forms Vue widget for Algolia lookups.


### Field Options
```
{
  "algolia": {
    "id": "<algolia id>",
    "key": "<algolia key>",
    "index": "<algolia index>"
  }
}
```

- `id, key` - algolia provided keys
- `index` - Search index ID


### i18n Support
The widget has i18n support via the (Vue i18n Plugin)[https://github.com/kazupon/vue-i18n]
or any other tools that expose a `$t` function to translate strings.
