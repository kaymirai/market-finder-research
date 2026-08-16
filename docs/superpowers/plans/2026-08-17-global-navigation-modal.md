# Global Navigation Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Future Designerの内部ページ遷移とログイン送信中に、連打を防ぐ共通の全画面読み込みモーダルを表示する。

**Architecture:** ルートレイアウト直下にナビゲーション状態Providerを置き、通常の内部リンクはdocumentのclickイベントで一元検知する。ログイン・新規登録は`useFormStatus`を使う専用ボタンから同じProviderへ送信状態を通知し、既存`WorkspaceShell`の専用オーバーレイは削除する。

**Tech Stack:** Next.js App Router、React、TypeScript、Vitest、jsdom

## Global Constraints

- 同一オリジンの通常の内部リンクだけを対象にする。
- 修飾キー、新規タブ、ダウンロード、ページ内アンカー、同じURL、外部リンク、キャンセル済みクリックは対象外にする。
- URL変更または15秒の上限時間でモーダルを解除する。
- ログイン・新規登録は入力検証を通過し、実際に送信状態になった場合だけ表示する。
- 既存の未保存確認を維持し、共通モーダルを二重表示しない。

---

### Task 1: 共通ナビゲーション状態とオーバーレイ

**Files:**
- Create: `etsy-product-ai/src/components/navigation/NavigationProgressProvider.tsx`
- Test: `etsy-product-ai/src/components/navigation/NavigationProgressProvider.test.tsx`

**Interfaces:**
- Produces: `NavigationProgressProvider({ children })`
- Produces: `useNavigationProgress(): { startNavigation(): void; stopNavigation(): void; isNavigating: boolean }`

- [ ] **Step 1: 内部リンク判定の失敗テストを書く**

```tsx
it('shows for a same-origin route and ignores cancelled or external clicks', async () => {
  renderProvider(<><a href="/dashboard">移動</a><a href="https://example.com">外部</a></>)
  click('移動')
  expect(screen()).toContain('読み込み中')
  stopNavigation()
  click('外部')
  expect(screen()).not.toContain('読み込み中')
})
```

同じURL、hash、`target="_blank"`、`download`、Ctrl/Meta/Shift/Altクリック、`preventDefault()`済みクリックも個別に期待値へ含める。

- [ ] **Step 2: 対象テストを実行して失敗を確認する**

Run: `npm.cmd test -- --run src/components/navigation/NavigationProgressProvider.test.tsx`

Expected: FAIL because `NavigationProgressProvider` does not exist.

- [ ] **Step 3: Providerとリンク検知を最小実装する**

```tsx
type NavigationProgressContextValue = {
  isNavigating: boolean
  startNavigation: () => void
  stopNavigation: () => void
}

function shouldStartForAnchor(event: MouseEvent, anchor: HTMLAnchorElement) {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  if (anchor.target && anchor.target !== '_self') return false
  if (anchor.hasAttribute('download')) return false
  const next = new URL(anchor.href, window.location.href)
  const current = new URL(window.location.href)
  if (next.origin !== current.origin) return false
  if (next.href === current.href) return false
  if (`${next.pathname}${next.search}` === `${current.pathname}${current.search}` && next.hash) return false
  return true
}
```

documentのbubble段階で`closest('a[href]')`を判定し、開始時に15秒タイマーを設定する。オーバーレイは`role="status"`、`aria-live="polite"`、`z-[300]`を持たせる。

- [ ] **Step 4: URL変更とタイムアウト解除テストを追加する**

```tsx
it('clears after route observation or timeout', async () => {
  startNavigation()
  rerenderAt('/projects/1/event')
  expect(screen()).not.toContain('読み込み中')
  startNavigation()
  vi.advanceTimersByTime(15_000)
  expect(screen()).not.toContain('読み込み中')
})
```

- [ ] **Step 5: 対象テストを通す**

Run: `npm.cmd test -- --run src/components/navigation/NavigationProgressProvider.test.tsx`

Expected: PASS.

- [ ] **Step 6: Task 1をコミットする**

```bash
git add etsy-product-ai/src/components/navigation/NavigationProgressProvider.tsx etsy-product-ai/src/components/navigation/NavigationProgressProvider.test.tsx
git commit -m "feat: add global navigation progress"
```

---

### Task 2: ルートレイアウトとWorkspaceShellの統合

**Files:**
- Modify: `etsy-product-ai/src/app/layout.tsx:1-41`
- Modify: `etsy-product-ai/src/components/WorkspaceShell.tsx:1-144,318-323`
- Test: `etsy-product-ai/src/components/WorkspaceShell.navigation.test.tsx`

