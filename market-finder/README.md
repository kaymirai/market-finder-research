# Market Finder

EtsyMiraiProducerへ組み込む前に、イベント別の低競合キーワード探索を試すための別アプリです。

## できること

- 父の日、母の日、ハロウィン、クリスマスなどのイベントからロングテール候補を生成
- ハロウィンやクリスマスのような大型イベントを、モチーフ・場面・相手・テイスト・周辺需要の5レーンに分解
- Etsy Marketplace Insightsを無料15語、またはEtsy Plusの入口20語＋有望な関連語を最大40語まで段階式で確認
- 広めの市場で売れた商品のタイトル・タグから種ワードを抽出
- `event + target + product + year` を軸に候補を増やす
- Chrome拡張へ直接依頼して、eRank Keyword ToolとEverBee Product Analyticsを順番に検索
- eRankで検索需要を見て、良さそうな候補だけEverBeeで売上確認
- eRankの需要・供給と、EverBeeで複数商品が売れている広がりを別々に評価
- `Opportunity A-D` と `Confidence High/Medium/Low` を分けて表示
- 古い検索種や一般トレンドは発想用に留め、45日以内のeRank/EverBeeまたは7日以内のEtsy公式データだけをA/B判定に使用
- 良い候補を商品テーマ、ターゲット、デザイン方向性、SEOタイトル、タグ案へ変換
- 売れている候補から次ラウンドの派生キーワードを作成
- 高競合でも複数商品が売れている市場から、需要を残しながら競合が下がるクロスニッチを最大2階層まで探索
- 最終結果をイベント固有候補と通年クロスニッチ候補へ分け、別イベントで調査済みの通年市場は後順位へ送る

## 起動

