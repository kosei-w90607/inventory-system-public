# Phase 2 着手前 書類整備プラン（SCREEN_DESIGN / PROJECT_HANDOFF / DEV_SETUP_CHECKLIST）

> **配置ルール**: 本プランは memory `feedback-active-plan-in-docs.md` 規定に従い、plan mode 抜けた直後の最初の commit 前に `docs/plans/dynamic-swinging-cake.md` へコピー（または `docs/plans/pre-phase-2-docs-sync.md` にリネーム）し、以降はそちらを正ソースとする。
>
> **最終更新**: 2026-05-08

---

## 1. Context

Phase 1 UI 基盤（Task 7-1 〜 7-5c + 7-9 + 7-10）は PR #52 マージ完了（merge commit `0ed76ca`、2026-04-22）。次は Phase 2 8-1 UI-00 ホーム画面の実装 PR 着手。**毎日使う画面の実装に入る前のいい区切り**で、Phase 1 中に確定した設計判断（ADR-001〜004 / 4 エリア × 19 項目 navigation / stone palette / env 設計原則 §6.9 等）を引継ぎ書類に反映しておく。

**やる動機**:
- 設計↔実装の二度手間を減らす（Phase 2 入った後で書類更新だと実装中に齟齬発見コスト発生）
- 引継ぎ書類が 1.5 ヶ月放置のものがあり、ポートフォリオ価値・次セッション復元コスト両面で劣化中
- DEV_SETUP_CHECKLIST.md は前提（Docker 完結 → WSL2 移行）が memory `dev-environment-policy.md` と齟齬

**やらない動機**:
- Phase 2 以降の予測込みリライト（実装してから書く方が精度高い）
- 直近更新済みファイル（UI_TECH_STACK.md / FUNCTION_DESIGN.md / ARCHITECTURE.md / DB_DESIGN.md）の重複編集

---

## 2. Scope

| ファイル | 状態 | 更新タイプ | PR | 工数見積 |
|---|---|---|---|---|
| SCREEN_DESIGN.md | 2026-03-21、5週間放置 | Phase 1 確定事項を本文反映 | **PR-A** | 1-2h |
| PROJECT_HANDOFF.md | 2026-04-03、1.5ヶ月放置 | 現在地 + 経緯ログ更新 | **PR-A** | 30min-1h |
| DEV_SETUP_CHECKLIST.md | 2026-03-31、Docker 前提齟齬 | 実質書き直し（WSL2 ベース転換 + Phase 1〜7 統合） | **PR-B** | 3-4h |

**含めない（直近更新済 or 別タスク）**:
- UI_TECH_STACK.md（4/22 更新済）
- FUNCTION_DESIGN.md（4/21 UI-12 反映済）
- ARCHITECTURE.md（4/14 UI-00/13 追記済）
- DB_DESIGN.md（4/14、変更なし）
- UI_DEV_WORKFLOW.md 新規作成（Plans.md Task 7-11、Phase 2 実装と並走で書く方が精度高い）

---

## 3. PR-A: SCREEN_DESIGN.md + PROJECT_HANDOFF.md

### 3.1 SCREEN_DESIGN.md 更新項目

**§1 画面一覧**:
- 「毎日使う」5 画面の状態列を `ラフ完了` → `Phase 2 実装着手予定`（UI-00 のみ「実装プラン合意済」）に更新
- ARCHITECTURE.md UI-00（ホーム画面）+ UI-13（整合性検証）の追加を反映（UI-00 は §1 既存、UI-13 を §1 「年に数回 / 初回のみ」セクションに追加）

**§2 画面遷移の構造**:
- §2 注記の「色分け廃止」は本文に反映済み（§2 全体注記 + 緑/青/オレンジ/黄の色名は履歴として残す）→ 維持
- 4 エリア × 19 項目の最終確定形を `docs/archive/plans/2026-04-21-ui-12-design-agreement.md` 経由で参照しているが、navigation 定数の実装場所（`src/config/navigation.ts`）への参照を 1 行追加

