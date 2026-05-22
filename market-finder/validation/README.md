# Market Finder v1 validation

初版ローンチ前は、EverBee確認後のCSVを20〜50件ためてからスコア検証します。

```powershell
node market-finder/scripts/validate-scoring.mjs path\to\market-finder-step4-everbee.csv
```

見るポイント:

- Aは原則 `Listings Analyzed <= 5,000`
- Bは `5,001〜9,999` でも販売密度が強いものだけ
- Cは需要があるが派生探索向け
- Dは `20,000+`、IP/商標リスク、販売密度が弱いもの

同梱の `scoring-regression-cases.csv` はロジック崩れを防ぐための回帰確認用です。実市場の判断には、Chrome拡張で取った最新のeRank/EverBee結果CSVを使います。
