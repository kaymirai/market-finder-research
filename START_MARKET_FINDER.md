# Market Finder 起動メモ

## 推奨: 新しいローカルランチャー（4174）

ダブルクリックするファイル:

```text
start-market-finder.cmd
```

PowerShellからブラウザも開く場合:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-market-finder.ps1
```

ブラウザを開かず、サーバーだけ起動する場合:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-market-finder.ps1 -NoBrowser
```

開くURL:

```text
http://127.0.0.1:4174/market-finder/
```

同じMarket Finderが起動中なら、そのPIDを再利用します。4174を別のプロセスが使用中の場合は、そのプロセスを停止せずに起動を中止します。

停止:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-market-finder.ps1
```

停止スクリプトはPID、Nodeプロセス、`/market-finder/health` の応答が一致したMarket Finderだけを停止します。

デスクトップへショートカットを作る場合:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-market-finder-shortcut.ps1
```

Windowsログイン時の自動起動は任意です。必要な場合だけ `-InstallStartup` を付けます。

## 旧互換ランチャー（4173）

ルートの `start-market-finder.ps1` と `start-market-finder.bat` は旧ワークフロー用に残しています。

```powershell
.\start-market-finder.ps1
```

旧ランチャーは `http://127.0.0.1:4173/market-finder/` を使い、ブラウザ起動時にeRank Keyword Tool、EverBee Product Analytics、Etsyも開きます。`-NoResearch` と `-NoBrowser` も従来どおり利用できます。通常は4174の新ランチャーを使ってください。

## 通常の5段階

1. 条件
2. 候補
3. Etsy公式
4. EverBee
5. 最終結果

eRankは必須ではありません。必要な時だけ、最終結果の `eRankで追加確認` を使います。

最終結果では `市場機会スコア` と `商品化・利益スコア` を別々に確認します。条件画面の探索モードは `市場分散`、`併用`、`勝ち市場深掘り` の3つです。

出品後は2週間ごとにEtsy Statsを `market-finder/validation/research-outcome-template.csv` へ追記し、条件画面のEtsy Stats欄から取り込みます。