**§3 画面ごとの設計判断ログ**:
- 「日次/月次レポートのタブ統合」セクション末尾の 2026-04-21 更新は反映済み → 維持
- 他の画面は概ね最新で OK、Phase 2 実装着手後に追記（今回は触らない）

**§4 設計中の気付き・未決事項**:
- 「ホーム画面の情報量バランス」`「最後にCSV取込みした日の売上」か「前営業日の売上」か → 設計時に確定` → `docs/plans/phase-2-ui-00.md` で確定済の判断を要約して反映（commit-0 プランの Q-1 〜 Q-3 結果）
- 「表記統一」「独自コードの認知負荷」は実装時判断項目として維持

**§5 今後の作業**:
- 「次に作るべき画面（優先順）」を Phase 2 / Phase 3 / Phase 4 のフェーズ分類に再構成（Plans.md 第8〜10段階と整合）
- 「利用者への確認に使う画面」の 3 画面を Phase 2 8-0 ゲートと明示的に紐付け

**§6 新規（追加）**:
- Phase 1 で確定した UI 実装上の制約事項を 1 セクション追加:
  - stone palette + warm tones（UI_TECH_STACK §4.1 参照）
  - Tauri 2 on Linux IME 制約（Phase 2 以降 Windows native 移行、memory `tauri2-linux-ime-limitation.md`）
  - URL 設計の本質（`memory/feedback-desktop-app-url-design.md`、状態の URL 化）
  - ウィンドウタイトル動的更新（`memory/feedback-desktop-window-title-dynamic.md`）

**最終更新**: `2026-03-21` → `2026-05-08 / Phase 2 着手前 同期（Phase 1 確定事項反映）`

### 3.2 PROJECT_HANDOFF.md 更新項目

**§2 現在地**:
- フェーズ表記: `要求仕様書: 完成 → 技術スタック確定 → 画面設計完了 → 詳細設計フェーズへ移行` → `要求仕様書 / 詳細設計 / バックエンド全層完了 → UI 基盤 Phase 1 完了 → Phase 2 毎日使う5画面 着手前`
- 直近の作業状態を Phase 1 完了状態に更新
- 「次にやるべきこと」優先度 E-1〜E-4 を `[x]` にチェック、新規に「優先度 F: UI 基盤」「優先度 G: Phase 2 着手」を追加

**§3 成果物一覧**:
- FUNCTION_DESIGN.md の進捗注記を「第1〜第4段階 + 第7段階 UI 基盤」に更新
- UI_TECH_STACK.md（4/16 新規）/ DEV_SETUP_CHECKLIST.md / DOC_STYLE_GUIDE.md / docs/research/ 配下 ADR-001〜004 を成果物表に追加