**Interfaces:**
- Consumes: `NavigationProgressProvider`
- Preserves: `handleNavClick(event)`の同一URL防止と未保存確認

- [ ] **Step 1: Shellのキャンセルが共通モーダルを開始しない失敗テストを書く**

```tsx
it('does not start progress when unsaved navigation is cancelled', async () => {
  window.dispatchEvent(new CustomEvent('mirai-unsaved-state', { detail: { hasUnsaved: true, message: '確認' } }))
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  clickLink('2. キーワードセットを作る')
  expect(document.body.textContent).not.toContain('読み込み中')
})
```

- [ ] **Step 2: テストを実行して既存の専用表示との競合を確認する**

Run: `npm.cmd test -- --run src/components/WorkspaceShell.navigation.test.tsx`

Expected: FAIL until the root provider and Shell cleanup are wired.

- [ ] **Step 3: ルートにProviderを追加し、Shellのローカル遷移状態を削除する**

```tsx
<body>
  <NavigationProgressProvider>
    <Header />
    <main>{children}</main>
    <footer>...</footer>
  </NavigationProgressProvider>
</body>
```

`WorkspaceShell`から`isNavigating`、8秒タイマー、専用overlayを削除する。`handleNavClick`は同一URLの`preventDefault`、未保存確認、サイドバーを閉じる処理だけ残す。

- [ ] **Step 4: ShellとProviderの対象テストを通す**

Run: `npm.cmd test -- --run src/components/navigation/NavigationProgressProvider.test.tsx src/components/WorkspaceShell.navigation.test.tsx`

Expected: PASS and only one `読み込み中` overlay.

- [ ] **Step 5: Task 2をコミットする**

```bash
git add etsy-product-ai/src/app/layout.tsx etsy-product-ai/src/components/WorkspaceShell.tsx etsy-product-ai/src/components/WorkspaceShell.navigation.test.tsx
git commit -m "fix: unify workspace navigation feedback"
```

---

### Task 3: ログインと新規登録の送信状態

**Files:**
- Create: `etsy-product-ai/src/components/navigation/NavigationSubmitButton.tsx`
- Test: `etsy-product-ai/src/components/navigation/NavigationSubmitButton.test.tsx`
- Modify: `etsy-product-ai/src/app/login/page.tsx:84-116`

**Interfaces:**
- Consumes: `useNavigationProgress()`
- Produces: `NavigationSubmitButton` accepting native button props and a Server Action compatible `formAction`

- [ ] **Step 1: pending時だけ開始・解除する失敗テストを書く**

```tsx
it('starts while the parent form is pending and disables repeated submit', async () => {
  renderPendingForm(<NavigationSubmitButton>ログイン</NavigationSubmitButton>)
  submitValidForm()
  expect(button()).toBeDisabled()
  expect(document.body.textContent).toContain('読み込み中')
  resolveAction()
  expect(document.body.textContent).not.toContain('読み込み中')
})
```

- [ ] **Step 2: 対象テストの失敗を確認する**

Run: `npm.cmd test -- --run src/components/navigation/NavigationSubmitButton.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: `useFormStatus`連携ボタンを実装する**

```tsx
const { pending } = useFormStatus()
const { startNavigation, stopNavigation } = useNavigationProgress()
useEffect(() => {
  if (pending) startNavigation()
  else stopNavigation()
  return stopNavigation
}, [pending, startNavigation, stopNavigation])
return <button {...props} disabled={pending || props.disabled} />
```

- [ ] **Step 4: ログイン画面の2ボタンを置換する**

`ログイン`と`新規登録`の`formAction`とclassNameは維持し、`NavigationSubmitButton`へ置き換える。ブラウザのrequired検証を通らない操作ではform pendingにならないため、モーダルも開始しない。

- [ ] **Step 5: ナビゲーション関連の対象テストを通す**

Run: `npm.cmd test -- --run src/components/navigation/NavigationProgressProvider.test.tsx src/components/navigation/NavigationSubmitButton.test.tsx src/components/WorkspaceShell.navigation.test.tsx`

Expected: PASS.

- [ ] **Step 6: Task 3をコミットする**

```bash
git add etsy-product-ai/src/components/navigation/NavigationSubmitButton.tsx etsy-product-ai/src/components/navigation/NavigationSubmitButton.test.tsx etsy-product-ai/src/app/login/page.tsx
git commit -m "fix: show progress during authentication"
```

