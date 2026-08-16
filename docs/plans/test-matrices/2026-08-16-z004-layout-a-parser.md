# Test Design Matrix — Z004 parser layout A 対応

## Risk

Risk: R3

## Contracts Under Test

- SPEC-Z4A-D1: 二形状受理（従来 shape = 1 行目日付 + 2 行目中間強度検査〈5 フィールド + 第 2 フィールドのコード label『コード』/半角『ｺｰﾄﾞ』含有、gated Amendment 1・2・4〉/ layout A）、どちらでもない入力の致命的エラー安全停止
- SPEC-Z4A-D2: layout A のヘッダ検査（5 フィールド + 位置アンカー: 第 2 フィールドのコード label『コード』/半角『ｺｰﾄﾞ』・第 5 フィールド『金額』、先頭 20 行以内。実ヘッダ第 2 = 半角カナ『ｽｷｬﾆﾝｸﾞｺｰﾄﾞ』、gated Amendment 4）とメタ読み飛ばし、未検出は `NoSettlementDate` variant・文言「ヘッダ行を検出できません。ファイル形式を確認してください」で停止
- SPEC-Z4A-D3: 精算日抽出は「日付」ラベル行優先 + 最初の日付パターン fallback（YYYY-MM-DD / YYYY/M/D 受理 → ゼロ埋め正規化）
- SPEC-Z4A-D4: ParseResult 出力契約不変（line_no 物理行番号、total_data_lines 一般化定義）
- SPEC-Z4A-D5: 8桁+EEEEEE の invalid_jan 行単位エラー維持（他行処理継続）
- SPEC-Z4A-D6: 全スロットダンプ受理・全ゼロコード行の空スロット skip
- SPEC-Z4A-D7: 従来 shape 既存 test の凍結（無改変）

## Failure Modes

- layout A 実ファイルが引き続き NoSettlementDate で停止する（改修が主経路に届いていない）
- 不正ファイルが layout A として誤受理され、誤った settlement_date / データ行で部分 parse される
- 従来 shape の parse 結果が検出分岐追加で変化する（後方互換の退行）
- YYYY/M/D がゼロ埋めされず不正形式の settlement_date が下流へ流れる
- メタ走査が無制限になり、巨大不正ファイルでヘッダ探索が暴走する / 遠方の偶然の 5 フィールド行をヘッダ誤認する
- 日付様文字列を含むメタ値により従来 shape へ誤ルーティングされる、または誤った settlement_date が抽出される
- 8桁+EEEEEE 行が silent skip され売上行が不可視喪失する
- layout A のデータ行 line_no がメタ行分ずれて報告される

## Test Matrix