起動スクリプトで、Market Finderと共有エンジンだけを配信するローカルサーバーを立てます。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-market-finder.ps1 -NoBrowser
```

開くURL:

```text
http://127.0.0.1:ポート番号/market-finder/
```

## Chrome拡張連携

1. `etsy-chrome-extension` をChromeでLoad unpackedする
2. 拡張のバージョンが `1.26` になっていることを確認
3. 実Chromeで開いているMarket Finderページが自動再読み込みされることを確認
4. 画面上部のかんたんモードで `候補を作る` を押す
5. `eRankで広く見る` を押す
6. `EverBeeで売上確認` を押す

調査開始後は進捗モーダルが開き、現在のキーワード、完了件数、残り件数、完了/停止/エラー状態を確認できます。
モーダル内の `停止` から途中停止もできます。

接続されない場合は、Market FinderがCodex内蔵ブラウザではなく実Chromeで開かれているか確認し、拡張をReloadしてください。自動再読み込みされない場合だけMarket Finderページを一度再読み込みします。

## 大型イベント分解 / Etsy公式段階式プラン

ハロウィンまたはクリスマスを選んで候補を作ると、40候補を5レーンへ8件ずつ配分します。イベント名を含む `Direct` は30%以下、イベント名から離れた `Adjacent` は40%以上を維持し、外部サイトで実際に見つけた語句は `Observed` として表示します。

候補と最終結果は、イベント名・固有モチーフ・固有場面を含む「イベント固有」と、`teacher`、`nurse`、`book lover`などの「通年隣接」に分けます。Opportunity点数は変えず、同じ順位表へ混ぜません。調査済みの通年クラスターはイベントIDと一緒にローカル保存し、別イベントで再登場した場合は削除せず後順位へ送ります。これにより、ハロウィンとクリスマスの両方で同じ一般市場を最初から繰り返し調べる量を減らします。

同時にMarketplace Insightsの調査プランを作ります。無料モードは入口5件・検証7件・予備3件の15語です。Etsy Plusモードは入口20語から始め、最大200語の関連候補プールから5語ずつ、最大40語を追加する段階式の60検索構成です。検索数・掲載数・コンバージョン表示・商品一致・語句の具体性・複数入口からの再発見を評価し、同じ意味の語は1バッチ2語までに制限します。

`Etsy公式確認を自動実行` を押すと、候補を1語ずつ検索し、結果表示を待って直近30日の検索数・検索変化率・掲載数・関連語を保存し、次の候補へ自動で進みます。Etsyが日本語表示でも英語表示でも、「似たような検索ワード / Similar search terms」と「探索のアイデア / Exploration ideas」を自動で切り替え、各行の検索数・検索結果数・コンバージョン表示を統合します。Etsy側の画面変更などで止まった場合は、対象画面を手動で表示して `表示中の結果を取り込む` から復旧できます。

入口結果を10語以上取得すると、`次の5語を追加` が有効になります。最初の5語を終えた後は残りの入口を確認し、その後は5語ごとに再評価します。20語以上を深掘りした後、2ラウンド連続で新しい有望群が増えなければ早期終了します。Plusモードでもアプリが自動でページ送りや連続検索を行うことはありません。

Etsy公式値は取得後7日以内だけOpportunity A/Bの判定に使い、EverBeeの複数商品販売データと組み合わせます。検索需要だけで「売れる」とは判定しません。

## Broad Market Scan

最初に `fathers day shirt` のような広めの検索で売れ筋商品を見て、商品名・タグ・Salesを貼り付けます。
`種ワード抽出` を押すと、`dog dad`、`bonus dad`、`from daughter` のような語句を拾い、`追加語句へ入れる` で候補生成に使えます。

`広め検索語を作る` を押すと、イベントと商品から `fathers day shirt` などの広め検索語を作ります。
Chrome拡張が接続済みなら、`EverBeeで広め調査` でその検索語を順番に調査し、EverBee画面から商品名と商品別の月間販売数・累計販売数・売上・公開後月数を共通IDで取得します。月間販売数順に並べ、公開12か月以内に複数商品で現れる語句を種ワード抽出で優先します。商品別の結合に失敗した場合は、検索結果全体の最大販売数を各商品へ流用しません。

## 高競合市場からのクロスニッチ探索

EverBee競合10,000件以上、Etsy掲載20,000件以上、またはeRank競合50,000件以上でも、複数の商品が売れている場合は直接狙う候補から捨てず、「探索用親市場」として残します。単一の古いベストセラーだけでは親市場にしません。

5段目の最終確定前に、EverBeeの商品別タイトル、Etsy関連語、すでに調査済みの子市場から交差軸を抽出します。親市場は上位3件、1親8候補、次の調査へ送る候補は12件、深度は最大2です。総当たりではなく、売れ筋証拠が強い上位だけを通常のeRank確認へ自動で戻します。

クロスニッチ専用の追加ボタンはありません。未検証候補が見つかると2段目へ自動追加され、eRank、Etsy公式、EverBeeの既存ボタンで順に確認します。再調査中は最終おすすめ一覧と結果CSVを保留し、深度2まで完了または新しい候補がなくなった時点で、初回結果と子キーワードを合わせて最終順位を確定します。`Cross Niche Parent`と`Cross Niche Depth`はローカル保存と結果CSVへ保持するため、再読み込み後も親子関係と深度上限を維持できます。

親子の同じ情報源がそろった場合は、次を表示します。

```text
競合減少率 = 1 - 子の競合数 / 親の競合数
需要維持率 = 子の検索数 / 親の検索数
効率改善倍率 = 子の需要競合比 / 親の需要競合比
```

初期の有望条件は、競合50%以上減、需要10%以上維持、効率1.5倍以上、販売商品2件以上です。親子の月販売中央値を比較できる場合は販売維持率15%以上も必要です。EverBee未確認の子は有望確定にせず、需要維持率3%未満または販売維持率15%未満なら次へ進めません。この「探索優先度」は最終の`Opportunity A-D`点数とは別です。

## eRank連携

かんたんモードでは、Chrome拡張がeRank Keyword Toolを開き、まず広めの検索語を順番に検索します。
画面から取得できた Average Searches、Average Clicks、CTR、Etsy Competition、KD、Trend をMarket Finderへ戻します。
下に表示される Keyword Ideas / Near Matches も読めた範囲で取り込みます。
その結果を使って、EverBeeでは細かい候補だけを売上確認します。
画面構造が変わった場合の保険として、CSV貼り付け・手入力も残しています。

対応している列:

```csv
Keyword,Listings Analyzed,Top Monthly Sales,Top Revenue,Average Price,Listing Age,eRank Search Volume,eRank Clicks,eRank CTR,eRank Competition,eRank KD,eRank Trend,Etsy Searches 30d,Etsy Listings,Etsy Related Terms,Notes,Visible Listing Count,Selling Listing Count,Recent Selling Listing Count,Median Monthly Sales,Median Monthly Revenue,Total Visible Monthly Sales,Top Sales Share,Median Listing Age Months,eRank Checked At,Etsy Checked At,EverBee Checked At,EverBee Product Rows JSON,Cross Niche Parent,Cross Niche Depth,Market Track,Research Event,Research Category,History Cluster
```

`Listings Analyzed` はEverBee側の補助競合指標として段階評価します。500件以下を20点、1,000件以下を18点、2,500件以下を15点、5,000件以下を12点とし、30,000件以上は過密としてA/Bへ昇格させません。ただし、Etsy公式やeRankの競合数の代替、または販売密度の分母には使いません。
詳しい判断基準は `market-finder/DUAL_TOOL_STRATEGY.md` に置いています。

## Halloween実測の再現検証

2026-07-20にEtsy US、eRank、EverBeeで確認したHalloweenシャツ候補は `validation/halloween-shirt-evidence-2026-07-20.json` に保存しています。デジタル素材、明確なIP候補、検索意図に合わない商品をEverBee集計から外した上で、次のコマンドでMarket Finderの推奨順位を再現できます。

```powershell
node market-finder/scripts/validate-halloween-research.mjs
```

この検証では、同じB候補でも掲載数が少ない語を上位にし、Etsy公式とeRankで需要帯が食い違う語は5点下げます。A/B/C/Dの昇格条件自体は変更しません。

## SEOタイトル / タグ設計

Step 5で、調査済みキーワードを3つのバケットに整理できます。

- `Visibility` は低競合で入口にしたい語句
- `Reach` は中競合で検索範囲を広げる語句
- `Best seller` は競合は強いが市場の中心になる語句

`結果からバケット作成` を押すと、EverBee/eRankの数値から自動で振り分けます。`SEO案を作る` で、タイトルは14語以内を目安に商品名を1回だけ入れ、タグは13個以内・各20文字以内に整えます。

## 30日後の実績記録

判定は販売保証ではなく、調査順を決めるためのものです。出品した商品の30日後の表示・訪問・お気に入り・注文・売上は `validation/research-outcome-template.csv` に記録し、20〜50件たまってからA/Bの基準を調整します。

## 共通ロジック

キーワード生成、CSV解析、スコアリング、商品案変換は `shared/market-keyword-engine` に置いています。
将来EtsyMiraiProducer本体へ入れる時も、この共通ロジックを使う想定です。
