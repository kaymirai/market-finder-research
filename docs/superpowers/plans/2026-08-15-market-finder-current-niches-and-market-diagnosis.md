# Market Finder Current Niches and Market Diagnosis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Market Finderに「選択カテゴリ内で直近30日の現在ニッチを、既存のA/B基準を緩めず最大5件まで自動探索する」調査目的を追加し、0件時も「競合過多」「小市場」「証拠不足」を根拠付きで区別して表示する。

**Architecture:** 調査目的、現在ニッチ種別、市場診断をそれぞれ副作用のないモジュールに分離する。`app.js`は選択状態・永続化・既存multi-angle探索への接続・表示だけを担当し、候補生成とEtsy/EverBeeの50件単位パイプラインは変更せず再利用する。市場診断はA/B判定とは独立して、検証完了・鮮度・探索網羅性が揃った場合にだけ「小市場」を返す。

**Tech Stack:** Vanilla JavaScript ES modules, HTML/CSS, Node.js built-in test runner, Chrome extension backed Etsy/EverBee research pipeline, localStorage, JSON evidence archive.

## Global Constraints

- A/B判定閾値と既存のMarket Finder総合点は変更しない。
- eRankは任意の補助データのままとし、市場診断の必須条件にしない。
- 「現在ニッチ」モードは1つの選択商品カテゴリ内だけを対象にし、目標は固定5件とする。
- 証拠期間は最大30日。ただし既存データ源の鮮度ルールが30日より厳しい場合は厳しい方を使う。
- 50件単位の確認で終わらず、5件到達・全探索角度枯渇・全体停止要因・手動停止のいずれかまで既存自動ループを継続する。
- 未検証、取得失敗、ログイン要求、レート制限、ページタイムアウトが残る状態を「小市場」に分類しない。
- 現在ニッチの季節性/定番分類は表示専用で、スコアやA/B判定に影響させない。
- 実装中も既存ユーザーデータ、既存archive、無関係な未追跡ファイルは変更・削除しない。

---

### Task 1: 調査目的を純粋モデルとして追加する

**Files:**
- Create: `market-finder/src/research-goal.js`
- Create: `market-finder/scripts/test-research-goal.mjs`

- [ ] **Step 1: 失敗するユニットテストを書く**

`test-research-goal.mjs`に次を追加する。

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  RESEARCH_GOAL_MODES,
  createResearchGoal,
  researchTargetCount,
  resolveResearchGoalEvent,
} from '../src/research-goal.js'

test('keeps the calculated listing target in event mode', () => {
  assert.equal(researchTargetCount(
    createResearchGoal({ mode: 'event' }),
    { listingTargetCount: 3 },
  ), 3)
})

test('fixes current niche discovery to five without loosening the score model', () => {
  const goal = createResearchGoal({ mode: RESEARCH_GOAL_MODES.currentNiches })
  assert.deepEqual(goal, {
    mode: 'current-niches',
    targetCount: 5,
    evidenceWindowDays: 30,
  })
  assert.equal(researchTargetCount(goal, { listingTargetCount: 1 }), 5)
})

test('uses auto discovery internally and ignores a saved event in current niche mode', () => {
  assert.equal(resolveResearchGoalEvent(
    createResearchGoal({ mode: 'current-niches' }),
    { id: 'halloween' },
  ).id, 'auto-discovery')
})

test('migrates missing and malformed saved goals to legacy event mode', () => {
  assert.equal(createResearchGoal().mode, 'event')
  assert.equal(createResearchGoal({ mode: 'unknown', targetCount: -4 }).mode, 'event')
})
```

- [ ] **Step 2: テストを実行して未実装で失敗することを確認する**

Run: `node --test market-finder/scripts/test-research-goal.mjs`

Expected: `ERR_MODULE_NOT_FOUND`またはexport未定義でFAIL。

- [ ] **Step 3: 最小実装を書く**

`research-goal.js`は次の公開APIだけを持つ。

```js
export const RESEARCH_GOAL_MODES = Object.freeze({
  event: 'event',
  currentNiches: 'current-niches',
})

