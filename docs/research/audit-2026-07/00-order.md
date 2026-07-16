# 横断アーキテクチャ + コード品質監査 発注書（2026-07、Codex 実行）

> **これは監査の固定仕様（durable spec）。全 session の冒頭で本ファイルと [manifest.md](manifest.md) を読むこと。**
> 発注元: Coordinator（Fable）。Risk: R1（read-only 監査、成果物は docs のみ、runtime contract 無変更）。

## 目的

Goal Invariant: **「5 年間、記憶のない書き手たちが安全に触り続けられるコードか」を検証し、証拠付き findings と優先度付き是正リストを残す。**
この監査は roadmap（Plans.md 次の行動 1-2）の一部で、結果は品質是正 PR 群（roadmap 1-3）と業務シナリオ受入テスト（1-4）の重点決定の入力になる。

## 絶対制約（暴走防止、違反 = 監査失敗）

1. **read-only**: `src/` `src-tauri/` への変更は一切禁止。修正・リファクタ・「ついでの改善」をしない。書いてよいのは `docs/research/audit-2026-07/` 配下のみ
2. **件数目標・スコア・グレード禁止**: 「N 件見つける」「A〜E 評価」等の指標を自分に課さない。**指摘ゼロは正当な結果**であり、work package が clean ならそう記録して次へ進む
3. **finding の成立条件**: 全 finding に (a) `file:line` の証拠、(b) 具体的な害の経路 — 変更コスト増 / 回帰リスク / 読み手の混乱 / 一貫性破壊のどれがどう起きるか — を必須とする。害を 1 文で言語化できない指摘は記録しない
4. **新しい抽象の設計をしない**: 提案方向は 1 行まで（例:「共通部品化の候補」）。設計は是正 PR 側の仕事
5. package の scope 外で気づいた事項は該当 package の findings に書かず、manifest の「越境メモ」に 1 行残して先へ進む

## 監査基準（この順で適用）

**第一基準 = この repo 自身の規範**（違反は事実であり哲学ではない）:

- 層の一方向原則 UI → CMD → BIZ → IO/MNT: `docs/ARCHITECTURE.md`
- error handling 規約（層別エラー型、握りつぶし禁止、catch-all 禁止）: `.claude/rules/implementation-quality.md`
- レビュー観点の正本: `.agents/skills/engineering-review/SKILL.md`（Google Engineering Practices を SSOT 指定）+ `.agents/skills/inventory-code-review/SKILL.md`
- UI 品質・部品規範: `docs/design-system/`（component catalog）、`docs/UI_TECH_STACK.md`、`docs/SCREEN_DESIGN.md`
- 各画面・各層の関数設計: `docs/function-design/`（実装が設計正本から drift していないか）

**第二基準 = 外部正典の最大公約数**（補助線。数値ルールは不採用）:

- 依存は少なく・浅く（結合の低さ）
- 同じ知識は一箇所に — ただし「重複は間違った抽象より安い」の留保付き
- 読み手の驚き最小化（同じ問題は repo 内で同じ形で解かれているか）
- 消しやすさ（ある機能を消すとき、変更が局所で済むか）

## finding 記録形式（findings/<package>.md に追記）

```
### <PKG>-<連番>: <1 行要約>
- 観点: <package の観点>
- 証拠: <file:line>（複数可）
- 害の経路: <変更コスト増 / 回帰リスク / 読み手の混乱 / 一貫性破壊> — <具体的に 1-3 文>
- repo 規範との対照: <どの規範・設計正本に照らしたか。規範側に記述がない場合「規範未定義」と書く — それ自体が finding>
- 提案方向: <1 行まで。設計しない>
- 想定労力: S / M / L
- 確度: 確実 / 要検証（要検証 = 動作確認しないと断定できないもの）
```

## 進め方（1 package = 1 checkpoint）

1. session 開始時: 本ファイル → `manifest.md` の順に読む
2. manifest の未消化 package を**上から 1 つ**取る（並行しない、飛ばさない。飛ばす理由があるなら manifest に理由を書いて次へ）
3. package の scope を読み、findings を `findings/<package>.md` に書く（指摘ゼロなら「clean、確認範囲: …」を書く）
4. manifest のチェックを付け、進捗 log に 1 行（日時 / package / findings 件数 / 特記）
5. `git add docs/research/audit-2026-07/ && git commit -m "docs(audit): <package> 完了"` で checkpoint
6. 次の package へ。**session が切れても損失は現 package のみ** — 新 session は手順 1 から再開する

## 環境（session 冒頭で毎回確認、不一致なら停止して報告）

- 作業ディレクトリ: `/home/kosei/Projects/inventory-system-public`（public-writer clone。`~/Projects/inventory-system` は history-view 専用、そちらなら停止）
- `git remote get-url origin` = `https://github.com/kosei-w90607/inventory-system-public.git`（SSH 形式も可、repo 名が `inventory-system-public` であること）
- ブランチ: `agent/arch-audit-2026-07`
- 検証コマンドの実行は可（`npm test` / `cargo test` / `rg` / LSP 等の read 系）。install 系・`npm audit fix`・依存変更は禁止
