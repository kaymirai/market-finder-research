# Market Finder Final Fix Round 1 Report

Date: 2026-08-14

Branch: `codex/market-finder-auto-deep-dive`

Fix base: `04fe80b`

Commit: `fix: close Market Finder dispatch gate gaps`（本報告を含むコミット。最終SHAは完了ハンドオフに記載）

## Scope

最終ブランチレビューのImportant 4件だけを修正した。Opportunity/Confidence、Chrome拡張の取得方式、CSV列、動画スライド構造、通常のIP注意候補は変更していない。テストおよび確認でEtsy/EverBeeへの外部通信は行っていない。

## Changes and evidence

### 1. Multi-angle exclusion terms

- `isEfficientMarketplaceProbe()` が現在の `excludedRiskTerms` を共通ゲートへ渡すようにした。
- `buildMultiAngleCandidatePools()` が明示的除外語を候補へ引き継ぐ。
- `nextMultiAngleBatch()` が現在の除外語で復元current batch、retry queue、通常poolを再判定する。
- 除外候補はretry/failed/global pauseへ移さずskipし、同じ角度の次の安全候補へ進む。
- `currentMultiAnglePools()` と `nextAppMultiAngleBatch()` は常に現在の `elements.riskInput.value` を渡す。

Regression coverage:

- `applies current explicit exclusion terms to multi-angle candidate selection`
- `skips newly excluded restored and retry candidates without pausing the exploration`
- `passes current explicit exclusion terms into multi-angle selection and queue recovery`

### 2. Pending EverBee and restored Marketplace dispatch gates

- query-ineligible final evidence rowsは監査行として保持したままterminal `excluded` にする。
- `isAutomatableEvidenceRow()`、`pendingEvidenceBatch()`、`deriveFinalKeywordDecision().pendingCount` は `queryEligibility.eligible === false` を自動dispatch/pending数から除外する。
- `verifyPendingEvidence()` はrequested単体経路を含め、dispatch対象をquery-eligible行へ限定する。
- `gateMarketplaceInsightPlanForDispatch()` を追加し、保存plan復元時とMarketplace各dispatch直前に共通ゲートで再検証する。
- 非適格plan itemは削除せず `status: skipped`、`terminalError: true`、`queryEligibility`、`exclusionReason` を残す。
- 通常のIP注意語は明示的除外語に含まれない限りdispatch可能なまま保持する。

Regression coverage:

- `keeps query-ineligible audit rows out of pending dispatch and pending counts`
- `turns a query-ineligible pending audit row into a terminal excluded state`
- `keeps restored Marketplace plans auditable while terminally skipping ineligible queries`
- `does not block ordinary IP review terms unless they are explicitly excluded`
- `revalidates pending EverBee rows and restored Marketplace plans immediately before dispatch`

### 3. Final-result toolbar eligibility

- コピー可否は `deriveFinalKeywordDecision(finalEvidenceRows()).recommendedCount` に合わせた。
- CSV可否はquery-eligibleなfinal evidenceのうち、実際にexport可能な `everbeeRow` がある場合だけ有効にした。
- freshnessも同じCSV対象行から算出する。

Regression coverage:

- `derives every final-result toolbar action from one state function` にtitle-like A/B only fixtureを追加し、コピー・CSVの両方がdisabledになることを確認した。

### 4. Duplicate phrase common gate

- 語数判定直後に既存 `hasRepeatedAdjacentPhrase()` と `hasDuplicateGarmentProductTerms()` を組み込んだ。
- 連続語/連続句は `status: repeated-phrase`、重複衣類商品語は `status: duplicate-product` でrejectする。
- reasonもそれぞれ専用の英語説明を返す。

Regression coverage:

- `teacher shirt shirt`
- `teacher shirt teacher shirt`
- `teacher shirt tee`

## TDD record

### RED 1

Command:

```powershell
node --test market-finder/scripts/test-opportunity-model.mjs market-finder/scripts/test-multi-angle-candidates.mjs market-finder/scripts/test-multi-angle-exploration.mjs market-finder/scripts/test-final-evidence-matrix.mjs market-finder/scripts/test-persistent-evidence-automation.mjs market-finder/scripts/test-guided-entry-ui.mjs market-finder/scripts/test-buyer-query-gate-ui.mjs
```

Expected failures observed:

1. pending EverBee dispatch gate wiring missing
2. current multi-angle exclusion wiring missing
3. query-ineligible pending row entered the batch/count
4. title-like-only toolbar remained enabled
5. multi-angle explicit exclusion was ignored
6. restored/retry excluded candidates remained queued
7. repeated/duplicate query remained eligible
8. restored Marketplace plan gate helper missing
9. ordinary-IP preservation helper contract missing together with the absent helper

### RED 2

Command:

```powershell
node --test --test-name-pattern "query-ineligible pending audit row" market-finder/scripts/test-final-evidence-matrix.mjs
```

Observed: expected terminal `excluded`, actual `pending-everbee`.

### GREEN

Focused command above: `336 passed / 0 failed`.

## Verification

### Syntax

The six specified files passed `node --check`:

- `shared/market-keyword-engine/index.js`
- `market-finder/src/multi-angle-candidates.js`
- `market-finder/src/multi-angle-exploration.js`
- `market-finder/src/final-evidence-matrix.js`
- `market-finder/src/video-slide-prompts.js`
- `market-finder/src/app.js`

The additionally modified `market-finder/src/persistent-evidence-automation.js` also passed.

### Full Market Finder test suite

Plan-specified sequential execution of all `market-finder/scripts/test-*.mjs`:

- Test files: `39`
- Tests passed: `707`
- Tests failed: `0`

One all-files-concurrent diagnostic run caused only `test-local-launcher.mjs` to collide on its local port. The launcher file passed `6/6` alone, and the required sequential full run passed `707/707`.

### Repository checks

- `git diff --check`: PASS
- No external Etsy/EverBee calls: confirmed by using only local unit/source tests

## Self-review

- Changes are limited to the four Important findings, required cache-buster updates, and regression fixtures.
- Explicit exclusion terms now reach candidate selection, restored/current batches, retries, and the app queue boundary.
- Excluded candidates are skipped without recording a keyword failure or pausing the exploration.
- Restored Marketplace rows remain auditable; no historical item is deleted.
- Normal IP warning candidates remain eligible unless the user explicitly excludes the term.
- Toolbar state uses the same query-eligible production evidence as copy/export behavior.
- Duplicate rejection uses existing shared helpers and does not introduce another scoring model.

## Remaining concerns

- Live Etsy/EverBee behavior was intentionally not exercised to avoid consuming search/rate limits. Final live confirmation will occur during the user's next normal research run.
- The full suite must remain sequential because the local-launcher tests own fixed local ports and can collide when all files are forced to run concurrently.