export function createResearchGoal(saved = {})
export function researchTargetCount(goal, { listingTargetCount = 1 } = {})
export function resolveResearchGoalEvent(goal, selectedEvent)
export function researchGoalContextLabel(goal)
```

`createResearchGoal()`は常に直列化可能な`{ mode, targetCount, evidenceWindowDays }`を返す。`current-niches`は`5 / 30`固定、`event`は保存された正のtargetCountを保持してもよいが、実行時の目標は`researchTargetCount()`で既存の`calculateListingResearchTarget()`結果を優先する。

- [ ] **Step 4: テストを再実行する**

Run: `node --test market-finder/scripts/test-research-goal.mjs`

Expected: PASS。

- [ ] **Step 5: コミットする**

```powershell
git add market-finder/src/research-goal.js market-finder/scripts/test-research-goal.mjs
git commit -m "feat(market-finder): model research goals"
```

---

### Task 2: 現在ニッチの季節性/定番分類を追加する

**Files:**
- Create: `market-finder/src/current-niche-classification.js`
- Create: `market-finder/scripts/test-current-niche-classification.mjs`
- Read/Reuse: `market-finder/src/event-market-tracks.js`
- Read/Reuse: `shared/market-keyword-engine/index.js`

- [ ] **Step 1: 分類契約の失敗テストを書く**

次を固定する。

- `halloween nurse shirt`、既知イベントの正式語・関連語・motif語を含む語は`seasonal`。
- `funny respiratory therapist shirt`、職業・趣味・ペットの語だけなら`evergreen`。
- イベント語が別トークンに埋もれた場合も、単語境界で判定する。
- 空語や未知語は安全側の`evergreen`。
- 戻り値は`{ type, label, eventId }`で、labelは`季節・イベント`または`定番`。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test market-finder/scripts/test-current-niche-classification.mjs`

Expected: FAIL。

- [ ] **Step 3: 既存イベント定義を再利用して最小実装する**

`classifyCurrentNicheType(rowOrKeyword, { events = MARKET_EVENTS } = {})`を実装する。イベント定義ごとの`searchTerm`、`label`、`displayTerm`、`seasonalSignals`と、既存`eventSignalTerms()`が扱うmotif/moment/adjacent信号を正規化し、最初に一致したイベントIDを返す。独自スコアやランキングは追加しない。

- [ ] **Step 4: テストを再実行する**

Run: `node --test market-finder/scripts/test-current-niche-classification.mjs`

Expected: PASS。

- [ ] **Step 5: コミットする**

```powershell
git add market-finder/src/current-niche-classification.js market-finder/scripts/test-current-niche-classification.mjs
git commit -m "feat(market-finder): classify current niche timing"
```

---

### Task 3: 根拠不足を誤判定しない市場診断を実装する

**Files:**
- Create: `market-finder/src/market-outcome.js`
- Create: `market-finder/scripts/test-market-outcome.mjs`
- Read/Reuse: `market-finder/src/final-evidence-matrix.js`
- Read/Reuse: `market-finder/src/event-market-tracks.js`
- Read/Reuse: `shared/market-keyword-engine/index.js`

- [ ] **Step 1: 4状態と優先順位の失敗テストを書く**

テストfixtureはUI文字列ではなく`finalEvidenceRows()`相当の形を使い、少なくとも次を固定する。

```js
const verified = (keyword, overrides = {}) => ({
  keyword,
  queryEligibility: { eligible: true },
  evidenceState: { status: 'verified' },
  raw: {
    etsySearches30d: 0,
    etsyListings: 0,
    sellingListingCount: 0,
    recentSellingListingCount: 0,
    medianMonthlySales: 0,
    etsyCheckedAt: '2026-08-10T00:00:00.000Z',
    everbeeCheckedAt: '2026-08-10T00:00:00.000Z',
    ...overrides,
  },
  scoreState: { score: 24 },
  opportunityLabel: 'D',
})
```

- A/Bが1件以上なら、他の行に取得失敗があっても`opportunities-found`を最優先する。
- A/B 0、鮮度30日以内、需要・販売実績が強く、既存competition bandが`high`/`very-high`/`saturated`なら`competition-constrained`。
- A/B 0、全角度枯渇、global blockなし、pending/failed 0、root/directと関連・深掘り2行以上が完全で新鮮、全て需要・販売広がりなしなら`small-market`。
- 同じ0件でも関連行不足、古いデータ、Etsyのみ、EverBeeのみ、pending、failed、login/rate limit、retry queue、イベント語不一致のいずれかがあれば`insufficient-evidence`。
- eRankが空でもEtsy/EverBeeが揃えば判定可能。
- `coverage`は`verified/pending/failed/completeEvidence`を数え、`reasonCodes`は機械可読値を返す。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test market-finder/scripts/test-market-outcome.mjs`

Expected: FAIL。

- [ ] **Step 3: 証拠正規化と鮮度判定を実装する**

公開APIを以下に限定する。

```js
export const MARKET_OUTCOME_STATUSES = Object.freeze({
  opportunitiesFound: 'opportunities-found',
  competitionConstrained: 'competition-constrained',
  smallMarket: 'small-market',
  insufficientEvidence: 'insufficient-evidence',
})

