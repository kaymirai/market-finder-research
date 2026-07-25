# Final Evidence Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Market Finderの最終ステップに全評価根拠を一覧表示し、各候補を検証済み・Unknown保留・取得失敗・除外のいずれかへ進められる操作を追加する。

**Architecture:** eRank抽出の直接値フォールバックをChrome拡張で直し、Market Finder側には最終証拠状態を判定する純粋関数モジュールを追加する。`app.js`は既存の調査キューと採点ロジックを再利用して証拠一覧を描画し、不足ステージだけを既存のeRank・Etsy公式・EverBee処理へ渡す。

**Tech Stack:** TypeScript Chrome content script、Vanilla JavaScript ES modules、Node.js `node:test`、HTML/CSS、既存 `scoreEverbeeResult()`。

## Global Constraints

- `Unknown`、`未取得`、`取得失敗`、数値0を区別し、Unknownを0として採点しない。
- 総合点は既存の `scoreEverbeeResult()` だけを使い、探索優先度を総合点として表示しない。
- 既存の調査結果、研究ラウンド、クロスニッチ履歴を削除しない。
- 一括検証は不足している提供元だけを最大12件ずつ処理する。
- デスクトップ専用の高密度表とし、モバイル対応は追加しない。
- Future Designerの既存必須CSV列は変更せず、状態列を追加する。

---

### Task 1: eRank Competitionの直接取得とUnknown表示

**Files:**
- Modify: `etsy-chrome-extension/src/erankContent.ts`
- Modify: `market-finder/src/app.js`
- Create: `etsy-chrome-extension/scripts/test-erank-direct-metrics.mjs`
- Modify: `etsy-chrome-extension/package.json`

**Interfaces:**
- Consumes: `extractKeywordStatisticsMetrics(bodyText)` の `ErankMetrics`。
- Produces: Competitionだけが数値でも `erankCaptureStatus: 'partial'` になるeRank結果。

- [ ] **Step 1: 失敗するソース回帰テストを書く**

`test-erank-direct-metrics.mjs`で `erankContent.ts` を読み、`statisticsMetrics.erankCompetition` がCompetitionの先頭候補であること、直接4指標でcapture statusを数えることを検証する。

```js
assert.match(source, /const erankCompetition = statisticsMetrics\.erankCompetition\s*\|\|/)
assert.match(source, /\[erankSearchVolume, erankClicks, erankCompetition, erankKeywordDifficulty\]/)
```

- [ ] **Step 2: テストが期待理由で失敗することを確認する**

Run: `node etsy-chrome-extension/scripts/test-erank-direct-metrics.mjs`
Expected: `statisticsMetrics.erankCompetition` が未使用のためFAIL。

- [ ] **Step 3: 最小修正を実装する**

`extractMetrics()`のCompetitionを次の順で統合する。

```ts
const erankCompetition = statisticsMetrics.erankCompetition
    || visualMetrics.erankCompetition
    || tableMetrics.erankCompetition
```

Market Finderの利用者向けラベルだけを次に変更し、内部 `no-data` は互換性のため維持する。

```js
'no-data': 'Unknown',
```

- [ ] **Step 4: テストと拡張ビルドを確認する**

Run: `node etsy-chrome-extension/scripts/test-erank-direct-metrics.mjs`
Expected: PASS。

Run: `npm test --prefix etsy-chrome-extension`
Expected: TypeScript buildとextension reload testがPASS。

- [ ] **Step 5: コミットする**

```bash
git add etsy-chrome-extension/src/erankContent.ts etsy-chrome-extension/scripts/test-erank-direct-metrics.mjs etsy-chrome-extension/package.json market-finder/src/app.js
git commit -m "fix: preserve eRank direct competition metrics"
```

### Task 2: 最終証拠状態の純粋ロジック

**Files:**
- Create: `market-finder/src/final-evidence-matrix.js`
- Create: `market-finder/scripts/test-final-evidence-matrix.mjs`

**Interfaces:**
- Produces: `deriveFinalEvidenceState(input)`、`deriveFinalScoreState(input)`、`formatEvidenceMetric(value, state)`、`pendingEvidenceBatch(rows, stage, limit)`。
- Consumes: `nextStage` は `pending-erank`、`pending-etsy`、`pending-everbee`、`done` のいずれか。

- [ ] **Step 1: 状態遷移の失敗テストを書く**

次を個別テストにする。

```js
assert.equal(deriveFinalEvidenceState({ nextStage: 'pending-erank' }).status, 'pending')
assert.equal(deriveFinalEvidenceState({ nextStage: 'done', erankStatus: 'no-data' }).status, 'hold')
assert.equal(deriveFinalEvidenceState({ nextStage: 'done', hasEverbeeData: true }).status, 'verified')
assert.equal(deriveFinalEvidenceState({ nextStage: 'done', excluded: true }).status, 'excluded')
assert.equal(deriveFinalEvidenceState({ nextStage: 'done', erankStatus: 'failed' }).status, 'failed')
```

- [ ] **Step 2: テストがモジュール未作成で失敗することを確認する**

Run: `node market-finder/scripts/test-final-evidence-matrix.mjs`
Expected: module not foundでFAIL。

- [ ] **Step 3: 最小の純粋関数を実装する**

状態の優先順位は `excluded`、`failed`、pending stage、`hold`、`verified` とする。`deriveFinalScoreState()`は `idea` または数値スコアなしを `pending`、`demand-checked` を `reference`、それ以外を `overall` とする。`formatEvidenceMetric()`は値あり、確認済みUnknown、未取得を分ける。

- [ ] **Step 4: バッチ選択の失敗テストと実装を行う**

