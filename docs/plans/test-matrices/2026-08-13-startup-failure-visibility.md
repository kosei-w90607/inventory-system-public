# Test Design Matrix — 起動時 setup 失敗の operator 可視化（SPEC-SFV）

対応 packet: [2026-08-13-startup-failure-visibility.md](../2026-08-13-startup-failure-visibility.md)

前提: setup closure 内の失敗経路を test 可能にするため、Writer は文言生成・失敗 handler を pure 関数（または helper 呼出しを記録できる形）へ抽出してよい。抽出後も配線（実際の呼出し位置）は T5 の回帰と Contract Probe 第 2 項で担保する。関数抽出の形が本 Matrix の前提と合わない場合は fail-closed 停止で報告（Matrix 側を gated amendment で追随させる）。

## T 行（実装 test）

| ID | 対象 | 内容 | oracle |
|---|---|---|---|
| T1 | SPEC-SFV-D1/D2 | `app_data_dir` 取得失敗区分の fatal 文言生成: operator 向け日本語（平易な原因 + 対処誘導）であり、**診断ログ誘導文字列を含まない**。末尾に raw error detail を含む | 固定部の完全一致 assert + synthetic detail の包含 assert（期待値は test 内へ独立転記、production 定数の import 禁止（oracle と実装の SSOT 共有は mutation 感度を自壊させるため）） |
| T2 | SPEC-SFV-D1/D2 | `create_dir_all` 失敗区分の fatal 文言生成: 同上（T1 と区分が異なる文言であること）。末尾に raw error detail を含む | 固定部完全一致 + detail 包含 assert + T1 文言との不一致 assert |
| T3 | SPEC-SFV-D3 | `StartupDatabaseError::DatabaseInit` の `operator_message()` が `Some(具体文言)` を返し、文言に診断ログ誘導と raw error detail を含む（ログ初期化後の経路のため） | `Some(..)` + 固定部完全一致 + detail 包含 assert。既存 test が `None` を assert している場合は期待値を契約更新（削除・無効化は不可、変更理由を test コメントに記録。Plan Review round 1 実査では該当既存 test なし） |
| T4 | SPEC-SFV-D1 | `.run()` 失敗 handler（抽出関数）: 渡された error から fatal 文言（固定部 + detail）を生成し `show_pre_window_fatal` 相当の記録経路を呼ぶこと | handler の呼出し記録 or 文言 assert（`std::process::exit` 自体は test で実行しない構造にする）。SPEC-SFV-D4 hook の cfg(debug_assertions) 封じ込めは Final Review の code 検分 + L3 項目 2（AC8）で担保 |
| T5 | MNT-03-D4 不退行 | 既存起動系 test（b6 fail_closed_reconcile / b9 committed_marker / b10 guard_registration / b11 guard_failure）が**無改変で** green。正常起動経路で fatal 文言生成が呼ばれないこと | 既存 test green + `git diff` で当該 test 関数の無改変確認（Final Review 検分） |
| T6 | §12.4 doc 整合 | `22-mnt-migration.md` §12.4 が SPEC-SFV-D1〜D3 を含む拡張後契約を記述し、「既存3経路は無言クラッシュ（scope外）」の旧前提が doc 内から解消されている | `./scripts/doc-consistency-check.sh` 全通過 + `rg "scope外" src-tauri/src/lib.rs` 0 hit + 22 §12.4 の旧前提文の不在（rg で機械確認） |

## X 行（mutation、Writer 実測 + Coordinator 独立再実測で全 red）

| ID | mutant | 期待 red |
|---|---|---|
| X1 | setup closure 内の `show_pre_window_fatal` 呼出し（新設分のいずれか 1 箇所）を削除 | T1 or T2 or T4（対応区分の test） |
| X2 | `.run()` handler を旧 `.expect()` 相当（文言生成なし）へ戻す | T4 |
| X3 | T1/T2 の文言へ診断ログ誘導文字列を混入（D2 違反形） | T1 or T2 の「誘導を含まない」assert |
| X4 | `DatabaseInit` の `operator_message()` を `None` へ戻す | T3 |

注: X1 は「呼出し削除」が compile error になる構造（戻り値使用等）ならその旨を kill 判定として記録してよい（compile-time 遮断。JAN 正規化実装 PR #68 の X11 先例）。

## 文言固定値（Coordinator 裁定 2026-08-13、Plan Review round 1 P2-1/P2-2/P2-3 是正済み）

固定部は以下、末尾に `\n{details}`（raw error の Display 文字列、既存 RestoreReconcile / LegacyMigration と同型）を必ず付す。oracle = **固定部の完全一致 + synthetic detail の包含 assert**（`{details}` は可変のため固定部と分離して検証）。

- T1（app_data_dir）: 「アプリのデータ保存場所を確認できなかったため、起動を中止しました。パソコンを再起動してもう一度お試しください。繰り返し失敗する場合は管理者へ連絡してください。」
- T2（create_dir_all）: 「アプリのデータ保存場所を作成できなかったため、起動を中止しました。ディスクの空き容量を確認し、パソコンを再起動してもう一度お試しください。繰り返し失敗する場合は管理者へ連絡してください。」
- T3（DatabaseInit）: 「データベースの準備に失敗したため、起動を中止しました。アプリを再起動してもう一度お試しください。繰り返し失敗する場合は診断ログ（アプリのデータフォルダ内）を添えて管理者へ連絡してください。」
- T4（.run()）: 「アプリを起動できませんでした。アプリを再起動してもう一度お試しください。繰り返し失敗する場合は管理者へ連絡してください。」

注記（P2-3 disposition）: T1/T2 のみ「パソコンを再起動」とする — 原因が OS / filesystem 側（ユーザープロファイル解決・ディスク容量・権限）にあり、アプリ再起動では解消しにくい区分のため。T3/T4 は既存 style どおり「アプリを再起動」。エスカレーション語彙は全経路で既存 style の「管理者へ連絡してください」（P2-1）。
