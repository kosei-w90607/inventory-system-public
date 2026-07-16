# 横断アーキテクチャ + コード品質監査レポート（2026-07）

## 監査結論

この repository は、`UI -> CMD -> BIZ -> IO/MNT` の基本骨格、generated IPC、主要な shared UI pattern、広い自動 test 群を持ち、通常 gate もすべて通過している。一方、5年間にわたり記憶のない書き手が安全に変更するという Goal Invariant に対して、次の横断リスクが残る。

1. backup / migration / restore / filesystem failure で、失敗を既定値や成功扱いへ変換する経路に加え、main DB と WAL の片側だけを確定する経路があり、保存先・保持・transaction・復元 snapshot を誤認し得る。
2. 設計正本と production contract の所有場所が矛盾または重複し、validation、整合性補正、有限値、patch の省略意味論、file 上限、PLU 書出し error 分類の片側変更を gate が防げない。
3. mutation の影響先と UI orchestration が明示 contract になっておらず、test が現行実装を写すか中核 hook を丸ごと mock するため、stale cache、日付またぎ、WAL 障害などの不具合を green のまま通す。
4. render 中の ref 読み書き、router `Link` と raw anchor の混在、module-wide lint 抑止、未参照 wrapper / 環境 flag / stylesheet、到達不能 DTO、消費されない payload、古い lifecycle コメントが、状態遷移の予測と現役 contract の判別を難しくしている。

これらは件数や採点ではなく、具体的な害の経路と repository 自身の規範との差で判定した。各 finding の file:line 証拠は末尾の package 別記録を正本とする。

## 対象と方法

- 対象 branch: `agent/arch-audit-2026-07`
- 開始時点の構造 map: [P0](findings/p0-structure-map.md)
- production source は read-only とし、成果物は `docs/research/audit-2026-07/` のみに追加した。
- frontend / backend の module・依存・shared component・error/type/query/test contract を P0 から P8 まで直列に監査し、各 package を commit + push した。
- 第1パスの P3〜P8 が `gpt-5.6-luna` / `low` で実行されていたため、`gpt-5.6-sol` / `xhigh` の自己確認 guard の下で P3b〜P8b の recall sweep を実施した。既出 finding の再確認・破棄は行わず、見落としだけを追加した。
- P9 / P9b は既存 findings の重複整理と優先順位付けのみを行い、新規調査・新規 finding は追加していない。

実行した主要 gate:

- `npm run typecheck`、`npm run lint`、`npm test`（98 files / 666 tests）
- `cargo clippy --all-targets --all-features -- -D warnings`、`cargo test`（unit 670 tests、traceability generator 14 tests、architecture / design-compliance / integration tests を含む）
- `cargo run --bin generate_traceability -- --check`（ERROR / WARN 0）
- `bash scripts/doc-consistency-check.sh`（ERROR 0。既存の `75-ui-integrity-check.md` paging 上限 WARN 1）

## 優先度付き是正リスト

上から実行する。優先順は、利用者データ・復旧可能性・誤表示・横断回帰への影響を先に置き、同程度なら小さい労力を先にした。ここで統合した finding は同じ原因または同じ完了条件を持つため、production 修正と test 修正を別々の follow-up にしない。