export function rowHasCompleteMarketEvidence(row, { now, evidenceWindowDays = 30 } = {})
export function deriveMarketOutcome({ rows, exploration, researchGoal, context, now } = {})
```

`rowHasCompleteMarketEvidence()`はbuyer-query対象、verified、Etsy検索数、Etsy出品数、EverBee販売商品数、EverBee月販中央値、両checkedAtの鮮度を全て要求する。値0は取得済みとして扱い、null/空文字と区別する。

- [ ] **Step 4: 診断優先順位を実装する**

`deriveMarketOutcome()`は次の順で早期returnする。

1. verified A/Bあり → `opportunities-found`
2. A/Bなし、pending/failed/global blockなし、完全証拠に強需要または複数販売実績、かつ既存competition bandがhigh以上 → `competition-constrained`
3. A/Bなし、探索`exhausted`、retryQueue空、全角度確認済み、pending/failed/global blockなし、root/direct + related/drilldown 2行以上が完全・新鮮、全行に既存需要支持/販売広がりなし、競合制約親なし、イベントモードならテーマ一致 → `small-market`
4. それ以外 → `insufficient-evidence`

結果は必ず次の形を返す。

```js
{
  status,
  reasonCodes: [],
  opportunityCount,
  coverage: { verified, pending, failed, completeEvidence },
  diagnosedAt,
}
```

需要・競合は新しい閾値を作らず、行に保存された既存正規化値、`score.normalized`、`competition.band`、`classifyKeywordBucket()`相当の既存判定を再利用する。

- [ ] **Step 5: テストを再実行する**

Run: `node --test market-finder/scripts/test-market-outcome.mjs`

Expected: PASS。

- [ ] **Step 6: コミットする**

```powershell
git add market-finder/src/market-outcome.js market-finder/scripts/test-market-outcome.mjs
git commit -m "feat(market-finder): diagnose market outcomes"
```

---

### Task 4: 調査目的を永続化し、既存の自動探索ループへ接続する

**Files:**
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/scripts/test-multi-angle-exploration.mjs`
- Modify: `market-finder/scripts/test-evidence-archive.mjs`
- Modify: `market-finder/scripts/test-persistent-evidence-automation.mjs`

- [ ] **Step 1: app接続の失敗テストを追加する**

ソース契約と純粋関数テストで次を固定する。

- `state.researchGoal`が`createResearchGoal()`で初期化される。
- `persistMarketFinderState()`が`researchGoal`を保存し、復元時は欠損した旧保存を`event`へ移行する。
- 目標数を使う全経路が`calculateListingResearchTarget(...).targetWinnerCount`の直参照ではなく、共通`activeResearchTargetCount()`を通る。
- `current-niches`では`activeResearchContext()`、`startMultiAngleSearch()`、`startNewMultiAngleCycle()`、`prepareForNewCandidateDiscovery()`が内部イベント`auto-discovery`と目標5を使う。
- `event`では現在のイベントと既存計算目標を維持する。
- 50件バッチ完了後、A/Bが5未満で探索候補が残る場合は`queueNextMultiAngleBatch()`または新サイクルへ進み、5件到達時のみ停止する。
- 全角度枯渇時は空候補を無限再生成せず`exhausted`で止まり、実数を保存する。

- [ ] **Step 2: 対象テストを実行して失敗を確認する**

Run:

```powershell
node --test market-finder/scripts/test-multi-angle-exploration.mjs market-finder/scripts/test-evidence-archive.mjs market-finder/scripts/test-persistent-evidence-automation.mjs
```

Expected: 新規assertがFAIL。

- [ ] **Step 3: `app.js`に共通解決関数を追加する**

以下を追加し、目標やイベントの分岐を一箇所へ集約する。

```js
function activeResearchGoal() {
  return createResearchGoal(state.researchGoal)
}

function activeResearchTargetCount() {
  const listingTargetCount = calculateListingResearchTarget(
    state.listingResearchTargetSettings,
  ).targetWinnerCount
  return researchTargetCount(activeResearchGoal(), { listingTargetCount })
}

function selectedResearchEvent() {
  return resolveResearchGoalEvent(activeResearchGoal(), selectedEvent())
}
```

`activeResearchContext()`、`activeResearchOptions()`、新規/継続サイクル、`shouldAutoStartFreshCycle()`、`pendingEvidenceWinnerTargetReached()`、進捗コピーはこの3関数を使う。既存50件単位`FINAL_EVIDENCE_BATCH_SIZE`は変更しない。

- [ ] **Step 4: 保存・復元・archiveへ追加する**

