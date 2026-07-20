# Market Finder v1 validation

初版ローンチ前は、EverBee確認後のCSVを20〜50件ためてからスコア検証します。

```powershell
node market-finder/scripts/validate-scoring.mjs path\to\market-finder-step4-everbee.csv
```

見るポイント:

- `Listings Analyzed <= 1,000` は競合点18〜20点、`1,001〜5,000` は12〜15点
- `5,001〜15,000` は販売の広がり、需要、データ鮮度がそろう場合だけA候補
- `15,000〜30,000` はAにせず、条件がそろう場合だけB候補
- `30,000以上` はA/Bにせず最大39点、`50,000以上` は最大29点
- 競合未取得かつEtsy公式/eRankの供給証拠もない場合は最大39点

同梱の `scoring-regression-cases.csv` はロジック崩れを防ぐための回帰確認用です。実市場の判断には、Chrome拡張で取った最新のeRank/EverBee結果CSVを使います。
