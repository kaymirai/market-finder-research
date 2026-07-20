# Cross-Niche Drilldown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 高競合・高売上の市場から、販売実績のある交差軸を使って需要を保ちながら競合が下がるキーワードを最大2階層まで探索する。

**Architecture:** 共有判定エンジンに親市場選択、親子比較、交差候補生成を純粋関数として追加する。Market Finderは自動再調査の状態を専用モジュールで管理し、上位候補を既存のeRank調査フローへ自動で戻す。再検証中は最終結果を保留し、既存の親市場データを保持したまま子キーワードの結果を統合する。Chrome拡張データ形式は変更しない。

**Tech Stack:** JavaScript ES modules、Node.js test runner、静的HTML/CSS、Chrome拡張連携の既存データモデル

## Global Constraints

- 親市場は上位3件、1親8候補、次調査12候補、最大深度2とする。
- クロスニッチ点数は探索優先度であり、最終Opportunity点数へ混ぜない。
- 親子比率は同一情報源の値だけで計算する。
- 商品別販売データがない候補は有望確定せず追加確認とし、比較可能な販売維持率が15%未満なら止める。
- 権利リスク、商品不一致、重複商品語、役割矛盾を既存フィルターで除外する。

---

### Task 1: 共有エンジンの親市場選択と親子比較

**Files:**
- Modify: `shared/market-keyword-engine/index.js`
- Test: `market-finder/scripts/test-opportunity-model.mjs`

**Interfaces:**
- Produces: `selectCrossNicheParentMarkets(rows, options)`
- Produces: `compareCrossNicheRows(parent, child, options)`

- [x] **Step 1: 失敗テストを書く**

`test-opportunity-model.mjs`へ次を追加する。

```js
test('keeps a saturated multi-seller market as a cross-niche exploration parent', () => {
  const parents = selectCrossNicheParentMarkets([{ keyword: 'cat shirt', listingsAnalyzed: 43906, productRows: [
    { title: 'Book Club Cat Shirt', monthlySales: 40, listingAgeMonths: 6 },
    { title: 'Teacher Cat Shirt', monthlySales: 25, listingAgeMonths: 10 },
  ] }], SCORE_OPTIONS)
  assert.equal(parents[0].keyword, 'cat shirt')
})
```

単一の古いベストセラーを除外するテストと、親子比率が`0.9 / 0.2 / 2`になるテストも追加する。

- [x] **Step 2: REDを確認する**

Run: `node market-finder/scripts/test-opportunity-model.mjs`

Expected: 新しいexportが存在しないためFAIL。

- [x] **Step 3: 最小実装を書く**

`index.js`へ競合情報源、商品別販売集計、親市場条件、同一情報源比較を追加する。比率は小数第3位で丸め、取得不能時は`null`を返す。

- [x] **Step 4: GREENを確認する**

Run: `node market-finder/scripts/test-opportunity-model.mjs`

Expected: 新規テストを含めPASS。

### Task 2: 売れ筋タイトルから交差候補を生成

**Files:**
- Modify: `shared/market-keyword-engine/index.js`
- Test: `market-finder/scripts/test-opportunity-model.mjs`

**Interfaces:**
- Consumes: `selectCrossNicheParentMarkets()`、`compareCrossNicheRows()`
- Produces: `buildCrossNicheDrilldown(rows, options)`

- [x] **Step 1: 失敗テストを書く**

複数の新しい販売商品に`book club`が出現した時、`book club cat shirt`を上位へ出すテストを追加する。需要が3%未満へ落ちる実測済み子を`weak-demand`にするテストと、深度2の親を除外するテストも追加する。

- [x] **Step 2: REDを確認する**

Run: `node market-finder/scripts/test-opportunity-model.mjs`

Expected: `buildCrossNicheDrilldown`未実装でFAIL。

- [x] **Step 3: 最小実装を書く**

`extractNicheHintsFromListings()`を再利用し、親語・商品語を除いた修飾語を抽出する。Etsy関連語と既存調査行を統合し、候補ごとに`parentKeyword`、`modifier`、`depth`、`sources`、`priorityScore`、`comparison`、`verdict`を返す。

- [x] **Step 4: GREENを確認する**

Run: `node market-finder/scripts/test-opportunity-model.mjs`

Expected: 新規テストを含めPASS。

### Task 3: 5段目の表示と次調査への追加（初期実装、Task 5で自動化）