| 順 | 是正単位 | 統合する finding | 優先理由 | 想定労力 |
|---:|---|---|---|---|
| 1 | legacy DB 移行と restore を main / WAL / SHM 単位で原子的にし、実 SQLite WAL と各段階の失敗試験を完了条件にする | P3b-1, P3b-2, P8b-3 | 部分 snapshot を成功扱いして次回 migration を skip する経路と、旧 WAL へ別 snapshot を接続する経路があり、利用者データの破損・誤復元に直結する | M |
| 2 | backup 設定読取と migration rollback の失敗を成功・既定値へ変換しない | P3-1, P3-3 | 誤った保持日数で backup を削除する経路と、transaction 状態不明のまま起動を続ける経路があり、データ安全性と復旧性に直結する | M |
| 3 | 整合性補正の不変条件を設計・実装・audit trail で一本化する | P7-1 | 現行の関数設計内部が相反し、どちらへ直しても別 contract を壊し得るため、実装修正より先に正本確定が必要 | M |
| 4 | mutation→consumer query の影響 contract と回帰 test を同時に整備する | P5-1, P5-2, P5-3, P5b-1, P5b-2, P5b-3, P8-2 | 商品・在庫・棚卸し・売上CSV・閾値更新・整合性補正後に fresh 扱いの旧値を表示し、現行 test も同じ欠落を写している。画面単位の追加では再発する | M |
| 5 | 業務 validation の所有層を一つにし、実 production CMD を test する | P2-2, P8-1 | 2層の message / field drift と、production 分岐を削除しても通る test を同じ原因から解消できる | M |
| 6 | render-phase ref access を commit / event 後の状態同期へ置き換える | P7b-1 | 破棄された render の検索条件や lock が非同期処理へ残り、表示中の状態と異なる結果を保持・破棄し得る | M |
| 7 | 継続可能な filesystem failure を記録し、判定を変える IO error は返す | P3-2 | backup・restore・diagnostic log の異常が無観測になる。局所変更で運用診断性を大きく改善できる | S |
| 8 | 利用者向け error と診断相関情報を共通境界へ集約し、PLU 書出しを import error / CSV 語彙から分離する | P3-4, P7b-3 | 技術詳細・汎用文言・誤った `import_error` が経路ごとに分裂し、利用者 recovery と診断を誤誘導する。内部型も実体の tab-separated `.txt` と一致させる必要がある | M |
| 9 | file 選択・20MB 上限・Z004 flow を frontend / IPC / backend の一契約にし、実 hook の mutation / recovery / blocker を test する | P1-2, P4b-2, P8b-1 | WebView2 の file input 差、3画面の上限定数、backend guard 欠落、中核 hook の全面 mock が重なり、過大入力や import state 回帰を全 gate が通す | M |
| 10 | home の4 query・派生値・部分障害・日付またぎを実 orchestration test で固定する | P8b-2 | 前日未取込み警告、query 引数、24時またぎ、独立 error toast の operator-facing 回帰が手組み表示 fixture を通過する | M |
| 11 | FE traceability を件数 baseline から意図的除外 file + domain ID の検査へ変える | P8-4 | 現行 gate は未参照 file の入替えを検出せず、domain helper test の要件接続を追跡できない | M |
| 12 | CMD-11 の settings / backup / image orchestration に service 境界を設ける | P2-1 | direct DB / IO / MNT と復旧規則が CMD に集まり、今後の変更が層境界逸脱を模倣しやすい。範囲が広いため独立した設計付き変更にする | L |
| 13 | product patch の omitted / null / value を generated IPC contract で表現する | P4b-1 | frontend の `Partial` + cast と generated 必須 nullable field が異なる省略意味論を示し、generator・backend 変更時に意図しない field 更新へ化け得る | M |
| 14 | 有限 IPC 値を Rust enum の generated contract に寄せる | P4-1 | backend と frontend の片側 variant 変更が typecheck を通る。error contract 是正と順序を合わせる | L |
| 15 | internal navigation を typed router link に統一し、ID lookup と固定・parameterized route title を利用側 test で固定する | P7-3, P7-4, P7b-2, P8-3 | typo・動的 title 欠落・導線ごとの full reload が config test / mocked Sidebar を通過し、cache・local state・typed search を予測不能に失う | M |
| 16 | URL search と閾値 form の有限集合を schema / descriptor から導出する | P4-2, P4-3 | deep-link 値の silent fallback と、validation した field を保存しない片側変更を型検査で止められる | M |
| 17 | operation log 系 query key を共通 factory に収容する | P5-4 | repository-wide search に頼る横断 invalidation を小さい変更で factory contract に戻せる | S |
| 18 | 旧 contract・phase コメント・広域 dead-code 抑止・orphan 環境 flag / stylesheet を現行 lifecycle に合わせる | P6-2, P6b-1, P6b-2, P7-5 | 到達不能な棚卸し API、production consumer のない環境 contract、未参照の旧 Vite CSS、「全 pending」の古い説明が現役経路の選択を誤らせる | S |
| 19 | 未参照 UI wrapper と専用 dependency の採用・削除方針を決着する | P6-1 | 未検証 component の新規採用と不要 dependency の保守を防げる | S |
| 20 | CSV cache / request と日報 parser payload を実消費 contract まで縮めるか診断経路へ接続する | P6-3, P6-4 | 型が示す保証と production で実際に使う情報が一致せず、無効な metadata を保守し続けている | S |
| 21 | shared component / helper 候補を独立した小変更で共通化する | P1-1, P1-3, P1-4 | sort a11y、record detail recovery、idempotency/date/integer の同一知識を複数箇所で同期するコストを下げる | S（P1-1/P1-4）・M（P1-3） |
| 22 | 動的 SQL placeholder を params 長から導出する既存慣用へ統一する | P7-2 | 手動 index と dummy read を除き、filter 追加時の対応ずれを小さい変更で防げる | S |

