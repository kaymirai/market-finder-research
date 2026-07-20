# Guided Entry Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Market Finderの開始方法と最初の操作を一意にし、初期画面から迷わず候補探索を開始できるようにする。

**Architecture:** 既存の静的HTML、CSS、`setFlowMode()`を維持しながら、開始方法のボタンをラジオ入力へ置き換える。探索ロジックや保存データ形式は変更せず、表示構造、選択同期、文言だけを対象にする。

**Tech Stack:** HTML、CSS、vanilla JavaScript、Node.js組み込みテスト

## Global Constraints

- 自動探索の操作名は「候補を自動で探す」に統一する。
- 上部の4段階説明帯は削除し、番号は本文セクションだけに残す。
- 新しい依存パッケージは追加しない。
- CSVモードと保存済みの`flowMode`を維持する。
- 既存のMarket Finderの配色と8px以下の角丸を維持する。

---

### Task 1: UI構造の回帰テスト

**Files:**
- Create: `market-finder/scripts/test-guided-entry-ui.mjs`

**Interfaces:**
- Consumes: `market-finder/index.html`, `market-finder/src/app.js`, `market-finder/styles.css`
- Produces: HTML構造、文言、ラジオ同期を検査するNodeテスト

- [ ] テストを作成し、現行画面で期待どおり失敗することを確認する。
- [ ] 実装後に同じテストが通ることを確認する。

### Task 2: 入口の一本化

**Files:**
- Modify: `market-finder/index.html`
- Modify: `market-finder/styles.css`
- Modify: `market-finder/src/app.js`

**Interfaces:**
- Consumes: 既存の`setFlowMode(mode, options)`と`flowMode`永続化
- Produces: ラジオ選択と一致する`body.flow-auto` / `body.flow-csv`表示

- [ ] 上部の`workflow-strip`を削除する。
- [ ] `flowAutoBtn`と`flowCsvBtn`を同名グループのラジオ入力へ変更する。
- [ ] `setFlowMode()`で`checked`と選択ラベルの状態を同期する。
- [ ] 商品、イベント、主ボタンの順にHTMLを並べ替える。
- [ ] 年入力を主ボタンの後ろにある任意項目へ移す。
- [ ] 旧ボタン名を「候補を自動で探す」に統一する。

### Task 3: 検証

**Files:**
- Modify: `market-finder/index.html` cache query only

**Interfaces:**
- Consumes: 完成したHTML、CSS、JavaScript
- Produces: 再読み込み後の検証済み画面

- [ ] `node market-finder/scripts/test-guided-entry-ui.mjs`を実行する。
- [ ] `node --check market-finder/src/app.js`を実行する。
- [ ] 既存の共有エンジンテストと`git diff --check`を実行する。
- [ ] 実ブラウザを再読み込みし、デスクトップとモバイルで初期表示、ラジオ切替、開始ボタンを確認する。