同じstageの未完了行だけを重複なしで最大12件返し、別stageとterminal行を除く。

- [ ] **Step 5: テストを確認してコミットする**

Run: `node market-finder/scripts/test-final-evidence-matrix.mjs`
Expected: 全テストPASS。

```bash
git add market-finder/src/final-evidence-matrix.js market-finder/scripts/test-final-evidence-matrix.mjs
git commit -m "feat: derive final evidence verification states"
```

### Task 3: 最終評価一覧と不足ステージ操作

**Files:**
- Modify: `market-finder/index.html`
- Modify: `market-finder/styles.css`
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/scripts/test-research-console-ui.mjs`
- Create: `market-finder/scripts/test-final-evidence-ui.mjs`

**Interfaces:**
- Consumes: Task 2の4関数と既存 `crossNicheStageResolver()`、`scoreEverbeeResult()`、各調査開始関数。
- Produces: `finalEvidenceRows()`、`renderFinalEvidenceMatrix()`、`verifyPendingEvidence(stage)`。

- [ ] **Step 1: UI構造の失敗テストを書く**

HTMLに `finalEvidenceFilters`、`verifyPendingEvidenceBtn`、`finalEvidenceTable` があり、app.jsがTask 2の関数をimportし、CSSに固定列と横スクロールの指定があることを検証する。

- [ ] **Step 2: UIテストが期待理由で失敗することを確認する**

Run: `node market-finder/scripts/test-final-evidence-ui.mjs`
Expected: 新しいDOM IDがないためFAIL。

- [ ] **Step 3: 最終一覧DOMと状態フィルターを追加する**

ツールバーに `すべて`、`推奨`、`検証待ち`、`保留`、`除外`、`取得失敗` のフィルターと `未検証をまとめて検証` を置く。表は固定列として総合点、キーワード、検証状態を持ち、eRank、Etsy公式、EverBee、判定列を横スクロールで表示する。

- [ ] **Step 4: 全候補の証拠行を統合する**

`state.researchRows`、`everbeeResultRows()`、`currentCrossNicheDrilldown().candidates` を正規化キーワードで統合する。採点済み行は既存score、未採点行は `採点前` と探索優先度を表示する。数値セルは値、Unknown、未取得をTask 2のformatterで表示する。

- [ ] **Step 5: 不足ステージ操作を既存処理へ接続する**

一括ボタンは最も早い未完了stageを選び、最大12件を処理する。eRankは既存結果を保持したまま `START_ERANK_RESEARCH`、Etsy公式は既存のMarketplace Insight plan、EverBeeは既存 `START_MARKET_RESEARCH` を使う。行ボタンはその行と同じ不足stageを実行する。terminal行には実行ボタンを表示しない。

- [ ] **Step 6: CSSと選択詳細を実装する**

表の先頭3列と見出しをstickyにし、緑・黄・赤・灰・青の状態クラスを追加する。行選択時は既存 `renderEverbeeDetail()` を下部詳細へ表示し、未採点行は取得済み指標だけの簡潔な詳細を表示する。

- [ ] **Step 7: UIテストと既存テストを確認する**

Run: `node market-finder/scripts/test-final-evidence-ui.mjs`
Expected: PASS。

Run: `node market-finder/scripts/test-research-console-ui.mjs`
Expected: PASS。

- [ ] **Step 8: コミットする**

```bash
git add market-finder/index.html market-finder/styles.css market-finder/src/app.js market-finder/scripts/test-research-console-ui.mjs market-finder/scripts/test-final-evidence-ui.mjs
git commit -m "feat: add final evidence matrix and verification actions"
```

### Task 4: CSV状態列と全体回帰

**Files:**
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/scripts/test-final-evidence-ui.mjs`
- Modify: `market-finder/README.md`

**Interfaces:**
- Consumes: Task 2の状態・score type判定。
- Produces: `Verification Status`、`Missing Stages`、`Score Type`、`eRank Capture Status` を含むCSV。

- [ ] **Step 1: CSV列の失敗テストを書く**

`exportStep4Csv()`と`exportErankCsv()`に4つの状態列があり、Unknownを空文字や0へ変換しないことをソーステストで検証する。

- [ ] **Step 2: テストが期待理由で失敗することを確認する**

Run: `node market-finder/scripts/test-final-evidence-ui.mjs`
Expected: 状態列がないためFAIL。

- [ ] **Step 3: CSV出力とREADMEを更新する**

既存列順を維持した末尾側へ4列を追加する。Future Designer用CSVはEverBeeまで確認した行を出力し、参考eRank CSVはUnknown、保留、取得失敗も含める。

- [ ] **Step 4: 全テストとビルドを確認する**

Run: `node market-finder/scripts/test-final-evidence-matrix.mjs`
Run: `node market-finder/scripts/test-final-evidence-ui.mjs`
Run: `node market-finder/scripts/test-research-console-ui.mjs`
Run: `node market-finder/scripts/test-cross-niche-workflow.mjs`
Run: `node market-finder/scripts/test-opportunity-model.mjs`
Run: `npm test --prefix etsy-chrome-extension`
Expected: すべてexit 0。

- [ ] **Step 5: ブラウザ確認を行う**

Market Finderをローカル起動し、デスクトップ幅で一覧、sticky列、横スクロール、フィルター、検証ボタン、選択詳細を確認する。コンソールエラーがないことを確認する。

- [ ] **Step 6: コミットする**

```bash
git add market-finder/src/app.js market-finder/scripts/test-final-evidence-ui.mjs market-finder/README.md
git commit -m "feat: export final evidence verification metadata"
```