**§N 経緯ログ**:
- セッション #4 〜 #N（v0.1.0-db-layer 〜 v0.6.0 + Phase 1 PR #42〜#52）を経緯ログに 1 段落ずつ追記
  - v0.1.0-db-layer / v0.2.0-product-crud / v0.3.0-inventory-backend / v0.4.0-pos-integration / v0.5.0 / v0.6.0 のタグ単位で要点記述
  - Phase B-1 (PR #44/#45/#46) / 7-3 UI-12 (PR #50) / 7-5c invoke ラッパ (PR #48) / 7-9 + 7-10 (PR #52) を Phase 1 ハイライトとして記述
- 詳細は `Plans.md` と `docs/archive/v0_tag_history.md` に集約済みなので、handoff には要点のみ記述してリンクを張る

**最終更新**: `2026-04-03 / 会話セッション#3` → `2026-05-08 / Phase 2 着手前 同期（バックエンド全層 + UI 基盤 Phase 1 完了反映）`

### 3.3 PR-A の commit 分割

```
commit 1: docs(handoff): Phase 1 完了状態反映 + 経緯ログ追記
commit 2: docs(screen-design): Phase 1 確定事項反映 + §6 UI 実装制約セクション追加
commit 3: (任意) docs: 軽微な typo / リンク修正
```

合計 2-3 commit、PR description で「PR-B 別出し」を明記。

---

## 4. PR-B: DEV_SETUP_CHECKLIST.md（書き直し）

### 4.1 全面書き直しの方針

**現状**: §1 `第1〜第2段階（Docker完結）` / §1 `UI実装フェーズ以降（WSL2直接に移行）` / §3〜§10 が Docker 中心、§11〜§12 が第1〜第2段階の TODO リスト。**前提が memory `dev-environment-policy.md`（WSL2 直接開発採用、Docker 不使用）と完全に齟齬**。

**新構成（提案）**:

```
§1 環境構成
  - WSL2 直接開発（現実態）
  - Docker は退役（経緯ログとして §A.1 退役記録に保存）
  - 必要ツール一覧（Rust 1.83+ / Node.js 20 / WebView2 / Tauri 2.0 deps）

§2 前提条件（既に構築済みのはず）
  - WSL2 / Ubuntu / Claude Code / Git / GitHub アカウント
  - Docker Desktop は不要に変更

§3 リポジトリクローン + Git hook セットアップ
  - 既存内容（pre-push + lefthook）を保持

§4 WSL2 直接開発環境セットアップ
  - 旧 §10 を §4 に昇格、Docker 関連を削除
  - 追加: WSL2 + Tauri 2 on Linux IME 制約（Phase 2 から Windows native 移行、根拠リンク）

§5 Tauri プロジェクト初期化（参考、Phase 7 で完了済み）
  - 旧 §5 を縮小、create-tauri-app 手順は履歴として残す
  - 新規環境への再構築時のみ参照

§6 第1段階完了チェック（v0.1.0-db-layer 完了済み）
§7 第2段階完了チェック（v0.2.0-product-crud 完了済み）
§8 第3段階完了チェック（v0.3.0-inventory-backend 完了済み）
§9 第4段階完了チェック（v0.4.0-pos-integration 完了済み）
§10 第5段階完了チェック（v0.5.0 完了済み）
§11 第6段階完了チェック（v0.6.0 完了済み）
  - 各段階の cargo test カウント、git tag、主要 PR 番号を記録
  - チェックボックスは `[x]` で完了

§12 第7段階 Phase 1: UI 基盤構築（進行中）— 新規
  - 7-1 Tailwind CSS 4 [x]
  - 7-2 shadcn/ui [x]
  - 7-3 UI-12 共通レイアウト [x]
  - 7-4 ルーティング (TanStack Router) [x]
  - 7-5a/b/c invoke + Query 基盤 [x]
  - 7-9 seed-demo-data [x]
  - 7-10 .env 構成 [x]
  - 7-6 Storybook 判断 [ ]
  - 7-7 Vitest 初期化 [ ]
  - 7-8a Error Boundary 戦略 [ ]
  - 7-8b 横断UI標準化 [ ]
  - 7-8c unsaved changes ガード [ ]
  - 7-11 UI 開発 workflow 文書化 [ ]
  - タグ目標: v0.7.0-ui-foundation [ ]

§13 第8段階 Phase 2: 毎日使う5画面（着手予定）— 新規
  - 8-1 〜 8-9 を Plans.md と整合する形で記載

§14 Phase 3 / Phase 4（参考、UI_TECH_STACK §7.2 の判定事項リンク）

§A.1 退役記録: Docker 完結方針（2026-03-31 → 2026-04-03 退役）
  - 経緯（DOCKER_REPAIR_LOG.md 参照）
  - WSL2 直接開発移行の根拠（memory `dev-environment-policy.md`）
```

### 4.2 PR-B の commit 分割

```
commit 1: docs(checklist): WSL2 ベース転換（§1〜§5 書き直し、Docker は §A.1 退役記録に移動）
commit 2: docs(checklist): Phase 1〜6 完了チェック反映（§6〜§11、各段階の tag/PR/test count 記録）
commit 3: docs(checklist): Phase 7 UI 基盤 + Phase 8 Phase 2 着手予定 追加（§12〜§13）
commit 4: docs(checklist): Phase 3/4 参考セクション + 索引整備（§14）
commit 5: (Codex round 1 対応分、必要に応じて)
```

合計 4-5 commit、PR description で前提転換を明示。

---

## 5. PR 戦略・実行順序

> **2026-05-08 確定**: 当初 §5.1 は「同期 PR 独立」だったが、`docs/plans/phase-2-ui-00-commit-0.md` の前回判断「Plans.md 同期専用 PR 廃止 → 次の PR commit 0 に統合」を新構成に適用し、**同期作業は PR-A の commit 0 に折り畳む 2 PR 体制**で確定。memory `feedback-plans-sync-commit-milestone-only.md`（Plans.md 更新は節目のみ commit）とも整合。Codex レビューサイクル 1 回節約見込み。

### 5.1 PR-A: 同期 commit 0 + SCREEN_DESIGN + PROJECT_HANDOFF

**commit 0（同期作業）**:
- `Plans.md` 更新（PR #52 完了反映 + UI-00 プラン合意状態 + 本プラン参照追加）
- `CLAUDE.md` 追加行（プロジェクト外保存禁止、2026-04-22 追加）
- `docs/plans/phase-2-ui-00.md` 新規 add（UI-00 実装プラン本体）
- `docs/plans/phase-2-ui-00-commit-0.md` 新規 add（L57-58 修正済）
- `docs/plans/pre-phase-2-docs-sync.md` 新規 add（本プラン）
- `~/.claude/plans/pr-comment-adaptive-pearl.md` → `docs/archive/plans/2026-04-22-pr52-codex-round1.md` archive 移動 + 相対パス変換
- `docs/plans/squishy-sniffing-waterfall.md` → `docs/archive/plans/2026-04-22-phase-1-seed-env.md` archive 移動 + 相対パス変換

**commit 1**: `docs(handoff): Phase 1 完了状態反映 + 経緯ログ追記`
**commit 2**: `docs(screen-design): Phase 1 確定事項反映 + §6 UI 実装制約セクション追加`
**commit 3**: 任意 — 軽微な typo / リンク修正

commit 0/1/2/3 が本体（プラン直接対応）、加えて PR open 後の tracking / self-review fix / Codex Round N 対応 / 境界 milestone 同期 等で **複数 commit が積み上がる**。最終的に squash merge で 1 commit に集約されるため、commit 数の事前精算は不要（churn に強い表現）。PR description で「PR-B 別出し」+ commit 0 に同期作業統合を明記。

### 5.2 PR-B: DEV_SETUP_CHECKLIST.md（書き直し）

§4.2 の commit 分割そのまま（4-5 commit）。PR-A マージ後に着手。

### 5.3 実行順序

```
[現在] (なし) → PR-A: 同期 commit 0 + SCREEN + HANDOFF → main
   ↓
[その次] PR-B: DEV_SETUP_CHECKLIST.md 書き直し → main
   ↓
[Phase 2] UI-00 実装 PR 着手
```

### 5.4 1 セッション内のスコープ判断

- **保守ケース**: PR-A まで（合計 2.5-4h）→ PR-B は次セッション
- **積極ケース**: PR-A + PR-B 全部（合計 5.5-8h）→ 1 セッション完結

セッション着手時に user と判断する（時間 / 集中力 / Codex レビュー往復のキャパで決定）。

---

## 6. Verification

### 6.1 PR-A 検証

- [ ] `./scripts/doc-consistency-check.sh` 全 19 項目通過
  - 特に R3（Markdown リンク）と C1（DB スキーマ参照）に注意
- [ ] SCREEN_DESIGN.md の `archive/plans/...` リンクが実在ファイル指す
- [ ] PROJECT_HANDOFF.md の成果物表のファイル名が docs/ 内に実在
- [ ] `git diff` で意図しない変更がないこと
- [ ] commit message は `docs(handoff):` / `docs(screen-design):` prefix

### 6.2 PR-B 検証

- [ ] `./scripts/doc-consistency-check.sh` 全 19 項目通過
- [ ] DEV_SETUP_CHECKLIST.md の Phase 1〜6 tag/PR/test count が Plans.md `Test Count` セクションと一致
- [ ] §A.1 退役記録の DOCKER_REPAIR_LOG.md リンクが実在
- [ ] memory `dev-environment-policy.md` の主張と矛盾しないこと
- [ ] commit message は `docs(checklist):` prefix

### 6.3 共通

- [ ] `git status` で意図ファイル以外の変更なし
- [ ] pre-push hook（`cargo fmt/clippy/test` + `doc-consistency-check.sh`）通過
- [ ] PR description に「PR-A / PR-B 分離方針」と本プランへのリンクを記載
- [ ] Codex app レビュー: PR-A は 1-2 往復、PR-B は 2-3 往復を見込む
- [ ] マージ後に Plans.md `Active Tasks` を更新、本プランは `docs/archive/plans/2026-05-08-pre-phase-2-docs-sync.md` に archive 移動（相対パス変換）

---

## 7. Out of Scope

明示的にやらない:
- UI_DEV_WORKFLOW.md 新規作成（Plans.md Task 7-11、Phase 2 実装と並走）
- Phase 2 以降の予測込みリライト（実装後に書く方が精度高い）
- UI_TECH_STACK.md / FUNCTION_DESIGN.md / ARCHITECTURE.md / DB_DESIGN.md の編集
- DOCKER_REPAIR_LOG.md の archive 移動（Docker 退役記録として現状維持、必要なら別 PR で `docs/archive/` 移動を検討）
- decision-log.md / project-memory.md / TOOLING_SKILL_COMMANDS.md（用途別、別 PR で必要時更新）
- Plans.md の追加更新（PR-A の commit 0 + PR 境界 milestone commit で対応済、PR-B では原則編集しない）

---

## 8. 関連メモリ・参照

**前提知識**:
- `memory/feedback-active-plan-in-docs.md` — 本プラン配置ルール
- `memory/feedback-archive-relative-path-conversion.md` — archive 移動時の相対パス変換
- `memory/dev-environment-policy.md` — WSL2 直接開発採用（Docker 不使用）
- `memory/tauri2-linux-ime-limitation.md` — Phase 2 以降 Windows native 移行根拠
- `memory/feedback-plans-sync-commit-milestone-only.md` — Plans.md 同期は節目のみ
- `memory/desktop-app-ui-constraints.md` — UI 設計制約（レスポンシブ不要 / hover 許容 等）

**参照元**:
- `Plans.md` 「Active Tasks」「次セッション着手順序」「Backlog」
- `docs/archive/v0_tag_history.md` — v0.1.0 〜 v0.5.0 タグ履歴
- `docs/research/2026-04-20-invoke-wrapper-adr.md`（ADR-004）
- `docs/archive/plans/2026-04-21-ui-12-design-agreement.md` — UI-12 設計合意書

**Critical files（実装時に変更）**:
- `docs/SCREEN_DESIGN.md`（PR-A）
- `docs/PROJECT_HANDOFF.md`（PR-A）
- `docs/DEV_SETUP_CHECKLIST.md`（PR-B、実質書き直し）

**Critical files（参照のみ）**:
- `docs/UI_TECH_STACK.md`
- `docs/FUNCTION_DESIGN.md`
- `docs/ARCHITECTURE.md`
- `Plans.md`
- `src/config/navigation.ts`（4 エリア × 19 項目の実装、SCREEN_DESIGN.md §2 で参照追加）
