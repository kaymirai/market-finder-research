# Market Finder Keyword-First Video Slides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every candidate video slide display its exact keyword as the dominant visual and remove the final next-actions slide.

**Architecture:** Keep candidate selection and snapshot data unchanged. Narrow only the presentation prompt produced by `video-slide-prompts.js`, then migrate the known legacy candidate-slide block in saved editable templates through `video-slide-ui-state.js` while preserving text outside that block.

**Tech Stack:** Browser-native ES modules, Node.js built-in test runner, static HTML cache-version query strings.

## Global Constraints

- Candidate keywords must keep their exact spelling and word order.
- Candidate slides use 70–80% of the visual area, 120–180pt text, and at most three lines.
- Candidate slides show only total score, A/B rating, and IP/trademark caution when required.
- Reasons, product category, buyer, occasion, theme, design nouns, and ordinary cautions stay in narration or source data, not on the slide.
- Cover and conclusion remain; the final next-actions slide and narration are removed.
- The bottom 20% remains empty for subtitles.
- Saved custom prompt text outside the known legacy candidate block remains unchanged.

---

### Task 1: Generate keyword-dominant candidate slides

**Files:**
- Modify: `market-finder/scripts/test-video-slide-prompts.mjs`
- Modify: `market-finder/src/video-slide-prompts.js`

**Interfaces:**
- Consumes: `buildVideoSlideSnapshot({ rows, context, generatedAt })` output without schema changes.
- Produces: `buildVideoSlideOutputs(snapshot, template)` with `slides = [cover, conclusion, ...candidateSlides]` and matching narration entries.

- [ ] **Step 1: Write failing output tests**

Add assertions using a `teacher ghost shirt` candidate:

```js
const candidatePrompt = outputs.slides[2].prompt
assert.match(candidatePrompt, /画面の70〜80％/)
assert.match(candidatePrompt, /120〜180pt/)
assert.match(candidatePrompt, /最大3行/)
assert.match(candidatePrompt, /中央/)
assert.match(candidatePrompt, /総合点: 82/)
assert.match(candidatePrompt, /A\/B評価: A/)
assert.doesNotMatch(candidatePrompt, /候補になった理由|向いている商品|想定購入者|使用場面|商品テーマ|デザイン要素|注意点/)
assert.deepEqual(outputs.slides.map((slide) => slide.id), [
  'cover', 'conclusion', 'candidate-1',
])
assert.equal(outputs.narration.length, 3)
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `node --test market-finder/scripts/test-video-slide-prompts.mjs`

Expected: FAIL because the prompt still contains detailed on-slide fields and `next-actions` still exists.

- [ ] **Step 3: Simplify the default and candidate prompts**

In `DEFAULT_VIDEO_SLIDE_PROMPT`, replace the candidate-slide rules with the approved keyword-first rules and remove the final next-actions line from the basic structure. In `candidateSlidePrompt`, emit:

```js
`大見出し: ${candidate.keyword}`,
'候補キーワードを画面中央へ配置し、画面の70〜80％を使って120〜180ptで最大3行に収める。',
'候補キーワードは省略・言い換えをせず、入力どおりの綴りと語順で表示する。',
`総合点: ${candidate.totalScore ?? '未確認'}。キーワードより十分小さく表示する。`,
`A/B評価: ${candidate.opportunityLabel}。キーワードより十分小さく表示する。`,
```

Retain the conditional IP/trademark line. Remove reasons, products, buyers, occasions, themes, nouns, and ordinary cautions from this slide prompt. Remove the `next-actions` slide object and narration object from `buildVideoSlideOutputs`.

- [ ] **Step 4: Run the output tests and confirm GREEN**

Run: `node --test market-finder/scripts/test-video-slide-prompts.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- market-finder/scripts/test-video-slide-prompts.mjs market-finder/src/video-slide-prompts.js
git commit -m "feat: make video slides keyword first"
```

### Task 2: Migrate saved editable prompt templates

**Files:**
- Modify: `market-finder/scripts/test-video-slide-ui-state.mjs`
- Modify: `market-finder/src/video-slide-ui-state.js`

**Interfaces:**
- Consumes: `migrateVideoSlidePromptTemplate(value: string)`.
- Produces: the same string API with the legacy candidate block replaced by the keyword-first block and the legacy next-actions instruction removed.

- [ ] **Step 1: Write a failing migration test**

Use a saved template containing `CUSTOM INTRO`, the current `【候補別スライド】` block, the current `- 最終:` line, and `CUSTOM END`. Assert that the migrated result:

```js
assert.match(migrated, /CUSTOM INTRO/)
assert.match(migrated, /画面の70〜80％/)
assert.match(migrated, /120〜180pt/)
assert.match(migrated, /最大3行/)
assert.doesNotMatch(migrated, /- 最終: 商品案を1つに絞る/)
assert.doesNotMatch(migrated, /想定購入者、使用場面/)
assert.match(migrated, /CUSTOM END/)
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `node --test market-finder/scripts/test-video-slide-ui-state.mjs`

Expected: FAIL because migration currently updates only the obsolete IP exclusion sentence.

- [ ] **Step 3: Implement bounded legacy-block migration**

Keep the existing IP rule migration, then replace only the text from `【候補別スライド】` through the line before `【動画用デザインルール】` with the new approved block. Remove the exact legacy `- 最終: 商品案を1つに絞る...` line. Do not change text before, after, or outside these known legacy fragments.

- [ ] **Step 4: Run migration and output tests**

Run:

```powershell
node --test market-finder/scripts/test-video-slide-ui-state.mjs market-finder/scripts/test-video-slide-prompts.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit Task 2**

```powershell
git add -- market-finder/scripts/test-video-slide-ui-state.mjs market-finder/src/video-slide-ui-state.js
git commit -m "fix: migrate saved video slide prompts"
```

### Task 3: Load the new prompt modules and verify the feature

**Files:**
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/index.html`
- Test: `market-finder/scripts/test-*.mjs`

**Interfaces:**
- Consumes: updated prompt and migration module exports with unchanged function signatures.
- Produces: browser loads `video-slide-prompts.js?v=20260815-3`, `video-slide-ui-state.js?v=20260815-3`, and `app.js?v=20260815-18`.

- [ ] **Step 1: Bump cache versions**

Update both video-slide module query strings in `market-finder/src/app.js` from `20260813-2` to `20260815-3`. Update the stylesheet and `app.js` query strings in `market-finder/index.html` from `20260815-17` to `20260815-18`.

- [ ] **Step 2: Run syntax and full regression checks**

Run:

```powershell
node --check market-finder/src/video-slide-prompts.js
node --check market-finder/src/video-slide-ui-state.js
node --check market-finder/src/app.js
$tests = Get-ChildItem 'market-finder\scripts\test-*.mjs' | Select-Object -ExpandProperty FullName
node --test $tests
git diff --check
```

Expected: syntax checks exit 0, all tests pass with 0 failures, and `git diff --check` prints no errors.

- [ ] **Step 3: Verify in the live Market Finder**

Reload `http://127.0.0.1:4174/market-finder/`, open `動画スライド`, generate prompts, and verify:

- Candidate slide prompt says 70–80%, 120–180pt, maximum three lines, and centered.
- Candidate slide prompt does not request reasons, buyer, occasion, theme, or design nouns on the image.
- No next-actions slide is present.
- Existing A/B candidate count and saved research are unchanged.

- [ ] **Step 4: Commit Task 3**

```powershell
git add -- market-finder/src/app.js market-finder/index.html
git commit -m "chore: refresh keyword-first slide assets"
```
