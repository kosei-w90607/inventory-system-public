# Test Design Matrix: JAN 専用欄の共通正規化 + 保存 validation design-first

## Risk

Risk: R3

## Contracts Under Test

- UI-01b-D16 / UI-01b-D17 / UI-01b-D18（51 の新設 3 D-ID）
- BIZ-01-D1 / BIZ-01-D2（30-biz の新設 2 D-ID）
- IO-04-D2（25-io の新設 1 D-ID）
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
- BIZ 側にチェックディジット判定の複製を許し、io 既存関数と drift する
- `is_valid_ean8_code` が EAN-13 の重みパターンのコピー実装になり、偶奇逆転で実在 JAN-8 を誤拒否する（rally round 1 P1-1）
- 二重実装契約（D6）の相互参照が片側にしか書かれず drift-guard test の設計根拠が失われる
- catalog ⑮ D11 既存文言が D12 追加時に改変される
- D12 が composition 中の値へも写像を許し、D11 の「composition 中不加工」と競合する
- 拒否文言の無断変更（UI_TECH_STACK §6.4 例示との不一致再発）
- DB CHECK/UNIQUE 追加の混入（グループコード運用の破壊）
- anchor literal が plans/archive corpus・他 D 節と衝突し mutation survivor 化する

## Test Matrix