- Before citing an existing test as regression coverage, use `rg` or an equivalent repository search to verify that the cited test exists.
- 新規 test 名は Writer が命名規約に合わせて確定してよいが、各行の「Would fail if...」の拘束対象は変更しない。anchor は定義文 literal へ特定化し、`rg -c` で重複出現がないことを確認する。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| SPEC-Z4A-D1/D2/D3 | layout A が parse できない | unit | T-A1 `parse_z004_layout_a_full_shape` | 実形状 exact fixture（実メタ 6 ラベル 12byte padding + 空行 + 半角カナヘッダ + データ、gated Amendment 4）の parse が Err、または settlement_date / parsed_rows / parse_errors / total_data_lines / file_hash のいずれかが期待値と不一致 |
| SPEC-Z4A-D3 | 日付抽出誤り | unit | T-A2 `parse_z004_layout_a_settlement_date_iso` | メタ日付行 `YYYY-MM-DD` が settlement_date に反映されない、または他のメタ行の数値を日付と誤認する |
| SPEC-Z4A-D3 | ゼロ埋め欠落 | unit | T-A3 `parse_z004_layout_a_settlement_date_slash_padded` | メタ日付 `2026/8/5` が `2026-08-05` に正規化されない |
| SPEC-Z4A-D5 | 8桁行の silent skip / 誤受理 | unit | T-A4 `parse_z004_layout_a_8digit_code_invalid_jan` | 8桁+EEEEEE 行が invalid_jan の ParseError にならない、または当該エラーで他行の処理が停止する |
| SPEC-Z4A-D2 | メタ行数固定依存 | unit | T-A5 `parse_z004_layout_a_meta_line_count_tolerance` | メタ行数が 6 以外（例 5 / 7）の synthetic 入力でヘッダ検出が失敗する |
| SPEC-Z4A-D1/D2/D3 | 日付様メタ値での誤ルーティング・誤抽出 / decoy ヘッダ誤認 | unit (adversarial) | T-A7 `parse_z004_layout_a_datelike_meta_first_line` | メタ行 1（管理No.）の値に日付様文字列を含む layout A fixture が従来 shape へ誤ルーティングされる、settlement_date が「日付」ラベル行の値にならない、または真のヘッダより前に置いた **decoy 行（5 フィールドだが第 2『コード』/第 5『金額』の位置アンカー不一致）** がヘッダ誤認されてデータ行の件数・行番号がずれる（round 2 N2: ラベル照合を外した mutant はこの decoy で確実に red になる） |
| SPEC-Z4A-D6 | 空スロット skip 退行 | unit | T-A6 `parse_z004_layout_a_slot_dump_counts` | 全ゼロコード行（13/14 桁）が parsed_rows か parse_errors に混入する、または実データ行件数の assert が不一致 |
| SPEC-Z4A-D1 | 『コード』条件の欠落（5 フィールドのみへの緩和） | unit (adversarial) | T-A8 `parse_z004_layout_a_five_field_meta_decoy` | 1 行目に日付様値を含み 2 行目が 5 フィールド非ヘッダ行（第 2 フィールドに『コード』なし）の layout A fixture が、従来 shape へ誤ルーティングされる（正: 従来判定 fail → layout A 走査 → 2 行目は D2 ヘッダ検査も fail → 後続の真のヘッダで正しく parse。『コード』条件を外した mutant はこの fixture で red） |
| SPEC-Z4A-D1/D3 | 日付なしの誤受理 | unit (negative) | T-N1 `parse_z004_layout_a_no_date_fails` | メタ行群に日付パターンがない入力（ヘッダは検出される）が NoSettlementDate variant + 文言「精算日を抽出できません。ファイル形式を確認してください」で停止しない |
| SPEC-Z4A-D2 | ヘッダ不在の誤受理 / 走査暴走 | unit (negative) | T-N2 `parse_z004_layout_a_no_header_fails` | ヘッダ検査を満たす行が先頭 20 行以内にない入力（21 行目ヘッダ配置 case を含む）が `NoSettlementDate` variant + 文言「ヘッダ行を検出できません。ファイル形式を確認してください」で停止しない。対で「ちょうど 20 行目ヘッダ配置」の成功 case が受理されない場合も red |
| SPEC-Z4A-D1 | 二形状外の誤受理 | unit (negative) | T-N3 `parse_z004_unrecognized_shape_fails` | 二形状のどちらでもない構造（例: 2 列行のみのファイル）が部分 parse 結果を返す |
| SPEC-Z4A-D4/D7 | 従来 shape 退行 | regression | 既存 `z004_parser` unit tests（`src-tauri/src/io/z004_parser.rs` `mod tests` 内、無改変） | 検出分岐追加により従来 shape の parse 結果・エラー種別・文言が変化する |

## State Lifecycle Matrix

