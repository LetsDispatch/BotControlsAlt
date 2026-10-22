# BotControlsAlt

Telegram Configuration web app: https://letsdispatch.github.io/BotControlsAlt/

The API uses the assigned ngrok domain. Location suggestions are entirely local to the browser; the Google Maps/Places SDK and API key have been removed.

## File-based location lookup

`locations/catalog.v1.json` is generated from LoadboardScanner master commit `86745e32c53289bf29cfe2367cf562f51d6660ea`, using `src/LoadBoardScanner.UI/uscities.csv`, `US.txt`, and the state's catalog labels. It contains 107,245 deduplicated US cities/localities with coordinates, ZIP aliases, 51 states/DC, and six regions.

`location-search.js` ports the matching/ranking rules from master's `AutocompleteService` and `LocationCatalog`: normalized names, state abbreviations/full names, ZIP prefixes (including leading zeros), token matching and fuzzy spelling. Results are limited to 20, queries to 100 characters, and the normalized query cache to 128 entries. The original C# implementation generated the 34 reference queries in `tests/master-location-results.json`.

One lazy Web Worker loads the 4.5 MB catalog once per page, with HTTP caching for subsequent visits. Searches run off the UI thread. No location query is sent to ngrok, the bot, Google, or another geocoding service. A missing catalog shows a retryable error; there is no paid fallback. ZIP aliases resolve to the catalog's city coordinates, not street addresses. Coverage and coordinates follow the bundled files, not live map updates.

The create form and edit dialog share the picker. Users must choose a suggestion before Add becomes available; editing the text clears the previous selection. Existing saved locations retain their IDs, coordinates and radii. States keep their abbreviation in the API's `name` field, as required by the legacy bot.

### Refreshing the data

```sh
python3 scripts/build-location-catalog.py /path/to/LoadboardScanner origin/master
node --test tests/location-search.test.cjs
```

When changing data, use a new versioned catalog filename and update the worker reference; bump the JS/CSS query versions in HTML and the worker import as appropriate. Regenerate the reference results by running the original C# service against that same source revision before accepting intentional ranking/data differences. Publish the catalog and scripts together through GitHub Pages.

ZIP aliases are derived from [GeoNames postal-code data](https://download.geonames.org/export/zip/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); their format and terms are described in the [GeoNames readme](https://download.geonames.org/export/zip/readme.txt). City coordinates are reused from the existing LoadboardScanner CSV. This export removes unused columns and deduplicates cities using the same rules as master.

### Validation

```sh
node --check onload.js
node --test tests/location-search.test.cjs
python3 -m http.server 8766 --bind 127.0.0.1
```

Browser checks should cover ZIP/city/state/region selection, keyboard selection, stale-selection clearing, mobile modal layout, preserved legacy city IDs/radii, create/update request payloads, and retry after a failed catalog download. Mock the bot API for write checks; do not create production searches as test data. Check that no Maps/Places requests are made. Telegram authentication itself still requires opening the deployed page through the bot.