anchor 検査はすべて `rg -c "<literal>" <file>` の完全一致 count で行う。anchor literal は定義文そのものに特定化する。uniqueness の対象 corpus は**変更後の source design docs（docs/function-design/ / docs/design-system/ / docs/db-design/ / docs/UI_TECH_STACK.md）に限定し、docs/plans/** と docs/archive/** は除外する**（Packet / Matrix 自身への hit は uniqueness 違反にしない）。各 anchor は対象 file・対象節ごとの exact count で固定し、amendment commit 時に検証してから凍結する（memory: matrix-anchor-uniqueness）。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-01b-D16 | 51 に契約なし | CLI (rg) | M-J1: 51 の設計判断節と §7.5 入力節を節単位に分けて各々 `rg -c "UI-01b-D16"` >= 1（一括 count は両節配置を保証しないため節別検査） | 設計判断 or §7.5 追記の欠落 |
| SPEC-JAN-D1 | 適用経路の部分欠落 | CLI | M-J1a: 51 内 2 literal 必須 — (a)「composition 中でない onChange（キー入力・paste を含む全経路）」(b)「onCompositionEnd の確定値」 | paste 経路 or 確定経路の片方だけの設計解釈を許す |
| SPEC-JAN-D1 | util 複製 drift | CLI | M-J1b: 51 内 literal「`normalizeComposedDigits` / `isComposedDigitsOnly` の既存実装を import 流用し、複製・挙動変更を禁止」 | JAN 欄専用の別実装正規化を許し catalog ⑮ D11 と drift する |
| SPEC-JAN-D2 | 評価順未定義 | CLI | M-J2: 51 内 literal「正規化適用後の値で評価」+ literal「JAN-8 は false 維持」 | 全角 13 桁 false 問題の残存 / 8 桁の PLU 提案混入 |
| UI-01b-D17 | 51 に保存契約なし | CLI | M-J3: 51 の設計判断節と §7.6 Validation 節を節単位に分けて各々 `rg -c "UI-01b-D17"` >= 1 | 保存 validation 契約の欠落 |
| SPEC-JAN-D3 | チェックディジット縮退 / 文言 drift | CLI | M-J3a: 51 §7.6 内 3 literal 必須 — (a)「ASCII 数字 8 桁または 13 桁」(b)「モジュラス 10 チェックディジット整合」(c)「JANコードのチェックディジットが一致しません。入力値を確認してください」 | 桁数のみへの縮退 / 文言の無断変更 |
| SPEC-JAN-D3 | blank 規則の意図しない改変 | CLI | M-J3b: 51 §7.6 内の既存 blank + code_prefix 規則文が amendment 前後で literal 不変（amendment 時に before/after `rg -c` で確認し count 固定） | 既存規則の書き換え混入 |
| BIZ-01-D1 | 30-biz に契約なし | CLI | M-J4: 30-biz の §4.2 create_product 節内 `rg -c "BIZ-01-D1"` >= 1 + literal「`ValidationFailed`」が同節の JAN 契約文内に >= 1 | BIZ defense in depth の欠落 |
| SPEC-JAN-D4 | BIZ 複製許容 | CLI | M-J4a: 30-biz 内 literal「BIZ 側複製を禁止」+ literal「`is_valid_ean8_code`」 | チェックディジット判定の二重実装 drift を許す |
| SPEC-JAN-D5 | 適用境界欠落 | CLI | M-J5: 30-biz 内 literal「手入力 create 経路のみ」+ literal「CSV/Z004 import 経路と既存 DB 行は対象外」 | import 波及の設計解釈を許し既存凍結 test と矛盾する |
| SPEC-JAN-D5 | DB 制約混入 | CLI | M-J5a: master-tables 内 literal「DB CHECK は追加しない」（products 設計意図節）+ 既存の UNIQUE 非付与理由文が literal 不変 | schema 変更の混入 / グループコード運用の破壊 |
| SPEC-JAN-D5 | fixture 置換許可の欠落 | CLI | M-J5b: 51 or 30-biz 内 2 literal 必須 — (a)「fixture 値のみを synthetic 有効 EAN-8/13 値へ置換する」(b)「assert 構造の変更・test 削除・skip は禁止」（rally round 2 P1-A 是正） | 契約違反 fixture の扱いが未定義のまま実装へ進み既存 test 規律と正面衝突する |
| UI-01b-D18 / BIZ-01-D2 | 相互参照の片側欠落 | CLI | M-J6: 51 内 `rg -c "BIZ-01-D2"` >= 1 かつ 30-biz 内 `rg -c "UI-01b-D18"` >= 1（相互方向を個別検査） | 片側参照だけの契約化で drift-guard 根拠が失われる |
| UI-01b-D18 | 51 内の配置片寄り | CLI | M-J6b: 51 の §7.1 設計判断節と該当契約節を節単位に分けて各々 `rg -c "UI-01b-D18"` >= 1（rally round 1 P2-2 是正） | 設計判断 or 契約節追記の欠落 |
| SPEC-JAN-D6 | 意味論定義の欠落 | CLI | M-J6a: 51 と 30-biz の両 doc に literal「ASCII 数字 13 桁のみ true」各 >= 1 + 51 内 literal「独立転記 oracle」>= 1 | 二重実装の同一意味論契約が曖昧化する |
| IO-04-D2 | 25-io に契約なし | CLI | M-J7: 25-io 内 `rg -c "IO-04-D2"` >= 1 + literal「`is_valid_ean13_code` の実装挙動は不変」（既存 §12 narrative 記述の literal 不変も amendment 時 before/after `rg -c` で確認 — rally round 1 P3-1 是正） | 新関数追加時の既存関数・既存 narrative 改変を許す |
| SPEC-JAN-D4 / IO-04-D2 | EAN-8 重み配分の偶奇逆転 | CLI | M-J7a: 25-io 内 2 literal 必須 — (a)「先頭桁（idx 0）に重み 3」(b)「重み配分の偶奇が逆」+ golden 値 literal「96385074」>= 1（rally round 1 P1-1 是正） | EAN-13 パターンのコピー実装で実在 JAN-8 が誤拒否される設計解釈を許す |
| SPEC-SUGGEST-D12 | catalog ⑮ に追加なし | CLI | M-J8: catalog ⑮ 内で D12 契約本文と D11 の参照更新文を個別 anchor で検査 — `rg -c "SPEC-SUGGEST-D12"` >= 2 + literal「paste 経由を含む」>= 1（rally round 1 P2-2 是正） | 兼用 5 欄 paste known limitation が未解消のまま / D11 側参照更新の欠落 |
| SPEC-SUGGEST-D12 | D11 との競合 | CLI | M-J8a: D12 本文内 literal「composition 中でない onChange」+ literal「半角のみの値は写像で同値のため既存挙動不変」 | composition 中への写像適用で D11 と競合 / 既存 5 画面 test 凍結と矛盾 |
| catalog ⑮ D1〜D11 不変 | 凍結文の改変 | CLI | M-J9: D11 既存 anchor 4 literal（「値全体が」写像条件文 / composition 中不加工文 / one-shot guard 文 / isLocked 尊重文。amendment 時に現行文から literal 転記して固定）が全て `rg -c` >= 1 で残存。paste 除外文言のみ D12 参照へ更新されることを before/after diff で確認 | D12 追加作業での D11 意味論改変 |
| SPEC-JAN-D8 | 参照追記なし | CLI | M-J10: UI_TECH_STACK §6.4 内 `rg -c "UI-01b-D17"` >= 1 | 例示文言の gap（正本参照なし）が残存 |
| Plans.md 同期 | PK4 欠落 | CLI | M-J11: Plans.md「次の行動」節内に本 packet への link >= 1（`scripts/doc-consistency-check.sh` PK4 PASS で兼用） | packet-selection fail-closed の破壊 |
| 全体 | docs-only 逸脱 | CLI | M-J12: PR diff に `src/` / `src-tauri/` の変更が含まれない（`git diff --name-only` で検査） | 実装の先行混入 |

## 実装 PR への予約（本 design の Ledger 対応）

実装 PR 側 Matrix が最低限含むべき系列（本 design の凍結義務として引き継ぐ）:

- S 系（frontend）: JAN 欄正規化（半角キー入力不変 / 全角 paste 写像 / 混在無変換 / composition 中不加工 / compositionend 写像）、suggestPluTarget 正規化後評価（全角 13 桁 -> true になること）、保存 validation（8/13 桁 + チェックディジット、synthetic 値の valid/invalid 両系、blank 規則不変）
- T 系（backend）: validate_create_request の JAN 検証（valid 8/13 通過・invalid 拒否・None 通過）、is_valid_ean8_code 単体（GS1 モジュラス 10 synthetic 値、golden = `96385074` / `49123456` の独立転記）、import 経路の非波及（既存 test 凍結が guard）
- fixture 事前 sweep（発注前 Coordinator 義務）: `create_product` / `buildCreateProductRequest` 経由で新契約違反の jan_code fixture を使う既存 test を rg で全数列挙し、synthetic 有効値への置換対象として実装 packet に記録する（値のみ置換、assert 構造不変 — rally round 2 P1-A）
- ドリフト系: suggestPluTarget / should_default_plu_target の同一ケース表 drift-guard（独立転記 oracle、production 定数から導出しない）
- W 系: ProductAddSuggest paste 正規化の配線（既存 5 画面 test 凍結不変 + D12 追加 assert は新規 test 内へ隔離）
- X 系 mutation: 正規化条件の反転・チェックディジット判定の恒真化・適用境界の拡大等、S/T/W の各 oracle が kill できることを Writer 実測 + Coordinator clean tree 独立再実測の双方で確認
