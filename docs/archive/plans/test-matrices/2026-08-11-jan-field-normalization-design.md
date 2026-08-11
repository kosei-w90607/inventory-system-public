# Test Design Matrix: JAN 専用欄の共通正規化 + 保存 validation design-first

## Risk

Risk: R3

## Contracts Under Test

- UI-01b-D16 / UI-01b-D17 / UI-01b-D18（51 の新設 3 D-ID）
- BIZ-01-D1 / BIZ-01-D2（30-biz の新設 2 D-ID。BIZ-01-D1 は core validator 所有を含む — IO-04-D2 は Codex round 1 P2-1 裁定で廃止、25-io は不変）
- SPEC-SUGGEST-D12（catalog ⑮ 追加。D1〜D11 の不変性込み）
- UI_TECH_STACK §6.4 参照追記、master-tables 設計意図追記
- 既存契約の不変性（blank + code_prefix 規則、jan_code readOnly、catalog ⑮ D11 全文、import 経路の寛容性、DB CHECK/UNIQUE なし）

## Failure Modes

- 保存 validation 契約が「桁数のみ」へ縮退し、チェックディジット防御が落ちる
- 適用境界（create 手入力のみ）が欠落し、import 経路・既存 DB 行へ波及する設計解釈を許す
- 既存 test の新契約違反 fixture（invalid checkdigit 合成値・非 JAN 文字列）が未列挙のまま実装へ進み、happy-path test が即 fail する（rally round 2 P1-A）
- trim と正規化の適用順が未規定で、前後空白 + 全角数字の実バーコード手入力が誤拒否される（rally round 2 P2-B）
- 正規化の適用経路（非 composition onChange / compositionend / paste）が部分欠落する
- suggestPluTarget の評価順（正規化後）が未定義になり、全角 13 桁 false 問題が残存する
- JAN-8 の PLU 提案 false 維持が欠落し、8 桁商品が PLU 書出し対象へ紛れる
- checkdigit 三独立実装（BIZ / frontend / adapter）の golden 拘束が欠け、実装間 drift を検出できない（Codex round 1 P2-1 裁定で意図的独立実装へ転換済み）
- EAN-8 validator が EAN-13 の重みパターンのコピー実装になり、偶奇逆転で実在 JAN-8 を誤拒否する（rally round 1 P1-1）
- 二重実装契約（D6）の相互参照が片側にしか書かれず drift-guard test の設計根拠が失われる
- catalog ⑮ D11 既存文言が D12 追加時に改変される
- D12 が composition 中の値へも写像を許し、D11 の「composition 中不加工」と競合する
- 拒否文言の無断変更（UI_TECH_STACK §6.4 例示との不一致再発）
- DB CHECK/UNIQUE 追加の混入（グループコード運用の破壊）
- anchor literal が plans/archive corpus・他 D 節と衝突し mutation survivor 化する
- core validation が CASIO adapter 所有関数に依存し、D-023 のレジ換装境界を破る（Codex round 1 P2-1）
- D12 正規化値が親 onChange のみに渡り、suggest controller が raw 全角値で候補 fetch する（Codex round 1 P2-4）
- anchor 検査が regex 解釈・shell 展開で記載どおり実行不能になる（Codex round 1 P2-6）

## Test Matrix

anchor 検査はすべて `rg -F -c -- '<literal>' <file>` で実行する（`-F` = fixed-string で正規表現解釈を禁止、single quote で backtick 等の shell 展開を禁止、`--` で dash 先頭対策 — Codex round 1 P2-6 是正。以下の各行の `rg -c "..."` 表記もこの実行形式に読み替える）。count は新設契約文について原則 exact 1（既存文の残存検査は >= 1 可）。節限定検査は実ファイル・実見出しで固定した以下のコマンドを使う（Codex round 2 P2-3 是正 — 51 は `##`、30-biz は `###` 見出しであり共通テンプレート `^##` では 30-biz 節を抽出できない）:
- 51 §7.1 = `awk '/^## 7.1 /,/^## 7.2 /' docs/function-design/51-ui-product-form.md | rg -F -c -- '<literal>'`（§7.5 は `/^## 7.5 /,/^## 7.6 /`、§7.6 は `/^## 7.6 /,/^## 7.7 /`）
- 30-biz §4.2 = `awk '/^### 4.2 /,/^### 4.3 /' docs/function-design/30-biz-product-service.md | rg -F -c -- '<literal>'`
- master-tables products 節 = `awk '/^## 1\./,/^## 2\./' docs/db-design/master-tables.md | rg -F -c -- '<literal>'`、departments 節 = `awk '/^## 2\./,/^## 3\./' docs/db-design/master-tables.md | rg -F -c -- '<literal>'`（実見出し = `## 1. products` L7 / `## 2. departments` L99 / `## 3. suppliers` L162、2026-08-11 実測）

