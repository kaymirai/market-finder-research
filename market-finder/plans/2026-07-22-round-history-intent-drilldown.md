# Market Finder ラウンド履歴・買い手意図ドリルダウン実装計画

> 設計: `market-finder/specs/2026-07-22-round-history-intent-drilldown-design.md`

## 目的

初回の検索結果を保持したまま最大2回のクロスニッチ探索を追加し、eRankではイベントを含む完全語句とイベントを外した基底語を両方確認する。A/Bの商品化テスト候補、Cの追加探索候補、Dの除外候補を明確に分け、売れ筋タイトル由来のノイズを買い手意図の8軸で抑える。

## Task 1: eRank検索計画を追加する

**Files:**
- Create: `market-finder/src/erank-query-plan.js`
- Create: `market-finder/scripts/test-erank-query-plan.mjs`
- Modify: `market-finder/src/app.js`
- Modify: `etsy-chrome-extension/src/background.ts`
- Modify: `etsy-chrome-extension/scripts/test-extension-reload.mjs`

1. `halloween ghost shirt`から、順序を保った`direct`と`base`の検索記録を作る失敗テストを追加する。
2. 同じ基底語を共有する候補は1検索へまとめ、`sourceKeywords`を全件保持するテストを追加する。
3. `buildErankQueryPlan()`と結果への来歴付与を実装する。
4. 拡張機能の成功・失敗行へ`erankAttemptedAt`を保存し、未検索と取得失敗を区別する。
5. Step 2へ候補数、実検索数、完全語句数、基底語数を表示する。

## Task 2: 調査ラウンド状態を追加する

**Files:**
- Create: `market-finder/src/research-rounds.js`
- Create: `market-finder/scripts/test-research-rounds.mjs`
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/src/cross-niche-workflow.js`
- Modify: `market-finder/scripts/test-cross-niche-workflow.mjs`

1. 初回、クロスニッチ1、クロスニッチ2を直列化・復元できる失敗テストを追加する。
2. 各ラウンドが候補語と結果語を参照し、A/B/C/D件数、開始理由、停止理由を保持する純粋関数を実装する。
3. 初回eRank開始時に初回ラウンドを作り、クロスニッチ開始時は候補を置換せず新ラウンドを追加する。
4. 外部調査の進行に合わせて`pending-erank`、`pending-etsy`、`pending-everbee`、`complete`を更新する。
5. 再読み込み時にラウンドと表示中タブを復元する。

## Task 3: 買い手意図を使ってクロスニッチ候補を改善する

**Files:**
- Modify: `shared/market-keyword-engine/index.js`
- Modify: `market-finder/scripts/test-opportunity-model.mjs`

1. `colors teacher shirt`、`comfort colors teacher shirt`、1商品だけの固有名詞を除外する失敗テストを追加する。
2. 2商品以上で反復した修飾語、またはEtsy関連語で確認された修飾語を残すテストを追加する。
3. `school librarian retirement shirt`をOccupationとLife transitionへ分類するテストを追加する。
4. `librarian gift from students`の`wearerIntent`、`recipientRole`、`giverRole`を保持するテストを追加する。
5. `gift for her`のように具体的な受け手がない語を除外する。
6. IP候補は自動採用せず、IP確認待ちとして来歴へ残す。

## Task 4: Step 3とStep 5をラウンド表示へ変更する

**Files:**
- Modify: `market-finder/index.html`
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/src/styles.css`
- Modify: `market-finder/scripts/test-guided-entry-ui.mjs`

1. Step 3へ`完全語句`、`基底語`、元候補、取得状態を表示する静的UIテストを追加する。
2. Step 5へ`総合`、`初回`、`クロスニッチ1`、`クロスニッチ2`のタブを追加する。
3. クロスニッチ中の進捗帯は一覧の上に置き、既存結果を消す早期returnを削除する。
4. A/Bを「商品化テスト候補」、Cを「追加探索候補」、Dを折りたたみの「除外候補」に分ける。
5. 各ラウンドのA/B/C/D件数と、A/Bが0件の場合の追加探索理由を表示する。

## Task 5: CSVへラウンドと検索来歴を追加する

**Files:**
- Modify: `shared/market-keyword-engine/index.js`
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/scripts/test-opportunity-model.mjs`

1. CSV往復テストへ`researchRoundId`、`queryKind`、`sourceKeywords`、買い手意図を追加する。
2. ラウンド要約行または列へA/B/C/D件数、開始理由、停止理由を含める。
3. クロスニッチ中も途中CSVを保存可能にし、`researchStatus`で途中・完了を識別する。
4. Future Designerが既存列を引き続き読めるよう、既存列名と順序への破壊的変更を避ける。

## Task 6: 回帰検証とデスクトップ画面確認

1. 新規テストを個別実行する。
2. 既存Market Finderテスト、スコア回帰、Chrome拡張テスト、TypeScriptビルドを実行する。
3. ローカルサーバーを起動し、デスクトップ画面でStep 2、3、5を確認する。
4. `halloween ghost shirt`と`ghost shirt`の両方が検索計画へ入り、初回結果がクロスニッチ中も残ることを確認する。
5. `git diff --check`と対象差分を確認し、無関係な未追跡ファイルへ触れていないことを確認する。
