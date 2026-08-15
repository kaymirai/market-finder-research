# エージェントをゲームカード化するための指示書

この指示書は、Codexのチャットに貼って「エージェント1人1枚のゲームカード風画像」を作るためのものです。

## 基本方針

- 1人につき1枚の縦長カードにする
- 名前だけ英字、説明は日本語にする
- カードゲームらしく、レア度・HP・能力値・スキル・必殺技を入れる
- テイストは上品なファンタジーカード
- ドット絵、RPG画面、既存ゲーム風のUIには寄せすぎない
- 有名作品や既存キャラクターに似せない

## Codexに貼る指示

以下をそのまま貼って使います。

```text
エージェントを1人1枚のゲームカード風画像にしてください。

目的:
Codexチームのメンバー紹介用カードを作りたいです。
1枚ずつ、縦長のファンタジー系コレクションカードとして作ってください。

重要:
こちらから肩書き・職業・能力値・見た目・スキル名を細かく指定するのではなく、
エージェント名と担当内容を読んで、そのキャラクターに合う設定をあなたが考えてください。
カードに必要な要素を、エージェントの役割から自然に設計してください。

あなたが決めること:
- 肩書き
- レア度
- HP
- 能力値
- スキル名
- 必殺技名
- 担当の短い表現
- 見た目、服装、持ち物、背景モチーフ
- カード全体の雰囲気

画像の方向性:
- 上品なファンタジートレーディングカード
- 魔法・研究・戦略・知性を感じる雰囲気
- 高級感のある羊皮紙、金装飾、魔法陣、地図、設計図、星座線など
- ゲーム風にしすぎず、チーム紹介として見せられるデザイン
- ドット絵、アニメ風、既存ゲーム風のUIにはしない

文字:
- 名前だけ英字
- それ以外は日本語
- 文字は大きく、読みやすく、枠から切れないようにする
- 余計な文字は入れない

カードに入れる項目:
- 名前
- 肩書き
- レア度
- HP
- 能力値
- スキル
- 必殺技
- 担当

入力:
以下のエージェントをカード化してください。
まだ名前と担当内容が渡されていない場合は、画像を作る前に
「カード化したいエージェント名と担当内容を教えてください」と確認してください。

名前: [AGENT_NAME]
担当内容:
[ROLE_DESCRIPTION]

作業手順:
1. まず、このエージェントに合うカード設定を短く考えてください。
2. 肩書き、レア度、HP、能力値、スキル、必殺技、担当を決めてください。
3. その設定に合う職業キャラの見た目を考えてください。
4. その後、画像生成プロンプトを作り、カード画像を生成してください。

出力してほしいもの:
- まず決めたカード設定
- その設定で作ったカード画像
- 使った画像生成プロンプト

画像生成プロンプトを作る時の形式:

Create one premium vertical fantasy collectible card for an AI research team member, with readable Japanese game-card UI stats.

Card text must be readable and spelled exactly:
Top title: "[NAME]"
Subtitle: "[肩書き]"
Rarity badge: "[レア度]"
Stats panel:
"HP [数値]"
"[能力値1] [数値]"
"[能力値2] [数値]"
Skill box:
"スキル：[スキル名]"
Special move box:
"必殺：[必殺技名]"
Bottom role line:
"担当：[担当]"

Visual style: elegant fantasy trading card, premium collectible card, magical but professional, not pixel art, not anime fan art. Ornate gold frame, parchment panels, arcane diagrams, subtle constellation map motifs, high-end card design.

Character art:
Create an original character whose profession, clothes, tools, expression, and background motifs match the agent's role.
The character should visually communicate what this agent does.
Do not use a generic wizard unless it fits the role.
Use role-specific symbols, tools, colors, and posture.

Composition: vertical trading-card layout. Keep the text in separate clean panels, high contrast dark text on light parchment panels. Put rarity badge near top right. Put stats in a compact panel on one side or lower middle. Put skill and special move in clear boxes near the bottom. Do not let text overlap the character. Leave generous margins.

Mood:
Match the mood to the agent's role.
For strategy agents, wise and visionary.
For research agents, observant and analytical.
For build agents, technical and energetic.
For review agents, strict and protective.

Constraints:
no extra text beyond the specified card text, no logo, no watermark, no misspellings, no famous characters, no copied game UI.
```