- `marketState.researchGoal`へ保存する。
- restoreでは`createResearchGoal(savedState.researchGoal)`を使う。
- `evidenceArchiveRecord()`へ`researchGoal`と、Task 3の`deriveMarketOutcome()`で計算した`marketOutcome`スナップショットを追加する。
- live画面はarchiveの`marketOutcome`を信頼せず毎回再計算し、archive値は説明用スナップショットに限定する。
- archive fingerprintに診断を含めず、同一runの測定更新規則を変えない。

- [ ] **Step 5: テストを再実行する**

Run:

```powershell
node --test market-finder/scripts/test-research-goal.mjs market-finder/scripts/test-market-outcome.mjs market-finder/scripts/test-multi-angle-exploration.mjs market-finder/scripts/test-evidence-archive.mjs market-finder/scripts/test-persistent-evidence-automation.mjs
```

Expected: PASS。

- [ ] **Step 6: コミットする**

```powershell
git add market-finder/src/app.js market-finder/scripts/test-multi-angle-exploration.mjs market-finder/scripts/test-evidence-archive.mjs market-finder/scripts/test-persistent-evidence-automation.mjs
git commit -m "feat(market-finder): run current niche research goal"
```

---

### Task 5: 条件画面と最終結果に目的・診断・最大5件を表示する