parser は純関数で自身の永続 state を持たない。取込み lifecycle（preview / commit / rollback / 同日冪等 SPEC-SDI）は BIZ-03 既存契約のまま本 change 非接触のため、行は parse 段のみとする。

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| parse_z004 入力→結果 | 生バイト列 | なし（同期純関数） | ParseResult（二形状とも同一契約） | なし | 同一入力で決定的に同一結果（file_hash 含む） | なし | なし | 致命的エラーで安全停止、部分結果なし | 呼び出し側責務（不変） | T-A1 / T-N1〜N3 |
| 取込み lifecycle（BIZ-03） | 既存契約 | — | — | — | — | — | — | — | — | non-scope（既存 tests 非接触 green を L1 full で確認） |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| 29-io §29.4 layout A 検出（ヘッダ検出でメタ読み飛ばし、`is_header_fields` と同型の field 数 + 位置アンカー付きラベル照合）+ 日付 2 形式正規化 | `daily_report_parser`（IO-07） | `z004_parser`（IO-02、本 change） | layout B 連結型検出は移植しない（Z004 実サンプル未採取、Non-scope） | T-A1〜T-A5 / T-A7 |
| E 除去正規化（normalize_jan） | `z004_parser` のみ（他 parser に JAN 正規化なし） | 変更なし（語義 doc 修正のみ） | — | T-A4 + 既存 tests 凍結 |
| 改行正規化（NEL / CRLF / CR） | `z004_parser` / `daily_report_parser` | 変更なし（既存契約のまま layout A にも適用） | — | T-A1（CRLF fixture） |

## Negative Paths

- missing input: 空バイト列 / 2 行未満 → NoDataLines（既存契約、凍結 test）
- invalid input: 二形状外の構造 → T-N3 / CP932 デコード不能 → 既存 DecodeFailed（凍結 test）
- duplicate/ambiguous input: メタ行群に日付様文字列が複数ある場合は「日付」ラベル行を優先採用（該当行なしのときのみ最初の一致へ fallback。T-A7 で優先を、T-A2 の fixture の時刻行等で誤認なしを assert）
- unknown reference: なし（DB 非接触）
- dependency missing: なし（新規依存なし）
- permission/write failure: なし（読み取り専用純関数）
- dry-run side effect: なし

## Boundary Checks

- threshold: ヘッダ走査上限 20 行。off-by-one を両側から拘束する — 「ちょうど 20 行目ヘッダ = 受理」の成功 case と「21 行目ヘッダ = `NoSettlementDate` 停止」の失敗 case を T-N2 の fixture として個別に持つ
- null/default: 空行・空スロット行の skip 意味論不変
- empty/non-empty: データ行 0 件の layout A（ヘッダのみ）→ parsed_rows 空・total_data_lines 0 で Ok（既存の従来 shape 意味論と同型）
- min/max: 日付の月日 1 桁 / 2 桁（T-A3）
- status/policy enum: Z004ParseError の variant 追加なし（既存 3 variant のまま）
- wire type: CP932 生バイト列（不変）
- internal type: ParseResult（不変）
- producer/consumer: CV17 → parse_z004 → BIZ-03（下流無改変）
- round-trip token: なし（一方向）
- precision/range: i32（不変）
- cross-language parse: なし（bindings 非接触）

## Compatibility Checks

- old schema/input: 従来 shape fixture → 既存 tests 凍結で結果不変を機械保証。凍結 BIZ fixtures の 3 形状（共有 builder「スキャニングコード/金額」/ 省略ラベル「額」〈gated Amendment 1 起源、5 フィールド + 第 2『コード』の中間強度検査で従来 route〉/ no-date negative〈layout A 走査経由で NoSettlementDate〉）は机上トレース済み、`cargo test` 全数 green が機械保証
- new schema/input: layout A fixture → T-A1〜T-A6
- output order: parsed_rows / parse_errors の行順 = ファイル出現順（不変、T-A1 で assert）
- optional field behavior: なし（ParseResult に optional field なし）

## Data Safety Checks

