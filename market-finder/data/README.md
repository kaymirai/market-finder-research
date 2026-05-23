# Market Finder seed data

This folder keeps manually or semi-automatically collected keyword metadata that can be used as broad discovery seeds.

## etsy-search-keyword-metadata-2026-05-23.csv

Source: YouTube keyword table screenshots captured on 2026-05-23.

The data currently contains 882 deduped rows from 81 screenshots. It is approximate and should be treated as a starting point only. It is useful for finding broad terms with visible buyer search demand and a rough search-to-results ratio. It is not sales proof. Market Finder should still validate candidates with eRank and EverBee before treating any keyword as a product opportunity.

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