**Files:**
- Modify: `market-finder/index.html`
- Modify: `market-finder/styles.css`
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/scripts/test-guided-entry-ui.mjs`
- Modify: `market-finder/scripts/test-final-evidence-ui.mjs`
- Modify: `market-finder/scripts/test-multi-angle-ui.mjs`

- [ ] **Step 1: UI契約の失敗テストを書く**

次をassertする。

- 条件画面に`name="researchGoalMode"`の2択がある。
- ラベルは「イベントを指定して探す」「現在のニッチを5件探す」。
- current-niches選択時、イベントselectとカスタムイベント入力はdisabledになり、「イベント・季節性も自動探索に含みます」と表示される。
- final結果上部に`marketOutcome`専用ブロックがあり、4状態ごとに別heading・理由・次の判断を表示する。
- 表示理由は最大3件、診断日と`verified/pending/failed/completeEvidence`を表示する。
- `opportunities-found`でcurrent-nichesなら、A/B上位5件をスコア順、同点はkeyword順で表示し、各語に`季節・イベント`/`定番`badgeを付ける。
- 5件未満で探索終了した場合は「3/5件」のように実数を表示し、A/B基準を緩めていない説明を出す。
- `competition-constrained`は「需要はあるが競合が強い。深掘り継続の余地あり」、`small-market`は「需要・販売実績が小さい。別テーマ推奨」、`insufficient-evidence`は「判断材料不足。再確認が必要」と明確に分ける。
- 既存A/B/C/D表、詳細、CSV、動画スライド導線は残る。

- [ ] **Step 2: UIテストを実行して失敗を確認する**

Run:

```powershell
node --test market-finder/scripts/test-guided-entry-ui.mjs market-finder/scripts/test-final-evidence-ui.mjs market-finder/scripts/test-multi-angle-ui.mjs
```

Expected: FAIL。

- [ ] **Step 3: 条件UIを追加する**

`index.html`のイベント欄の前に2択を追加し、`app.js`の`elements`へcontrol/help要素を登録する。変更イベントでは、実行中の探索を既存`pauseMultiAngleForInputChange()`で安全に停止し、`state.researchGoal`更新、イベント入力disabled切替、表示更新、保存を行う。current-niches切替時に過去イベント値自体は消さず、eventモードへ戻した時に復元する。

- [ ] **Step 4: 市場診断ブロックと5件一覧を実装する**

`renderFinalKeywordDecision(rows)`内で`deriveFinalKeywordDecision(rows)`と`deriveMarketOutcome(...)`を並行して使用する。表示用の文言変換は`app.js`内の小さなpure helperに置き、`reasonCodes`を日本語へ変換する。current-nichesのA/B一覧は`classifyCurrentNicheType()`を使い、上位5件だけを主表示する。

既存の`decision.status === 'pending'/'retry'`は市場診断より優先して操作導線を残す。取得失敗や未検証を伴う場合は、診断が常に`insufficient-evidence`になることをUIテストでも確認する。

- [ ] **Step 5: CSSを追加する**

既存の白/薄灰、濃紺、青緑、オレンジの配色を使い、dashboard全体を再設計しない。目的2択、診断status badge、理由3件、current niche badgeだけを既存カード構造へ追加する。重要語は既存結果見出しと同等以上、補足は既存本文サイズを下回らない。

- [ ] **Step 6: UIテストを再実行する**

Run:

```powershell
node --test market-finder/scripts/test-guided-entry-ui.mjs market-finder/scripts/test-final-evidence-ui.mjs market-finder/scripts/test-multi-angle-ui.mjs
```

Expected: PASS。

- [ ] **Step 7: コミットする**

```powershell
git add market-finder/index.html market-finder/styles.css market-finder/src/app.js market-finder/scripts/test-guided-entry-ui.mjs market-finder/scripts/test-final-evidence-ui.mjs market-finder/scripts/test-multi-angle-ui.mjs
git commit -m "feat(market-finder): show current niches and market diagnosis"
```

---

### Task 6: 回帰検証、実ブラウザ確認、文書更新を行う

**Files:**
- Modify: `market-finder/README.md`
- Modify: `market-finder/SCREEN_GUIDE.md`
- Verify: all files changed in Tasks 1-5

- [ ] **Step 1: 利用手順を文書化する**

README/画面ガイドへ次だけを追記する。

- 「現在のニッチを5件探す」は1カテゴリ、直近30日、季節/定番混在。
- 5件は努力目標ではなく上限付きの固定目標で、基準を緩めないため枯渇時は5件未満で終了する。
- 4つの市場診断の意味と、証拠不足を小市場と扱わないこと。
- 50件は1バッチであり、探索全体の上限ではないこと。

- [ ] **Step 2: 対象テスト群をまとめて実行する**

Run:

```powershell
node --test market-finder/scripts/test-research-goal.mjs market-finder/scripts/test-current-niche-classification.mjs market-finder/scripts/test-market-outcome.mjs market-finder/scripts/test-final-evidence-matrix.mjs market-finder/scripts/test-multi-angle-exploration.mjs market-finder/scripts/test-persistent-evidence-automation.mjs market-finder/scripts/test-evidence-archive.mjs market-finder/scripts/test-guided-entry-ui.mjs market-finder/scripts/test-final-evidence-ui.mjs market-finder/scripts/test-multi-angle-ui.mjs
```

Expected: PASS。

- [ ] **Step 3: Market Finder全テストを実行する**

Run:

```powershell
Get-ChildItem market-finder\scripts\test-*.mjs | ForEach-Object { node --test $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

Expected: 全テストPASS。既存の無関係な失敗が出た場合は、新規対象テストの結果と分けて記録する。

- [ ] **Step 4: 静的差分を確認する**

Run:

```powershell
git diff --check -- market-finder/index.html market-finder/styles.css market-finder/src/app.js market-finder/src/research-goal.js market-finder/src/current-niche-classification.js market-finder/src/market-outcome.js market-finder/scripts market-finder/README.md market-finder/SCREEN_GUIDE.md
```

Expected: 出力なし。

- [ ] **Step 5: ローカルアプリで手動確認する**

ローカルMarket Finderを起動し、次を確認する。

1. eventモードの既存保存状態・目標数・イベント選択が変わらない。
2. current-nichesへ切り替えるとイベント入力が無効になり、カテゴリは選択できる。
3. 開始後に「A/B 0/5」、現在の探索角度、50件単位の進捗が見える。
4. 50件完了で5件未満かつ候補が残れば次へ自動継続する。
5. 5件到達で停止し、上位5件と季節/定番badgeが表示される。
6. 枯渇時は実数/5と、競合過多・小市場・証拠不足のいずれかが表示される。
7. 未検証/失敗を人為的に残した状態は必ず証拠不足になる。
8. 再読み込み後も目的・進捗・結果が復元される。

- [ ] **Step 6: 最終コミットを作る**

```powershell
git add market-finder/README.md market-finder/SCREEN_GUIDE.md
git commit -m "docs(market-finder): explain current niche research"
```

---

## Done Criteria

- [ ] eventモードの既存挙動とA/B閾値が維持されている。
- [ ] current-nichesモードが選択カテゴリ内でA/B最大5件を自動探索する。
- [ ] 50件単位の検証後も、停止条件まで自動で次へ進む。
- [ ] 5件未満で枯渇しても件数を水増しせず終了する。
- [ ] 0件時に競合過多、小市場、証拠不足を誤認なく区別する。
- [ ] 最新30日を超える証拠、未検証、取得失敗、global blockがある状態は小市場にならない。
- [ ] 季節/定番badgeは表示専用で、スコアへ影響しない。
- [ ] 保存・復元・archive・CSV・動画スライドの既存導線が壊れていない。
- [ ] 対象テスト、全Market Finderテスト、実ブラウザ確認が完了している。
