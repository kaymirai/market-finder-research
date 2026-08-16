# Keyword Prompt Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3Aの生成プロンプトをキーワードセットまたは売上分析版ごとに保存・復元し、別テーマの過去結果を混在させない。

**Architecture:** 保存スコープと正規化済みキーワード指紋を純粋関数で生成し、既存`prompt_recipes.generation_config`に格納する。`KeywordPromptBatchPanel`はモード・スコープ・指紋が一致するレシピだけを復元・再開し、所属不明の旧レシピは自動復元しない。

**Tech Stack:** Next.js、React、TypeScript、Supabase既存テーブル、Vitest、jsdom

## Global Constraints

- DB migrationは追加しない。
- 基本は`source_event_snapshot_id`、チャレンジは現在の売上分析シグネチャで分離する。
- 同名でもIDが異なるキーワードセットは別保存にする。
- キーワード集合が変わったレシピは復元・更新しない。
- 旧形式レシピは削除せず、自動表示だけを止める。
- 基本とチャレンジは独立して保存する。

---

### Task 1: プロンプト保存スコープの純粋関数

**Files:**
- Create: `etsy-product-ai/src/utils/ai/promptRecipeScope.ts`
- Test: `etsy-product-ai/src/utils/ai/promptRecipeScope.test.ts`

**Interfaces:**
- Produces: `createKeywordFingerprint(keywords: string[]): string`
- Produces: `createPromptRecipeScope(input: { mode: 'basic' | 'challenge'; sourceSnapshotId: string | null; analysisSignature: string; keywords: string[] }): { sourceScopeKey: string; keywordFingerprint: string }`
- Produces: `promptRecipeMatchesScope(recipe: PromptRecipe, scope: PromptRecipeScope): boolean`

- [ ] **Step 1: スコープ判定の失敗テストを書く**

```ts
expect(createPromptRecipeScope({ mode: 'basic', sourceSnapshotId: 'set-a', analysisSignature: 'analysis-1', keywords: ['cat'] })).toEqual({
  sourceScopeKey: 'snapshot:set-a',
  keywordFingerprint: '["cat"]',
})
expect(createPromptRecipeScope({ mode: 'challenge', sourceSnapshotId: 'set-a', analysisSignature: 'analysis-1', keywords: ['retro'] }).sourceScopeKey).toBe('analysis:analysis-1')
expect(promptRecipeMatchesScope(legacyRecipeWithoutScope, currentScope)).toBe(false)
```

順序違いの同一集合は同じ指紋、重複・空白は除外、文字内容が変われば別指紋になるテストも含める。

- [ ] **Step 2: 対象テストの失敗を確認する**

Run: `npm.cmd test -- --run src/utils/ai/promptRecipeScope.test.ts`

Expected: FAIL because `promptRecipeScope` does not exist.

- [ ] **Step 3: 純粋関数を実装する**

```ts
export function createKeywordFingerprint(keywords: string[]) {
  return JSON.stringify(Array.from(new Set(keywords.map((value) => value.trim()).filter(Boolean))).sort())
}

export function createPromptRecipeScope(input: PromptRecipeScopeInput) {
  return {
    sourceScopeKey: input.mode === 'basic' && input.sourceSnapshotId
      ? `snapshot:${input.sourceSnapshotId}`
      : `analysis:${input.analysisSignature}`,
    keywordFingerprint: createKeywordFingerprint(input.keywords),
  }
}
```

`promptRecipeMatchesScope`は`generation_mode`、`generation_config.sourceScopeKey`、`generation_config.keywordFingerprint`の完全一致を要求する。

- [ ] **Step 4: 対象テストを通す**

Run: `npm.cmd test -- --run src/utils/ai/promptRecipeScope.test.ts`

Expected: PASS.

- [ ] **Step 5: Task 1をコミットする**

```bash
git add etsy-product-ai/src/utils/ai/promptRecipeScope.ts etsy-product-ai/src/utils/ai/promptRecipeScope.test.ts
git commit -m "feat: define prompt recipe scopes"
```

---

### Task 2: 3Aの保存・復元をスコープ一致に限定

**Files:**
- Modify: `etsy-product-ai/src/app/projects/[id]/design-studio-auto/components/KeywordPromptBatchPanel.tsx:128-182,228-306`
- Modify: `etsy-product-ai/src/app/projects/[id]/design-studio-auto/components/DesignStudioAutoClient.tsx:1145-1154`
- Test: `etsy-product-ai/src/app/projects/[id]/design-studio-auto/components/KeywordPromptBatchPanel.test.tsx`

**Interfaces:**
- Consumes: `createPromptRecipeScope`, `promptRecipeMatchesScope`
- Adds prop: `analysisSignature: string` to `KeywordPromptBatchPanel`

- [ ] **Step 1: セットA/Bと旧形式を分離する失敗テストを書く**