## 使い方

上の指示を貼ったあと、別メッセージでカード化したいエージェントを渡します。

```text
名前: PLATO
担当内容:
全体像を描き、プロジェクトの構想・設計・方向性を整理する。
複雑な話を大きな構造にまとめ、チームが迷わないようにする。
```

この場合、Codex側がPLATOに合う肩書き、レア度、能力値、スキル、必殺技、職業キャラを考えてから画像を作ります。

## ほかのエージェント用に渡す情報

ユーザーが毎回全部考える必要はありません。
基本は、次の2つだけ渡せばOKです。

```text
名前:
担当内容:
```

Codex側に考えさせたい場合は、こう書きます。

```text
このエージェントの担当内容から、カードゲーム風の職業キャラを考えてください。
肩書き、レア度、HP、能力値、スキル、必殺技、担当、見た目はあなたが決めてください。

名前: CARSON
担当内容:
危険な語句、商標リスク、著作権リスク、避けるべきキーワードを見つける。
マーケットリサーチの中で、安全に攻められる範囲を見極める。
```

## 19人分を作る時の注意

- 一度に19枚を作るより、まず1枚ずつ作る
- 文字が崩れたら、文字量を減らす
- 日本語が崩れる場合は、画像は文字なしで作り、あとから文字を合成する
- レア度やHPは厳密な強弱ではなく、キャラクター性を出すための演出として使う
- 似た役割のエージェントでも、見た目・武器・道具・色を変えて個性を出す
- カード化する前に、Codexに「この設定でよいか」を一度見せてもらうと失敗しにくい

## おすすめの能力値

- 思考力: 戦略、設計、分析が得意な人
- 調査力: 情報収集、画面確認、検索が得意な人
- 実装力: コード、連携、自動化が得意な人
- 検証力: バグ、矛盾、リスクを見つける人
- 調整力: 方針整理、優先順位、ユーザー目線が得意な人

## 担当内容からカード設定を考えるルール

Codexは、担当内容を読んで以下のように変換します。

```text
市場・方向性・優先順位を決める人
=> 戦略家、設計者、参謀、地図職人、星読み

検索・画面確認・データ収集をする人
=> 調査官、斥候、観測者、記録者、分類学者

コード・連携・自動化を作る人
=> 技師、発明家、錬金術師、機械術師、接続師

リスク・矛盾・品質を見る人
=> 審判、守護者、監査官、反証者、結界師

ユーザー体験・わかりやすさを見る人
=> 案内人、翻訳者、導線設計士、旅のガイド
```

## 19人カード化の入力例

```text
以下の19人を、1人1枚のゲームカード風画像にしてください。
肩書き、レア度、HP、能力値、スキル、必殺技、見た目は、それぞれの担当内容からあなたが考えてください。

Epicurus: 使いやすさ、迷わない導線、体験の気持ちよさを見る
Carson: リスク語句、商標、著作権、安全性を監視する
Schrodinger: 不確実な点、未取得データ、判断保留の理由を調べる
Erdos: 数値、スコア、閾値、計算ロジックを設計する
Parfit: 権利・倫理・長期的な安全性を確認する
Linnaeus: キーワード、商品カテゴリ、素材、タグを分類する
Plato: 全体構想、設計思想、方向性を整理する
Kuhn: 前提を疑い、戦略を大きく見直す
Aristotle: 仕様、手順、画面の構造を整理する
Lovelace: 自動化、コード、Chrome連携を組み立てる
Sagan: 初心者にもわかるように説明する
Popper: 仮説を反証し、根拠の弱い判断を見つける
Anscombe: 目的、意図、使う理由を確認する
Ampere: 接続、速度、通信、実行安定性を見る
Hegel: 対立する案を統合し、よりよい方針にまとめる
James: 実際に使えるか、現場目線で判断する
Mill: 効果とコストを比べ、優先順位を決める
Pauli: 甘い判断や雑な根拠を厳しくチェックする
Galileo: 実画面、実データ、観測結果を確認する
```