### 実行順の依存

- 順1は移行・restore の production 修正と P8b-3 の実 WAL / failure-injection test を同じ変更に含め、片方だけを先に完了扱いしない。
- 順3で整合性補正の正本を確定してから、順4の integrity invalidation を実装する。
- 順4は query key 追加だけで終えず、P8-2 の mutation impact test まで同じ変更に含める。
- 順5は validation を移した後に test 内分岐を production 呼出しへ置換し、旧 test の green を完了条件にしない。
- 順8の error 表示 contract と順14の generated enum 化は接続するため、前者の利用者向け contract を先に固定する。
- 順9は shared file policy と backend guard を固定してから、P8b-1 の実 hook test でその契約と3 mutation を通す。
- 順12の settings service 境界は、順1・2・7・8で確定した failure contract を維持して移動する。
- 順15の raw anchor 置換では、既存の `returnTo` / search semantics を typed link に保持し、単なる URL 置換で完了扱いしない。

## 確認できた健全な領域

P3b〜P8b の recall sweep 後も、次の領域は記載した範囲で健全と確認できた。例外は優先度付き是正リストへ移し、clean 宣言に含めていない。

- frontend IPC は generated `commands.*` + `unwrapResult` に統一され、raw `invoke` は検出しなかった。
- DB / IO / MNT から BIZ / CMD への上位参照は検出せず、architecture / design-compliance test も通過した。
- list / filter / page / sort の正本は概ね URL search state、一時的 import flow や dialog state は local state と、役割に沿って配置されていた。render-phase ref と raw anchor の例外は P7b-1 / P7b-2 に限定して記録した。
- shared `PageHeader`、`EmptyState`、`DepartmentFilter`、`FormSection`、`TabsHeader` 等は複数 feature で再利用されている。
- `collapsible.tsx` の未使用残置は設計に明記され、現状と正本が一致していたため finding としなかった。
- 基本の `DbError -> BizError -> CmdError` と generated Result の error 経路は維持されている。利用者表示の分裂と PLU の誤分類は P3-4 / P7b-3 に限定して記録した。

自動 gate が green であることと、production 分岐・横断 consumer・設計正本への感度が十分であることは別である。今回の是正では、test 数を増やすことではなく、上記の接続点と害の経路に反応する test へ置き換えることを重視する。

## Package 別証拠

- [P0 構造マップ](findings/p0-structure-map.md)
- [P1 部品重複・再利用逸失](findings/p1-component-reuse.md)
- [P2 層境界](findings/p2-layer-boundaries.md)
- [P3 error handling](findings/p3-error-handling.md)
- [P4 型・contract 重複](findings/p4-type-contracts.md)
- [P5 状態管理・データ取得](findings/p5-state-query.md)
- [P6 dead code・残骸](findings/p6-dead-code.md)
- [P7 可読性・慣用性・命名](findings/p7-readability-idioms-naming.md)
- [P8 テスト品質](findings/p8-test-quality.md)

## 監査の境界

- source 修正、是正設計、manual operator test、実 POS / backup data を使う動作確認は本監査の scope 外。
- finding は監査時点の branch に対する静的証拠と repository test で成立させた。runtime 実測が必要な推測は確実な finding に含めていない。
- 是正時は各 finding の file:line を再確認し、behavior 変更に該当する場合は source design と test を同じ変更で更新する。