```tsx
it('restores only the recipe matching the selected keyword set scope', async () => {
  renderPanel({ sourceSnapshot: snapshotB, initialRecipes: [recipeForA, recipeForB], analysisSignature: 'analysis-1' })
  expect(text()).toContain('prompt for B')
  expect(text()).not.toContain('prompt for A')
})

it('does not restore an unscoped legacy recipe', async () => {
  renderPanel({ sourceSnapshot: null, initialRecipes: [legacyHalloweenRecipe], analysisSignature: 'analysis-new' })
  expect(text()).not.toContain('halloween running shirt')
  expect(text()).toContain('基本プロンプトを生成')
})
```

同名・別ID、同じID・別指紋、チャレンジの旧分析と新分析も別テストにする。

- [ ] **Step 2: 対象テストの失敗を確認する**

Run: `npm.cmd test -- --run src/app/projects/[id]/design-studio-auto/components/KeywordPromptBatchPanel.test.tsx`

Expected: FAIL because the current filter accepts unscoped recipes.

- [ ] **Step 3: 現在スコープを計算し、復元を完全一致にする**

```tsx
const basicScope = createPromptRecipeScope({
  mode: 'basic',
  sourceSnapshotId: sourceSnapshot?.id ?? null,
  analysisSignature,
  keywords: basicKeywords,
})
const challengeScope = createPromptRecipeScope({
  mode: 'challenge',
  sourceSnapshotId: null,
  analysisSignature,
  keywords: challengeKeywords,
})
const initialBasicRecipe = initialRecipes.find((recipe) => promptRecipeMatchesScope(recipe, basicScope)) ?? null
const initialChallengeRecipe = initialRecipes.find((recipe) => promptRecipeMatchesScope(recipe, challengeScope)) ?? null
```

現在の`scopedRecipes`によるnull一致と、チャレンジ全体共有を削除する。`generationGroupId`も一致レシピからだけ復元する。

- [ ] **Step 4: 新規レシピにスコープ情報を保存する**

```tsx
generationConfig: {
  keywords,
  patternNames: selectedPatterns.map((pattern) => pattern.pattern_name),
  count,
  isEmbroidery,
  sourceScopeKey: scope.sourceScopeKey,
  keywordFingerprint: scope.keywordFingerprint,
}
```

PATCHはrecipeに保存済みの`generation_config`を維持するため、新規POST以外にAPI変更は不要。

- [ ] **Step 5: 親から分析シグネチャを渡す**

```tsx
<KeywordPromptBatchPanel
  analysisSignature={analysisSignature}
  {...existingProps}
/>
```

- [ ] **Step 6: 対象テストを通す**

Run: `npm.cmd test -- --run src/utils/ai/promptRecipeScope.test.ts src/app/projects/[id]/design-studio-auto/components/KeywordPromptBatchPanel.test.tsx src/app/projects/[id]/design-studio-auto/components/DesignStudioAutoClient.test.tsx`

Expected: PASS.

- [ ] **Step 7: Task 2をコミットする**

```bash
git add etsy-product-ai/src/app/projects/[id]/design-studio-auto/components/KeywordPromptBatchPanel.tsx etsy-product-ai/src/app/projects/[id]/design-studio-auto/components/KeywordPromptBatchPanel.test.tsx etsy-product-ai/src/app/projects/[id]/design-studio-auto/components/DesignStudioAutoClient.tsx
git commit -m "fix: isolate prompts by keyword set"
```

---

### Task 3: 統合回帰と生成リクエスト確認

**Files:**
- Modify if needed: `etsy-product-ai/src/app/projects/[id]/design-studio-auto/components/KeywordPromptBatchPanel.test.tsx`

**Interfaces:**
- Verifies: POST `/api/prompt-recipes` carries the exact scope used for rendering and resumption.

- [ ] **Step 1: POST本文の回帰テストを追加する**

```ts
expect(recipeBody.generationConfig).toMatchObject({
  sourceScopeKey: 'snapshot:set-b',
  keywordFingerprint: '["breast cancer awareness shirt"]',
})
```

- [ ] **Step 2: 対象回帰を実行する**

Run: `npm.cmd test -- --run src/utils/ai/promptRecipeScope.test.ts src/app/projects/[id]/design-studio-auto/components/KeywordPromptBatchPanel.test.tsx src/app/projects/[id]/design-studio-auto/components/DesignStudioAutoClient.test.tsx`

Expected: PASS.

- [ ] **Step 3: 全体検証を実行する**

Run: `npm.cmd test -- --run --exclude .worktrees/**`

Run: `npm.cmd run lint`

Run: `npm.cmd run build`

Run: `git diff --check`

Expected: tests PASS; lint has no new errors; build completes; diff check is clean. Existing unrelated failures must be reported separately and not repaired.

- [ ] **Step 4: Task 3をコミットする**

```bash
git add etsy-product-ai/src/app/projects/[id]/design-studio-auto/components/KeywordPromptBatchPanel.test.tsx
git commit -m "test: cover keyword prompt isolation"
```