- source-derived data: 実 CSV 本文・実店舗値を fixture に使わない（匿名化 synthetic のみ）
- generated outputs: traceability 再生成は AUTO-GENERATED のまま手動編集しない
- secrets: なし
- local-only files: 店舗採取実ファイルは owner PC のみ。L3 evidence は PR body / comment に結果のみ記録
- synthetic sample boundaries: fixture の JAN は synthetic 13 桁、名称・数値は架空値

## Main Wiring / Integration Checks

- helper connected to main path: layout 検出は `parse_z004` 本体の分岐であり、BIZ-03 経由の既存 integration tests が同一関数を通る（迂回実装の余地なし）
- output reaches manifest/report: 取込み後の在庫・日次売上反映は既存 BIZ-03 契約（L3 で実ファイル確認）
- effective config reaches runtime: 該当なし（設定なし）
- CLI arg reaches implementation: 該当なし

## Mutation-style Adequacy Questions

- layout 検出分岐を反転（1 行目日付ありでも layout A 走査）したら → 既存従来 shape tests が red（1 行目日付行がヘッダ誤認され行ずれ）
- 従来 shape 判定の 2 行目検査を外し「1 行目日付のみ」に戻したら → T-A7 が red（日付様メタ値で従来 shape へ誤ルーティング、メタ行 2 は 2 フィールドのため検査ありなら layout A 側へ落ちる）
- 従来 shape 判定の第 2 フィールド『コード』条件を外し 5 フィールドのみに緩めたら → T-A8 が red（5 フィールド非ヘッダ decoy で従来 shape へ誤ルーティング）
- コード label 照合から半角『ｺｰﾄﾞ』受理を除去したら → T-A1 系（実形状 fixture、半角カナヘッダ）が red
- コード label 照合から全角『コード』受理を除去したら → 全角 variant test（fullwidth_header_variant）と既存従来 shape tests が red
- ヘッダ走査上限 20 を撤廃したら → T-N2 が red（上限超過入力が停止しない）
- ヘッダ走査上限を 21 に緩めたら → T-N2 の「21 行目ヘッダ = 停止」case が red / 19 に狭めたら → 「20 行目ヘッダ = 受理」case が red
- ヘッダ検査のラベル照合（位置アンカー込み）を外し field 数のみにしたら → T-A7 が red（decoy 5 フィールド行がヘッダ誤認され件数・行番号ずれ）
- ラベル照合を位置非依存（どのフィールドでも可）に緩めたら → T-A7 の decoy（『コード』『金額』を誤位置に含む変種）が red
- ヘッダ検出条件を「5 フィールド」から「2 フィールド以上」に緩めたら → T-A1/T-A5 が red(メタ行がヘッダ誤認され settlement_date またはデータ行数が不一致)
- 日付正規化のゼロ埋めを除去したら → T-A3 が red
- 「日付」ラベル行優先を外し単純な最初の一致にしたら → T-A7 が red（管理No. の日付様文字列を誤採用）
- 8桁+EEEEEE を skip に変えたら → T-A4 が red
- 全ゼロ skip を除去したら → T-A6 が red（件数 assert 不一致）
- total_data_lines の起点をヘッダ行自身に含めたら → T-A1 の件数 assert が red
- 従来 shape の日付抽出を layout A 側の走査に統合して意味論を変えたら → 既存凍結 tests が red

組合せ oracle 注意（memory 教訓の反映）: 空集合期待の case（T-N 系）だけでなく、T-A1 / T-A6 は**非空の期待値**（件数・具体値）を最低 1 case 持つこと。期待を production 定数から導出せず、fixture に対する独立転記の literal で assert すること。

## Residual Test Gaps

- 実ファイル（実データ量 5,000 行・実メタ値）そのものは repo に入らないため、unit test では synthetic 近似に留まる。実ファイルの最終確認は L3（AC8）が担う。
- layout B（連結型）は Non-scope につき test なし（安全停止は T-N3 の同型で間接拘束されるが、layout B 固有 shape の受理/拒否は将来 change の対象）。