**Files:**
- Modify: `market-finder/index.html`
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/styles.css`
- Test: `market-finder/scripts/test-guided-entry-ui.mjs`

**Interfaces:**
- Consumes: `buildCrossNicheDrilldown(state.researchRows, currentOptions())`
- Produces: `renderCrossNicheDrilldown()`、`applyCrossNicheCandidates()`

- [x] **Step 1: 失敗テストを書く**

5段目の結果後に`crossNicheSection`、`crossNicheList`、`buildNextRoundBtn`があり、親子比較ラベルと通常調査へ戻す処理が存在することを検証する。

- [x] **Step 2: REDを確認する**

Run: `node market-finder/scripts/test-guided-entry-ui.mjs`

Expected: 新しい要素と関数がないためFAIL。

- [x] **Step 3: 最小実装を書く**

既存のStep 2にある`buildNextRoundBtn`をStep 5のクロスニッチ欄へ移す。親市場と候補を表形式で表示し、ボタン押下時に上位12候補を`state.candidates`へ追加する。候補へ`crossNicheParent`と`crossNicheDepth`を保持し、後続の調査行へ引き継ぐ。

- [x] **Step 4: GREENを確認する**

Run: `node market-finder/scripts/test-guided-entry-ui.mjs`

Expected: 新規UIテストを含めPASS。

### Task 4: 回帰検証とドキュメント

**Files:**
- Modify: `market-finder/README.md`
- Modify: `market-finder/MARKET_FINDER_OPPORTUNITY_MODEL_DESIGN.md`
- Modify: `market-finder/index.html` cache query

- [x] **Step 1: 機能説明を追加する**

READMEへ探索用親市場、親子比較、最大2階層、クロスニッチ点数が最終Opportunityとは別であることを追記する。

- [x] **Step 2: 全検証を実行する**

Run:

```powershell
node market-finder/scripts/test-opportunity-model.mjs
node market-finder/scripts/test-guided-entry-ui.mjs
node market-finder/scripts/test-research-flow.mjs
node market-finder/scripts/test-research-performance.mjs
node market-finder/scripts/validate-scoring.mjs
node market-finder/scripts/validate-halloween-research.mjs
npm.cmd test --prefix etsy-chrome-extension
node --check market-finder/src/app.js
node --check shared/market-keyword-engine/index.js
```

Expected: 全コマンド終了コード0、既存回帰条件PASS。

- [x] **Step 3: デスクトップ画面を確認する**

`http://127.0.0.1:4173/market-finder/`を再読み込みし、Step 5のクロスニッチ欄と最終結果が重ならないことを確認する。Task 5の実装後は手動追加ボタンが存在しないことも確認する。

### Task 5: クロスニッチ候補の自動再調査と最終結果ゲート

**Files:**
- Create: `market-finder/src/cross-niche-workflow.js`
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/index.html`
- Modify: `market-finder/styles.css`
- Test: `market-finder/scripts/test-cross-niche-workflow.mjs`
- Test: `market-finder/scripts/test-guided-entry-ui.mjs`

**Interfaces:**
- Produces: `createCrossNicheWorkflowState(savedState)`
- Produces: `advanceCrossNicheWorkflow({ workflow, candidates, stageForKeyword, hasParents, limit })`
- Consumes: `buildCrossNicheDrilldown(state.researchRows, currentOptions())`

- [ ] **Step 1: 自動キューと段階遷移の失敗テストを書く**

未検証候補を最大12件キューへ入れること、eRank・Etsy・EverBeeの順に待機段階が進むこと、同じ候補を再追加しないこと、深度2の新候補だけを次ラウンドへ送ることを純粋関数で検証する。

- [ ] **Step 2: REDを確認する**

Run: `node market-finder/scripts/test-cross-niche-workflow.mjs`

Expected: ワークフローモジュールが存在しないためFAIL。

- [ ] **Step 3: 状態管理モジュールを実装する**

`status`、`round`、`batch`、`consideredKeywords`、`queuedKeywords`、`completedAt`を正規化して保存する。現在バッチに未完了段階があればその段階を維持し、完了後に未検討候補だけを最大12件キューへ追加する。

- [ ] **Step 4: UIを自動フローへ接続する**

手動の`buildNextRoundBtn`と`applyCrossNicheCandidates()`を廃止する。自動追加時は候補一覧を現在バッチへ切り替え、Etsy計画を初期化し、クロスニッチ再調査では`researchRows`を消去せずにeRank・EverBee結果をマージする。

- [ ] **Step 5: 最終おすすめを再調査完了まで保留する**

`pending-erank`、`pending-etsy`、`pending-everbee`では結果一覧とCSV保存を無効化し、次に必要な操作を表示する。`complete`または探索対象なしの時だけ全EverBee結果を再採点して表示する。

- [ ] **Step 6: GREENと回帰を確認する**

Run:

```powershell
node market-finder/scripts/test-cross-niche-workflow.mjs
node market-finder/scripts/test-guided-entry-ui.mjs
node market-finder/scripts/test-opportunity-model.mjs
node market-finder/scripts/test-research-flow.mjs
node market-finder/scripts/test-research-performance.mjs
```

Expected: 全テストPASS。
