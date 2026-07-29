# Market Finder seed data

This folder keeps manually or semi-automatically collected keyword metadata that can be used as broad discovery seeds.

## listing-outcomes.json

This file keeps time-series snapshots of results from launched Etsy listings. Each row requires `listingId` and `snapshotAt`. `snapshotAt` accepts only zero-padded `YYYY-MM-DD` or a valid ISO 8601 timestamp with `Z` or an explicit UTC offset. It is stored as the UTC value returned by `new Date(snapshotAt).toISOString()`; date-only input becomes midnight UTC. Invalid calendar dates, non-zero-padded dates, and timezone-free date-times are rejected. Standard numeric fields are `visits`, `orders`, `revenue`, and `netProfit`; `clusterId` groups related listing tests. Optional diagnostics are `impressions`, `clicks`, `favorites`, and `trafficSource`. Other evidence fields are preserved.

The local server exposes `GET /market-finder/listing-outcomes` and `POST /market-finder/listing-outcomes`. POST accepts only a JSON array up to 4 MiB. It normalizes each row and atomically replaces the data file. Historical snapshots are retained; only a row with the same `listingId` and canonical `snapshotAt` is replaced, and the last duplicate in one request wins. For example, `2026-10-01` and `2026-10-01T00:00:00.000Z` identify the same snapshot.

CSV imports accept the standard names above and the existing 30-day template aliases: `researchedAt`, `clusterKey`, `visits30d`, `orders30d`, `revenue30d`, and `netProfit30d`.

Learning uses the latest snapshot for each listing. At M3, fewer than 100 visits and zero orders remains `watch`, 150 visits and zero orders becomes `stop`, and at least 100 visits with at least 3 orders becomes `early-go`. A cluster with at least 300 total visits and zero orders becomes `cluster-stop`. At M6, observed winner rate, net profit per order, and conversion rate replace planning assumptions.

## etsy-search-keyword-metadata-2026-05-23.csv

Source: YouTube keyword table screenshots captured on 2026-05-23.

The data currently contains 882 deduped rows from 81 screenshots. It is sorted by `searches` descending and is loaded by Market Finder as the "search volume seed" list. It is approximate and should be treated as a starting point only. It is useful for finding broad terms with visible buyer search demand and a rough search-to-results ratio. It is not sales proof. Market Finder should still validate candidates with eRank and EverBee before treating any keyword as a product opportunity.

Columns:

- `keyword`: normalized keyword text from the screenshot.
- `searches`: search volume shown in the screenshot, with thousands separators removed.
- `results`: Etsy result count shown in the screenshot, with thousands separators removed.
- `search_result_ratio`: the table's Search:Result value.
- `source_type`: how the row was collected.
- `source_id`: screenshot timestamp identifier.
- `captured_at`: screenshot timestamp in local time.
- `confidence`: rough read confidence. `medium` means the row should be verified before relying on exact numbers.
- `notes`: short caveat or usage hint.

## Future collection workflow

Preferred order:

1. Export CSV from a paid or official keyword source if it provides keyword, search count, result/listing count, and trend fields.
2. If CSV export is unavailable, capture large readable screenshots of the keyword table and convert them into this schema.
3. Keep exact values as `medium` confidence when a number is partly hidden, surprising, or hard to read.
4. Use the rows only as broad discovery seeds. The next steps remain eRank demand/competition validation and EverBee sales validation.

Etsy Marketplace Insights is a useful source for related search terms and recent Etsy search data, especially if Etsy Plus unlocks unlimited searches. It should not replace EverBee sales validation because search demand alone does not prove that products are selling.

## OCR import command

When a new screenshot batch has the same table layout, install the OCR dependency into a temporary folder and run the extractor:

```powershell
npm.cmd install tesseract.js "@tesseract.js-data/eng" --prefix market-finder/data/ocr-work
$env:NODE_PATH=(Resolve-Path 'market-finder\data\ocr-work\node_modules').Path
node market-finder/scripts/extract-youtube-screenshot-keywords.mjs --input 'C:\Users\kayso\Pictures\スクリーンショット' --out 'market-finder\data\etsy-search-keyword-metadata-new.csv' --from '2026-05-23T22:40:00' --to '2026-05-23T22:52:30' --module-dir $env:NODE_PATH
```

After checking the generated CSV, remove `market-finder/data/ocr-work`.