期待 count は amendment commit 時に実測した exact count へ固定してから凍結する（それまでの `>= 1` は暫定値であり、凍結時に exact へ置換しないまま closure に入った場合は検査失敗として扱う）。anchor literal は定義文そのものに特定化する。uniqueness の対象 corpus は**変更後の source design docs（docs/function-design/ / docs/design-system/ / docs/db-design/ / docs/UI_TECH_STACK.md）に限定し、docs/plans/** と docs/archive/** は除外する**（Packet / Matrix 自身への hit は uniqueness 違反にしない）。各 anchor は対象 file・対象節ごとの exact count で固定し、amendment commit 時に検証してから凍結する（memory: matrix-anchor-uniqueness）。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-01b-D16 | 51 に契約なし | CLI (rg) | M-J1: 51 の設計判断節と §7.5 入力節を節単位に分けて各々 `rg -c "UI-01b-D16"` >= 1（一括 count は両節配置を保証しないため節別検査） | 設計判断 or §7.5 追記の欠落 |
| SPEC-JAN-D1 | 適用経路の部分欠落 | CLI | M-J1a: 51 内 2 literal 必須 — (a)「composition 中でない onChange（キー入力・paste を含む全経路）」(b)「onCompositionEnd の確定値」 | paste 経路 or 確定経路の片方だけの設計解釈を許す |
| SPEC-JAN-D1 | util 複製 drift | CLI | M-J1b: 51 内 literal「`normalizeComposedDigits` / `isComposedDigitsOnly` の既存実装を import 流用し、複製・挙動変更を禁止」 | JAN 欄専用の別実装正規化を許し catalog ⑮ D11 と drift する |
| SPEC-JAN-D1 | 写像条件の縮退 | CLI | M-J1c: 51 内 literal「混在値は無変換」exact 1 + literal「NFKC」を含む禁止文 exact 1（Codex round 1 P2-7 是正） | 過剰正規化（NFKC・記号変換）や混在値写像を許す |
| SPEC-JAN-D2 | 評価順未定義 | CLI | M-J2: 51 内 literal「正規化適用後の値で評価」+ literal「JAN-8 は false 維持」 | 全角 13 桁 false 問題の残存 / 8 桁の PLU 提案混入 |
| UI-01b-D17 | 51 に保存契約なし | CLI | M-J3: 51 の設計判断節と §7.6 Validation 節を節単位に分けて各々 `rg -c "UI-01b-D17"` >= 1 | 保存 validation 契約の欠落 |
| SPEC-JAN-D3 | チェックディジット縮退 / 文言 drift | CLI | M-J3a: 51 §7.6 内 3 literal 必須 — (a)「ASCII 数字 8 桁または 13 桁」(b)「モジュラス 10 チェックディジット整合」(c)「JANコードのチェックディジットが一致しません。入力値を確認してください」 | 桁数のみへの縮退 / 文言の無断変更 |
| SPEC-JAN-D3 | blank 規則の意図しない改変 | CLI | M-J3b: 51 §7.6 内の既存 blank + code_prefix 規則文が amendment 前後で literal 不変（amendment 時に before/after `rg -c` で確認し count 固定） | 既存規則の書き換え混入 |
| SPEC-JAN-D3 | 適用順・保存値・層責務の欠落 | CLI | M-J3c: 51 内 3 literal 必須 — (a)「trim -> UI-01b-D16 と同一写像の全角→半角正規化 -> 検証」(b)「保存値は正規化後の値とする」(c)「再正規化しない」（Codex round 1 P2-7 是正。(a) は 51 が SPEC-JAN-D1 を UI-01b-D16 と表記するため実文言へ固定 — FR P2-1 是正） | round 2/3 是正の load-bearing 節が正本化から漏れる |
| BIZ-01-D1 | 30-biz に契約なし | CLI | M-J4: 30-biz の §4.2 create_product 節内 `rg -F -c -- 'BIZ-01-D1'` >= 1 + 新契約定義文 literal「違反は `ValidationFailed`（文言は 51 UI-01b-D17 の 2 文言と完全一致）」exact 1（汎用語 `ValidationFailed` 単独は 30-biz 全体 14 hit で survivor 化するため不採用 — Codex round 1 P2-6 是正） | BIZ defense in depth / 文言一致契約の欠落 |
| SPEC-JAN-D4 | adapter 共有への逆行 | CLI | M-J4a: 30-biz 内 literal「BIZ 所有の core validator」exact 1 + literal「adapter 詳細を core 契約へ昇格しない」exact 1（Codex round 1 P2-1 是正で共有設計から独立実装へ転換） | core validation の adapter 依存が再導入され D-023 換装境界を破る |
| SPEC-JAN-D5 | 適用境界欠落 | CLI | M-J5: 30-biz 内 literal「手入力 create 経路のみ」+ literal「CSV/Z004 import 経路と既存 DB 行は対象外」 | import 波及の設計解釈を許し既存凍結 test と矛盾する |
| SPEC-JAN-D5 | DB 制約混入 | CLI | M-J5a: master-tables 内 literal「DB CHECK は追加しない」（products 設計意図節）+ 既存の UNIQUE 非付与理由文が literal 不変 | schema 変更の混入 / グループコード運用の破壊 |
| SPEC-JAN-D5 | ISBN 裁定・列説明同期の脱落 | CLI | M-J5c-1（products 節）: `awk '/^## 1\./,/^## 2\./' docs/db-design/master-tables.md | rg -F -c -- 'JAN-8 または JAN-13'` = exact 1。M-J5c-2（departments 節）: `awk '/^## 2\./,/^## 3\./' docs/db-design/master-tables.md | rg -F -c -- '13 桁 JAN（EAN-13/ISBN-13）'` = exact 1 + 同節 `rg -F -c -- 'ISBN-10 非対応'` = exact 1（部門 17 は `## 2. departments` 節 L99 配下にあり products 節抽出では必ず 0 件 — Codex round 3 P2 是正で二分割、literal は FR P2-1 是正で固定済み） | owner 裁定と列説明・部門表の同期漏れでも Matrix が PASS してしまう |
| SPEC-JAN-D5 | fixture 置換規律の欠落 | CLI | M-J5b: 本 packet の「fixture 置換対象表」節が存在し、境界 literal 2 本 — (a)「同値置換のみ許可」(b)「import 側 fixture は完全凍結」— を packet file への `rg -F -c` で確認（rally round 2 P1-A + Codex round 1 P2-8 是正。waiver 正本は packet / 実装 Matrix、51 / 30-biz には書かない） | 契約違反 fixture の扱いが未定義のまま実装へ進み既存 test 規律と正面衝突する |
| UI-01b-D18 / BIZ-01-D2 | 相互参照の片側欠落 | CLI | M-J6: 51 内 `rg -c "BIZ-01-D2"` >= 1 かつ 30-biz 内 `rg -c "UI-01b-D18"` >= 1（相互方向を個別検査） | 片側参照だけの契約化で drift-guard 根拠が失われる |
| UI-01b-D18 | 51 内の配置片寄り | CLI | M-J6b: 51 の §7.1 設計判断節と該当契約節を節単位に分けて各々 `rg -c "UI-01b-D18"` >= 1（rally round 1 P2-2 是正） | 設計判断 or 契約節追記の欠落 |
| SPEC-JAN-D6 | 意味論定義の欠落 | CLI | M-J6a: 51 と 30-biz の両 doc に literal「ASCII 数字 13 桁のみ true」各 >= 1 + 51 内 literal「独立転記 oracle」>= 1 | 二重実装の同一意味論契約が曖昧化する |
| BIZ-01-D1 | 三実装 golden 拘束の欠落 / 25-io 混入 | CLI + diff | M-J7: 30-biz 内 literal「golden 独立転記 oracle は 2 profile で拘束する」exact 1 + `git diff --name-only` に `docs/function-design/25-io-plu-formatter.md` が含まれないこと（Codex round 1 P2-1 + round 2 P2-1 是正 — 2 profile 契約へ更新） | adapter 非共有裁定の逸脱 / golden 拘束の欠落 |
| SPEC-JAN-D4 | EAN-8 重み配分の偶奇逆転 | CLI | M-J7a: 30-biz 内 2 literal 必須 — (a)「先頭桁（idx 0）に重み 3」(b)「重み配分の偶奇が逆」+ golden 値 literal「96385074」>= 1（rally round 1 P1-1 是正、対象 doc は Codex round 1 P2-1 裁定で 30-biz へ変更） | EAN-13 パターンのコピー実装で実在 JAN-8 が誤拒否される設計解釈を許す |
| SPEC-SUGGEST-D12 | catalog ⑮ に追加なし | CLI | M-J8: catalog ⑮ 内で D12 契約本文と D11 の参照更新文を個別 anchor で検査 — `rg -c "SPEC-SUGGEST-D12"` >= 2 + literal「paste 経由を含む」>= 1（rally round 1 P2-2 是正） | 兼用 5 欄 paste known limitation が未解消のまま / D11 側参照更新の欠落 |
| SPEC-SUGGEST-D12 | D11 との競合 | CLI | M-J8a: D12 本文内 literal「composition 中でない onChange」+ literal「半角のみの値は写像で同値のため既存挙動不変」 | composition 中への写像適用で D11 と競合 / 既存 5 画面 test 凍結と矛盾 |
| catalog ⑮ D1〜D11 不変 | 凍結文の改変 | CLI + diff | M-J9: allowed-diff 検査 — `git diff e1ee908..HEAD -- docs/design-system/02-component-catalog.md`（base = Plan Commit 実 SHA、2026-08-11 置換済み — Codex round 2 P2-3 是正）の hunk が「D12 追加」と「D11 の paste 除外文 1 文の置換」のみであることを審査（D1〜D10 本文の changed hunk = 0。Codex round 1 P2-7 是正で全 D 網羅化）。併用で D11 既存 anchor 4 literal — (1)「入力値全体が `[0-9０-９]+` に一致する場合に限り」(2)「composition 中（isComposing true）は値を加工しない」(3)「one-shot guard」(4)「`isLocked()` が false の場合のみ」（FR P2-1 是正で実文言へ固定、各 exact 1）— の `rg -F -c` 残存 | D12 追加作業での D1〜D11 意味論改変 |
| SPEC-JAN-D8 | 参照追記なし | CLI | M-J10: UI_TECH_STACK §6.4 内 `rg -c "UI-01b-D17"` >= 1 | 例示文言の gap（正本参照なし）が残存 |
| Plans.md 同期 | PK4 欠落 | CLI | M-J11: Plans.md「次の行動」節内に本 packet への link >= 1（`scripts/doc-consistency-check.sh` PK4 PASS で兼用） | packet-selection fail-closed の破壊 |
| 全体 | docs-only 逸脱 | CLI | M-J12: PR diff に `src/` / `src-tauri/` の変更が含まれない（`git diff --name-only` で検査） | 実装の先行混入 |

## Frozen anchor counts（2026-08-11 amendment commit 時の実測、以後この exact count で凍結）

対象 file 略記: 51 = function-design/51-ui-product-form.md / 30 = function-design/30-biz-product-service.md / CAT = design-system/02-component-catalog.md / MT = db-design/master-tables.md / UT = UI_TECH_STACK.md / PKT = 本 packet。

- M-J1: §7.1 内 UI-01b-D16 = 3（D16 行 + D17/D18 行の相互参照）/ §7.5 内 = 1
- M-J1a: (a) = 1 / (b) = 1、M-J1b = 1、M-J1c: 混在値は無変換 = 1 / NFKC = 1
- M-J2: 正規化適用後の値で評価 = 1 / JAN-8 は false 維持 = 1
- M-J3: §7.1 内 UI-01b-D17 = 2 / §7.6 内 = 2
- M-J3a（§7.6 節スコープ = `awk '/^## 7.6 /,/^## 7.7 /'`）: (a) = 1 / (b) = 1 / (c) = 1（file 全体では (a)/(b) は §7.1 D17 行を加え各 2 — FR P2-1 是正で節スコープ値へ修正）、M-J3b = 1、M-J3c: (a) = 1 / (b) = 1 / (c) = 1
- M-J9 D11 anchor（catalog、FR P2-1 是正で固定）: (1)〜(4) 各 = 1
- M-J4: §4.2 内 BIZ-01-D1 = 2（step 1g + 設計判断）/ 定義文 literal = 1
- M-J4a: (a) = 1 / (b) = 1、M-J5: (a) = 1 / (b) = 1、M-J5a: (a) = 1 / (b) = 1
- M-J5c-1 = 1、M-J5c-2: (a) = 1 / (b) = 1、M-J5b: (a) = 1 / (b) = 1（PKT）
- M-J6: 51 内 BIZ-01-D2 = 1 / 30 内 UI-01b-D18 = 1、M-J6a: 51 = 1 / 30 = 1 / 独立転記 oracle（51）= 1
- M-J6b: §7.1 内 UI-01b-D18 = 2（D18 行 + D17 行参照）/ §7.5 内 = 1
- M-J7 = 1、M-J7a: (a) = 1 / (b) = 1 / 96385074 = 1
- M-J8: CAT 内 SPEC-SUGGEST-D12 = 2 / paste 経由を含む = 1、M-J8a: (a) = 1 / (b) = 1
- M-J9: `git diff e1ee908..HEAD -- <CAT>` = 2 hunk（見出しの D1〜D12 更新〈D12 追加の一部と裁定〉+ D11 paste 文置換 & D12 追加）、D1〜D10 本文の変更 hunk = 0 で PASS
- M-J10: UT 内 UI-01b-D17 = 1、M-J12: `git diff e1ee908..HEAD --name-only` の `src/` 一致 = 0

## 実装 PR への予約（本 design の Ledger 対応）

実装 PR 側 Matrix が最低限含むべき系列（本 design の凍結義務として引き継ぐ）:

- S 系（frontend）: JAN 欄正規化（半角キー入力不変 / 全角 paste 写像 / 混在無変換 / composition 中不加工 / compositionend 写像）、suggestPluTarget の trim + 正規化後評価（全角 13 桁 -> true、前後空白 + 全角 13 桁 -> true = Codex round 1 P2-3 のケース表: null / ASCII13 / JAN-8 / 全角13 / 前後空白 ASCII13 / 前後空白全角13 / 英字混在 / 12・14 桁）、保存 validation（8/13 桁 + チェックディジット、synthetic 値の valid/invalid 両系、blank 規則不変）。frontend validator（`jan-code.ts`）単体に golden `96385074` / `49123456` の独立転記 + EAN-8/13 重み偶奇反転 mutation を必須化（Codex round 1 P2-5）
- T 系（backend）: validate_create_request の JAN 検証（valid 8/13 通過・invalid 拒否・None 通過）、BIZ core validator 単体（EAN-8/13、GS1 モジュラス 10。golden = `96385074` / `49123456` の独立転記 + 偶奇反転 mutation）、import 経路の非波及（既存 test 凍結が guard）、adapter `is_valid_ean13_code` の不変（既存 PLU test 凍結 + 実装 PR diff に `src-tauri/src/io/plu_formatter.rs` が含まれないことの `git diff --name-only` 検査 — Codex round 2 P2-1）。golden は 2 profile（EAN-13 三側共通 = `4901234567887`/`4901234567890`、EAN-8 は core/frontend のみ、kill case = `49123456`/`4901234567887`）
- fixture 事前 sweep（発注前 Coordinator 義務）: `create_product` / `buildCreateProductRequest` 経由で新契約違反の jan_code fixture を使う既存 test を rg で全数列挙し、synthetic 有効値への置換対象として実装 packet に記録する（値のみ置換、assert 構造不変 — rally round 2 P1-A）
- ドリフト系: suggestPluTarget / should_default_plu_target の同一ケース表 drift-guard（独立転記 oracle、production 定数から導出しない）
- W 系: ProductAddSuggest paste 正規化の配線（既存 5 画面 test 凍結不変 + D12 追加 assert は新規 test 内へ隔離）。親 onChange 通知値と suggest controller / search query の**双方**が正規化値であることを assert する（片側 raw 値 survivor の防止 = Codex round 1 P2-4）
- X 系 mutation: 正規化条件の反転・チェックディジット判定の恒真化・適用境界の拡大等、S/T/W の各 oracle が kill できることを Writer 実測 + Coordinator clean tree 独立再実測の双方で確認
