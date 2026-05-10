# EverBee + eRank Strategy

## 結論

100%の確信は持たない。
Market Finderでは、EverBeeを「購買実績」、eRankを「検索需要」の確認として分けて使う。

## 採用する判断軸

| 役割 | 主に見るもの | 判断 |
|---|---|---|
| EverBee | Listings Analyzed, Monthly Sales, Revenue, Average Price, Listing Age | 実際に売れているか |
| eRank | Search Volume, Clicks, CTR, Competition, KD, Trend | 検索されてクリックされるか / 検索数に対して競合が軽いか |

## 採用ルール

- まず広めの検索で売れ筋タイトル・タグを拾い、種ワードを作る
- eRankでは広めの検索語で入口市場を確認する
- eRankのKeyword Ideas / Near Matchesから関連キーワードも拾う
- KDは低いほどよいが、検索数・クリックがない場合は単独では決めない
- EverBeeではeRankで反応があった入口に近い細かい候補だけを確認する
- EverBeeもeRankも良い: 優先候補
- EverBeeは良いがeRank未確認: 有望だがSEO需要確認待ち
- eRankは良いがEverBee売上が弱い: 検索需要はあるが商品化は追加確認
- 両方弱い: 除外候補
- 商標・著作権っぽい語句を含む: 数値が良くても要確認

## Loopholes and Fixes

| Loophole | Risk | Fix |
|---|---|---|
| eRankの画面自動操作 | eRankの画面変更・利用条件変更で動かなくなる | まず自分用の操作補助に限定し、CSV貼り付け・手入力も保険で残す |
| EverBeeだけで判断する | 一部商品だけ売れている偶然を拾う | eRankで検索需要を確認する |
| eRankだけで判断する | 検索されても買われない語句を拾う | EverBeeで売上・Revenueを確認する |
| 競合数だけで判断する | 低競合でも需要ゼロの候補が残る | Sales/Revenue/Clicksを必須確認にする |
| 売上だけで判断する | 商標・著作権・一過性トレンドを拾う | Risk termsとListing Ageで除外・保留する |
| データソースの推定値を真実扱いする | 数値が外れる | ラベルを「両方OK」「EverBeeのみ」「eRankのみ」「要判断」に分ける |
| eRankとEverBeeで結果が矛盾する | 判断がぶれる | Search-only / Sales-onlyとして分け、商品化前にEtsy実検索で目視確認 |
| Chrome拡張を配布する | 拡張のソースや動作が見える | まずは自分用ツールに限定。配布時は拡張を薄い操作橋渡しだけにし、判断ロジックや重要な設定はWebアプリ側へ寄せる |
| 無料プレゼントにする | サポート負担・規約変更・ツール依存の責任が増える | まずは非公開運用。配布するなら「調査補助ツール」であり売上保証ではないことを明記する |
| eRank契約をすぐ解約する | 検索需要の裏取りがなくなり、EverBeeの売上推定だけに戻る | まず10-20件の候補でeRankが判断を変えた回数を見る。判断が変わらないなら解約候補 |

## 実装方針

- Chrome拡張はeRank需要確認とEverBee売上確認を自動化する
- Broad Market Scanで、広め検索語を自動生成し、EverBee調査結果から種ワードを抽出する
- eRankは `fathers day shirt` や `dog dad shirt` のような広め語句を順番に検索し、画面から読めた検索数・クリック・競合・KDをMarket Finderへ戻す
- eRankの下部にあるKeyword Ideas / Near Matchesの表も、読めた範囲でMarket Finderへ戻す
- Market FinderはeRankで反応があった広め語句から、EverBee用のロングテール候補へ絞る
- eRankの画面構造が変わった場合に備えて、CSV貼り付けか手入力でもMarket Finderへ入れられるようにする
- Market Finderで両方の数値を統合スコアにする
- 配布版を作る場合は、Chrome拡張を公開商品にせず、Webアプリ本体に主要機能を寄せる

## CSV形式

```csv
Keyword,Listings Analyzed,Top Monthly Sales,Top Revenue,Average Price,Listing Age,eRank Search Volume,eRank Clicks,eRank CTR,eRank Competition,eRank Trend,Notes
dad est 2026 dad to be shirt,"1,039",54,1749,20.44,24 Mo.,720,410,57,4200,12,checked
```

## eRank契約の判断

今すぐ解約はしない。
EverBeeで「売れていそう」に見えた候補に対して、eRankが以下のどれかを追加で教えてくれる間は価値がある。

- 検索数はあるがクリックされない
- クリックはあるが競合が強すぎる
- EverBeeでは弱いが検索需要が伸びている
- 国や季節で需要が偏っている

逆に、20件ほど調べてもMarket Finderの判断ラベルがほぼ変わらないなら、eRankは解約候補にする。
