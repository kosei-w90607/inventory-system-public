# Plan Packet: Post-UI-08 JANなし商品のPLU対象扱い設計

> **親文書**: [Plans.md](../../Plans.md) / workflow: [DEV_WORKFLOW.md](../../DEV_WORKFLOW.md)
> **フェーズ**: Design Phase（設計確定 + source docs 更新の docs PR。実装は後続 R3 PR）

## Risk

Risk: R2

Reason:
本 packet の成果物は設計決定と source design docs 更新のみ（docs PR）。runtime contract 変更（products カラム追加 / migration v3 / BIZ-04 抽出条件 / CMD DTO）は本設計確定後の後続実装 PR で行い、そちらを R3 として別 packet 化する。

## Goal

JANなし・グループコード・スポット商品を含む実店舗の商品構成で、PLU書出し（REQ-402）が破綻せず運用できる「PLU対象」の概念を設計として確定し、source design docs へ昇格する。あわせて 2026-07-03 に検証した adapter facts（Z004 二態、CV17 import semantics）を設計文書に固定する。

## Scope

- 三分バケット（対象 / 対象外 / 要修正）の設計確定（D-1）
- PLU対象判定方式の決定と products スキーマ設計（D-2）
- plu_dirty が恒久に解消不能になる問題の解消設計（D-3）
- 同一JAN（グループコード）dedup 規則の設計（D-4）
- 枠上限との関係整理（D-5）
- CV17 import semantics（メモリNo. merge）に起因するスロット再採番問題の記録と暫定運用ガード（D-6。恒久設計は後続 packet）
- adapter facts の固定（Z004 二態、5000行ダンプ、CV17 prefix 凡例、import merge 仕様）
- source docs 更新対象の確定（§Required Design Artifacts）

## Non-scope

- 後続 R3 実装 PR（本 packet は設計のみ）
- スロット永続割当の恒久設計（D-6 で方向性のみ記録、独立 packet で確定）
- Post-PLU Z004 track（実売データが載った Z004 形状の検証。実売発生後にのみ物理的に可能）
- 最新アプリ生成 `.txt` の実機再確認（PR #122 follow-up、別トラック）
- 伝票がグループコードで届く場合の入庫 UI 複数ヒット挙動（UI-02 側論点として §Deferred に記録）
- インストアコード発番（店内 EAN-13 発番 + ラベル印字。不採用判断のみ記録）

## 背景 / 問題構造

現行設計は「PLU書出し対象 = 廃番以外の全商品」を暗黙前提にしており、JANなし商品が存在する実データで 3 段に破綻する。

1. **Full モードは実データで常に失敗する**: [33-biz-plu-export-service.md](../../function-design/33-biz-plu-export-service.md) §16.3 step 5 は「JANなし / 13桁以外 / チェックディジット不正が 1 件でもあれば BizError::ValidationFailed」。Full モードの抽出は `is_discontinued=0` の全商品（[20-io-product-repo.md](../../function-design/20-io-product-repo.md) find_active_products_for_plu）であり、[master-tables.md](../../db-design/master-tables.md) の部門初期データでは 21 部門中 10 部門に「JAN無し商品あり」が確定している。JANなし商品を 1 件登録した時点で Full モードは恒久に失敗する。
2. **Diff モードは JANなし商品で恒久に機能しなくなる**: `products.plu_dirty` は DEFAULT 1。JANなし商品の登録で Diff 集合に入り prepare をブロックする。plu_dirty を下ろす唯一の経路は confirm であり、confirm は prepare 成功が前提のため、JANなし商品の plu_dirty は恒久に 1 のまま残り解消手段がない。
3. **UI-00 通知が恒久汚染される**: [53-ui-home.md](../../function-design/53-ui-home.md) の PluNotificationBar は `listPluDirty` の件数 >= 1 で表示。JANなし商品の分だけ「PLU未反映」通知が消えなくなる。非IT利用者向けに最も有害なタイプの常時ノイズになる。

## 現場事実（2026-07-03 owner ヒアリング）

JANなし商品の実態は 4 分類。①④は恒久的に JAN が存在せず、②③は「valid JAN を持つがスキャン販売しない」ケースを含む。

| # | 分類 | DB 上の姿 | 含意 |
|---|---|---|---|
| ① | 商品が古く JAN 制度前に入荷したもの | jan_code NULL + 独自コード | 恒久対象外 |
| ② | 柄違いまとめ仕入れでグループコード 1 つ、個別コードなし | 独自コード + 共有 jan_code（「JANあり・使ってない」を含む） | 同一JAN複数行 + スキャン非使用 |
| ③ | 特売スポット品（定番外・一過性） | JAN あり/なし混在、短命 | valid JAN でも PLU 枠を割く価値が低い |
| ④ | オーダーメイド由来の自店定番（問屋通常扱い外） | jan_code NULL + 独自コード | 恒久対象外 |

補足: 個別コードがある商品でも、仕入伝票は問屋都合でグループコード表記のことがある（入庫時の JAN 検索複数ヒット。UI-02 側論点、§Deferred）。問屋の内部品番はスキャン可能なバーコードとして降りてこないため設計の入力にしない（products.maker_code は参考カラムのままとする）。

「valid JAN を持つ = スキャン販売する」が成立しない（②③）ため、PLU対象は JAN 有効性からの純導出では決められない。

## Adapter Facts（2026-07-03 検証済み）

証跡は `~/Downloads/inventory-field-check/approved-readable/`（実店舗データにつき repo 非取込み。ここには構造・件数のみ記録する）。

- **Z004 の二態が物証で確定**: CV17 1.1.1 の「売上データの閲覧」画面に prefix 凡例（`Z001〜: 売上明細 / Z002〜: 取引キー / Z004〜: PLU（商品） / Z005〜: 部門`）が表示される（スクリーンショット証跡 2026-06-29）。
  - 売上系 `Z004_01 _0001.CSV`: メタ行（マシンNo. / FILE004 / モード Z / 精算回数 / 日付）+ ヘッダ + 全 5000 スロットのダンプ。空スロットは 14 桁ゼロのスキャニングコード + `PLU0001` 形式のプレースホルダ名。5 フィールド構成は [23-io-z004-parser.md](../../function-design/23-io-z004-parser.md) の設計前提と一致し、空スロットの Ok(None) スキップ・13/14 桁ゼロ判定も設計済みであることを突合確認した。
  - 設定系 `ｽｷｬﾆﾝｸﾞPLU(商品).txt`: 「レジスターの設定」セクション由来の 11 列マスタ書出し（PR #122 (private archive) field gate 通過品、4,784 データ行）。
- **実売行 0 件**: 検証サンプル（2026-06-01 精算）は個数・金額が全行ゼロ。現運用が部門打ち（PLUスキャン販売なし）である事実と整合する。929 スロットに既存登録コードを観測した。
- **CV17 import は メモリNo. キーの merge**: レジスターツール取扱説明書 `ECRCV17.pdf` p.71-73「データのエクスポートとインポート」に「一番左側には、メモリーNo.を記述してください」「インポートしたい列だけを、設定することができます」「各列のタイトルに従って取り込まれます」と明記。import は記載されたメモリNo. の行（と列）だけを更新する部分更新と読める。→ D-6 の根拠。注: 「未記載スロットは変更されない」ことまでは原文に明文化されておらず、部分更新（全置換ではない）は列単位取込み仕様からの推論。この点も §Deferred の実機確認トラックで裏取りする。
- **「PLU総枠5000を通常PLUとスキャニングPLUで共有」は仕様確認済み（2026-07-03 格上げ）**: SR-S4000 本体取扱説明書 `SRS4000_JA3.pdf` に「本機にはご購入時 5,000 本の PLU があり、最大 5,000 種の商品を設定できます」（PLUの便利な使い方）、「本機はお買い上げの状態で 4,784 本のスキャニング PLU を持っています」（スキャニングPLUの使い方）と明記。5,000 − 4,784 = 216 であり、「通常PLU216枠」は店固有の使用実績ではなく**工場出荷時のパーティション**。配分変更の設定はマニュアル検索で見当たらず、スキャニングPLU開始 217 は出荷時固定の境界として扱える（25-io / 33-biz の「現地観測値」表現は本設計 PR で「出荷時配分・取説確認済み」へ格上げする）。手元証跡 3 点も全て整合 — 設定書出しはメモリNo. 000217〜005000 のちょうど 4,784 行、Z004 売上レポートはレコード 0001〜5000 の単一空間、実登録スロットは 0217〜1145 に連続 929 件で 1〜216 はゼロ件。CV17 マニュアル側に数値記載はない（「機種によって異なります」のみ）。
- **未検証で残る adapter facts**: 実売データが載った Z004 の形状（返品・取消の符号、複数日結合）は実売発生後にのみ検証可能（Post-PLU Z004 track、PR #122 Follow-up 記録済み）。Diff ファイル部分 import 時のレジ側挙動の実機確認も同トラックで扱う。

## 設計論点と決定案

### D-1: 三分バケット（全体ブロックの廃止）— BIZ-04

**決定案**: prepare_plu_export は「PLU対象」だけを抽出・生成し、「要修正」（PLU対象なのに JAN が 13 桁数字でない / チェックディジット不正）は生成をブロックせず理由付きリストで結果に返す。「対象外」はそもそも抽出しない。

| バケット | 判定 | prepare での扱い |
|---|---|---|
| PLU対象 | plu_target=1 かつ valid 13桁JAN | 書出し行として生成 |
| 対象外（仕様） | plu_target=0 | 抽出しない。エラーでも警告でもない |
| 要修正（データ不備） | plu_target=1 かつ JAN 不備 | 生成から除外し、product_code + 理由のリストで返す。UI-08 が一覧表示し商品マスタ側の修正へ誘導 |

**却下代替案**: 現行の全体ブロック維持 — Full モードが実データで恒久失敗するため不可（§背景 1）。

### D-2: PLU対象の判定方式 — products スキーマ + BIZ-01

**決定案（案A推奨）**: products に明示フラグ `plu_target`（BOOLEAN NOT NULL）を追加する。

- 前例整合: `pos_stock_sync` の設計判断（指摘#9、「stock_unit='cm' からの自動判定は将来の柔軟性を下げる。明示フラグ + UI で初期値提案」）と同型。
- 初期値: 商品登録・編集（BIZ-01 / UI-01b）で jan_code が 13 桁数字なら 1、それ以外 0 を初期提案し、利用者が変更可能（②③のケースは利用者が off にする）。
- migration v3 方式: `ALTER TABLE products ADD COLUMN plu_target BOOLEAN NOT NULL DEFAULT 0` を実行し、同一トランザクション内で products への backfill 更新文を続けて実行する。v2 がテーブル再作成を要した理由（UNIQUE NOT NULL）は plu_target に該当しないため ALTER TABLE で足りる。DB DEFAULT は安全側の 0（レジ登録は opt-in）とし、新規登録時の値は BIZ-01 が明示的に設定する。
- migration v3 backfill: 既存行は `is_discontinued=0 かつ jan_code が 13 桁数字なら 1、それ以外 0`（廃番商品をレジ登録対象に戻さない）。13 桁数字の SQL 条件は `length(jan_code) = 13 AND jan_code NOT GLOB '*[^0-9]*'`（Codex R1 P2-3 対応、sqlite3 実機検証済み）。チェックディジット検証は SQL で行わず、アプリ側 prepare の「要修正」バケットで捕捉する。廃番切替（toggle_discontinue）時に plu_target を自動で 0 にするかは、スロット解放と不可分のため D-6 恒久設計 packet で決める（§Deferred）。
- 一括インポート（REQ-104 / IO-03 / BIZ-01）: 列を追加せず、backfill と同じ規則で自動導出する。列指定が必要になった場合は要求追加で扱う。

**却下代替案（案B）**: フラグを持たず jan_code 有効性から純導出 — ②「JANあり・使ってない」③「スポット品」を表現できない。「スキャンしない商品は jan_code を空にする」運用規約で回避する案は、jan_code の参照価値（伝票照合・Z004 突合・検索）を破壊するため不可。

**却下代替案（インストアコード発番）**: 20〜29 始まりの EAN-13 を店内発番しラベル印字して①④をスキャン可能化する案 — ラベルプリンタ導入とボタン単位の貼付作業を高齢の非IT利用者に課すことになり運用非現実。将来オプションとしてここに理由ごと記録し、採用しない。

### D-3: plu_dirty の意味の限定 — IO クエリ + UI-00

**決定案**: plu_dirty のスキーマは変更しない。意味を「**plu_target=1 の商品のうち**レジ未反映」に限定し、抽出・通知クエリに条件を足す。

- find_plu_dirty_products_for_plu / find_plu_dirty_products（list_plu_dirty 経由で UI-00 通知の源）に `AND plu_target = 1` を追加。
- Full モードの find_active_products_for_plu にも `AND plu_target = 1` を追加する（D-1「対象外は抽出しない」の帰結。dirty 側だけ変えると Full が対象外を巻き込む）。
- plu_target を 0→1 に変更した時は plu_dirty=1 をセット（レジ登録が必要になったため）。1→0 の変更はクエリ条件で自然に対象外になるため plu_dirty の値は触らない。
- 効果: §背景 2 の恒久残留と §背景 3 の通知汚染が、plu_dirty 側の migration なしで同時に解消する。
- 既存注記の改訂: [33-biz-plu-export-service.md](../../function-design/33-biz-plu-export-service.md) §16.7 の「既存の汎用関数（find_active_products / find_plu_dirty_products）は変更しない」は PR #12 時点の後方互換注記であり、本設計で find_plu_dirty_products に条件を足す決定と矛盾する。source docs 更新時に同注記を本設計参照へ改訂する。

### D-4: 同一JAN（グループコード）の dedup — BIZ-04

**決定案**: prepare の対象集合内で jan_code が重複する場合、selling_price と tax_rate が全一致なら product_code 最小の行を代表として 1 行に dedup する（決定的）。不一致なら該当 JAN 群を「要修正」リストへ回し（書出しから除外）、他の行の生成は続行する。

- 名称は代表行の name を使う。グループコード商品は色を区別しない既存方針（[master-tables.md](../../db-design/master-tables.md) 困りそうなケース）と整合。
- レジ側に同一スキャニングコードを複数スロット登録する状態を設計段階から排除する。
- **confirm との整合（rally R1 P2-1 対応）**: dedup で生成行は 1 行になっても、`target_product_codes` には dedup 群の**全メンバー**の product_code を含め、confirm で群全体の plu_dirty を下ろす。代表の JAN がレジに登録されれば非代表メンバーも実質反映済みであり、非代表だけ plu_dirty=1 が残ると D-3 で解消した通知汚染がグループコード商品で再発するため。この結果 `count`（書出し行数）と `target_product_codes.len()`（確認対象数）は一致しなくなることを contract に明記する。
- **confirm 側上限チェックの改訂（rally R2 P2-1 対応）**: [33-biz-plu-export-service.md](../../function-design/33-biz-plu-export-service.md) §16.4 step 2 の `product_codes.len() > SCANNING_PLU_EXPORT_LIMIT` 比較は、確認対象数が書出し行数を上回る新契約では false-positive を生む。step 2 の件数上限比較は撤廃し、既存の重複拒否（step 3）と全件存在確認（step 5a-b）を防御として維持する。

### D-5: 枠上限との関係 — BIZ-04（現行維持）

上限 4,784 件チェック（SCANNING_PLU_EXPORT_LIMIT）は現行維持。三分バケット化で JANなし商品群が対象から外れ、D-4 dedup で同一JAN群が収縮するため、対象件数は現行想定より減る方向。正確な対象件数の見積りは実データ投入後に確認し、上限接近時の UI 表示強化はその結果を見て判断する。

### D-6: メモリNo. 再採番問題（本 packet での最重要発見・恒久設計は後続 packet）

**事実**: CV17 import はメモリNo. キーの部分更新（§Adapter Facts）。一方、現行 [25-io-plu-formatter.md](../../function-design/25-io-plu-formatter.md) §12.3 は書出しのたびに `217 + 行インデックス` で再採番する。

**帰結（設計ギャップ）**:

1. **Diff ファイルをそのまま CV17 に import すると事故る**: 例えば 3 商品の Diff ファイルはスロット 217/218/219 に書き込まれ、初回 Full で同スロットに居た別商品を上書きする。上書きされた商品はレジから消え、同じ商品が旧スロットに残留し得る。
2. **Full でも商品増減で スロットがずれる**: product_code 昇順採番のため、商品の追加・廃番で以降全行のメモリNo. がずれる。件数が減った場合、末尾側の旧スロットに削除済み商品が残留する（import は記載スロットしか触れないため）。

**本 packet での決定**:

- 暫定運用ガード: 「CV17 への import に使ってよいのは Full 書出しファイルのみ。Diff 書出しはアプリ内の未反映確認・点検用途に限定し、CV17 取込み失敗以降の回復は保存済み Full 再投入または Full 再書出しで行う」を [67-ui-plu-export.md](../../function-design/67-ui-plu-export.md) の画面注意文言と操作手順に明記する（Codex R1 P2-1 対応で回復文言を 33-biz / DB_DESIGN D-2 / biz-task-specs / 67-ui に統一済み）。件数減少時の残留スロットは、実機確認トラックで挙動を確認するまで既知の制約として記録する。
- 恒久設計（スロット永続割当）: JAN（スキャニングコード）単位にメモリNo. を永続割当する方式（割当テーブルまたはカラム、廃番時のスロット解放と再利用規則を含む）を独立 packet で設計する。D-4 の「JAN 単位 dedup」はスロット割当キーが JAN になる恒久設計と整合するよう先に固定しておく。

**owner 判断事項**: 恒久設計を本設計と同じ実装 PR に畳み込むか、独立 PR にするか。推奨は独立（scope 膨張回避、[DEV_WORKFLOW.md](../../DEV_WORKFLOW.md) の scope control 原則）。

## Deferred（本 packet で確定しない事項の記録）

- スロット永続割当の恒久設計（D-6。独立 packet）
- 廃番商品のレジ側 PLU 削除・スロット解放（D-6 恒久設計と同居。現行 Diff 抽出が is_discontinued 条件を持たない事実も同 packet で扱う）
- 廃番切替（toggle_discontinue）時に plu_target を自動で 0 にするかの決定（スロット解放と不可分のため D-6 恒久設計 packet で扱う。migration v3 backfill は廃番商品を 0 にする規則を先行採用済み = D-2）
- 伝票グループコードによる入庫時 JAN 複数ヒットの選択 UI（UI-02 側。発生時に UI-02 設計へ追記）
- 実売 Z004 形状の検証と Diff 部分 import の実機挙動（Post-PLU track、PR #122 Follow-up 記録済み）
- 一括インポートへの plu_target 列追加（要求が出た時点で扱う）

## Acceptance Criteria

- D-1〜D-6 の各論点に決定または明示的 deferred が付き、未解決 placeholder が残っていない
- `bash scripts/doc-consistency-check.sh --target plan` PASS
- §Required Design Artifacts の全行に更新先とステータスが入っている
- 後続実装 packet（R3）が本 packet と source docs のみから起こせる（chat 履歴に依存しない）

## Design Sources

- Requirements / spec: `docs/inventory_system_v2.1.xlsx` ヒアリングシート（JANなし商品 4 分類の原典）、REQ-402 / REQ-101 / REQ-102 / SP-102-07
- Architecture: [ARCHITECTURE.md](../../ARCHITECTURE.md) BIZ-04 / POS Adapter Boundary、[biz-task-specs.md](../../architecture/biz-task-specs.md)
- Function / command / DTO: [33-biz-plu-export-service.md](../../function-design/33-biz-plu-export-service.md)、[25-io-plu-formatter.md](../../function-design/25-io-plu-formatter.md)、[30-biz-product-service.md](../../function-design/30-biz-product-service.md)、[20-io-product-repo.md](../../function-design/20-io-product-repo.md)、[67-ui-plu-export.md](../../function-design/67-ui-plu-export.md)、[53-ui-home.md](../../function-design/53-ui-home.md)
- DB: [DB_DESIGN.md](../../DB_DESIGN.md)、[master-tables.md](../../db-design/master-tables.md)、[22-mnt-migration.md](../../function-design/22-mnt-migration.md)
- Decision log: [decision-log.md](../../decision-log.md)（D-023 adapter boundary、D-027 plu_dirty 更新契約。本設計は次番号で起票）
- Adapter facts 証跡: `~/Downloads/inventory-field-check/approved-readable/`（`ECRCV17.pdf` p.71-73、Z004/設定書出しサンプル、CV17 スクリーンショット 2 点）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 33-biz（三分バケット・dedup・要修正リスト契約・§16.2 ExportMode::Full / Diff コメントをそれぞれ plu_target 条件込みへ改訂・§16.4 step 2 上限比較の撤廃・§16.7 汎用関数注記の改訂）、30-biz（create_product の plu_target 初期値ロジック / update_product での plu_target 受け付け + 0→1 時の plu_dirty=1 セット / commit_import のインライン plu_target 導出）、20-io（`_for_plu` 両関数 / dirty クエリへの plu_target 条件 / NewProduct・ProductUpdates・Product 構造体への plu_target フィールド追加） | updated in this design PR |
| Command / DTO / generated binding / wire shape | 41-cmd-pos: prepare 動作説明 + `PluExportPrepareResponse.excluded` / `PluExcludedProductResponse`（reason は snake_case 文字列）+ JSON 例、[cmd-task-specs.md](../../architecture/cmd-task-specs.md) CMD-08 行（Codex R1 P2-2 対応で wire shape を本 PR で UI/BIZ/CMD 一致させた）。bindings 再生成と list_plu_dirty 出力例更新は R3 実装 PR | updated in this design PR（bindings 再生成のみ R3） |
| DB / transaction / audit / rollback / migration | master-tables（plu_target カラム + 設計意図）、DB_DESIGN（カラム反映）、22-mnt-migration（v3 backfill 規則） | updated in this design PR |
| Screen / UI / route state / Japanese wording | 67-ui（対象外/要修正の表示、Full/Diff 用途の注意文言）、53-ui-home（通知条件の意味を注記）、[51-ui-product-form.md](../../function-design/51-ui-product-form.md)（plu_target の初期値提案 + 変更 UI のフォーム仕様追記。UI-01b 実装は Phase 3 のため方針確定まで） | updated in this design PR |
| CSV / TSV / report / import / export format | 25-io（変更なし。メモリNo. 再採番の既知制約を注記 + 「現地観測値として通常PLU216枠使用」表現を「工場出荷時配分 5,000 = 通常216 + スキャニング4,784、SR-S4000 取説確認済み」へ格上げ。33-biz 冒頭 note も同様）、adapter facts の固定先 | updated in this design PR |
| Durable decision / ADR | decision-log D-028: PLU対象フラグ + 三分バケット + Full-only 投入ガード | updated in this design PR |
| Architecture / 索引 | [ARCHITECTURE.md](../../ARCHITECTURE.md) BIZ-04 行、[biz-task-specs.md](../../architecture/biz-task-specs.md) BIZ-04 タスク仕様、FUNCTION_DESIGN.md / DB_DESIGN.md 最終更新ヘッダ | updated in this design PR |

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | CV17 import semantics・メモリNo.・Z004 二態は adapter facts。plu_target・三分バケット・plu_dirty 意味は app core 契約 | 本 packet §Adapter Facts、decision-log |
| Fact check / design decision split | 観測事実（マニュアル p.71-73、サンプルファイル構造、スクショ凡例）と設計判断（D-1〜D-6）を節分離済み | 本 packet 構成そのもの |
| Lifecycle / retry | prepare 再実行・要修正→修正→再書出し・plu_target 遷移時の plu_dirty 挙動を D-1/D-3 で定義 | 33-biz 更新、実装 packet Test Matrix |
| Operator workflow | 「Full のみ CV17 投入可」の手順制約、要修正リストから商品マスタ修正への導線 | 67-ui 更新 |
| Replacement path | レジ更改時は plu_target / 三分バケットは残り、CV17 profile・メモリNo. 規則だけ差し替え | ARCHITECTURE POS Adapter Boundary 整合確認 |
| Data safety / evidence | 実店舗データは repo 非取込み。構造・件数・マニュアルページ番号のみ記録 | 本 packet §Adapter Facts |
| Reporting / accounting semantics | 本設計は売上集計に触れない。Z004 二態の区別記録で売上/マスタの混同を予防 | §Adapter Facts |
| Manual verification | Diff 部分 import 実機挙動、残留スロット挙動、実売 Z004 形状は実機でのみ検証可能 | §Deferred、Post-PLU track |

## Design Readiness

- 既存 source docs で不足する点: 「PLU対象」概念そのものが未定義（本 packet が新設）。
- 本設計 PR で更新する source docs: §Required Design Artifacts の updated 行。
- 意図的 deferred: §Deferred の 5 項目。
- 昇格する恒久判断: decision-log 次番号（D-2 フラグ採用、D-1 三分バケット、D-6 暫定 Full-only ガード）。

最低限の設計チェック:

- Layer ownership: 判定フラグは products（DB）、初期値提案は BIZ-01、バケット分類と dedup は BIZ-04、表示は UI-08 / UI-00。CMD は薄いまま。
- Backend function design: 33-biz / 30-biz / 20-io の更新で定義。
- Command / DTO / data contract: 要修正リストの DTO 形状は R3 packet で確定（本 packet では概念のみ）。
- Persistence / transaction / audit impact: migration v3（カラム追加 + backfill）。plu_dirty のデータ migration は不要（D-3）。
- Operator workflow / Japanese UI wording: 「対象外」「要修正」「Full のみ投入可」の文言を 67-ui で確定。
- Error, empty, retry, and recovery behavior: 要修正リストは修正後の再 prepare で自然回復。対象 0 件時の既存エラーは維持。
- Testability and traceability IDs: REQ-402 配下。三分バケット・dedup・plu_target 遷移は R3 packet の Test Design Matrix で REQ 付きテスト化。

## Test Plan

本 packet（docs PR）の検証:

- `bash scripts/doc-consistency-check.sh --target plan` PASS
- `bash scripts/doc-consistency-check.sh` PASS（source docs 更新後）
- 後続 R3 実装 packet で列挙するテストの種: Full/Diff の三分バケット抽出、plu_target 遷移と plu_dirty、同一JAN dedup（一致 / 価格不一致）、要修正リスト返却、migration v3 backfill、UI-00 通知条件

## Review Focus

- D-2 案A（明示フラグ）採用の妥当性。pos_stock_sync 前例との整合、案B 却下理由の説得力
- D-4 dedup 規則（product_code 最小代表 + 価格不一致は要修正行き）が業務実態（グループ商品は色を区別しない）と矛盾しないか
- D-6 の事実認定（マニュアル p.71-73 の merge 解釈）と暫定ガード（Full-only 投入）の安全性
- 本 packet が「設計のみ」に収まっており、実装詳細（DTO 形状、SQL、UI レイアウト）へ踏み込み過ぎていないか
- §Deferred の各項目が拾える形（記録先明示）になっているか

## Rally Record

- Round 1（Plan agent / Sonnet、fact-check 指定）: P1 0 / P2 3 / P3 3。fact-check 13 項目一致、不一致 0（解釈注記 2 件）。P2-1（dedup 非代表メンバーの plu_dirty 残留）→ D-4 confirm 整合を追記、P2-2（51-ui-product-form 記載漏れ）→ §Required Design Artifacts へ追加、P2-3（33-biz §16.7 注記との矛盾）→ D-3 と artifacts 行へ改訂方針を追記。P3 3 件（merge 解釈の推論明記 / 用語置換 / 廃番 backfill 条件）も全採用。
- Round 2（Plan agent / Sonnet）: R1 修正 6 件すべて反映確認済み。廃番特価フローと D-2 backfill の両立、D-4 と confirm 契約の両立を追加突合。新規 P1 0 / P2 2 / P3 2。P2-1（confirm §16.4 step 2 上限比較の false-positive）→ 撤廃方針を D-4 に追記、P2-2（migration v3 方式・DEFAULT 未指定）→ ALTER TABLE + DEFAULT 0 + 同一TX backfill を D-2 に明記。P3 2 件（Full クエリ条件の明示 / ExportMode コメント改訂）も採用。
- Round 3（Plan agent / Sonnet）: R2 修正 4 件すべて反映確認済み。confirm step 2 撤廃後の防御充足（重複拒否 + 存在確認 + ローカルデスクトップ脅威モデル）と migration v3 の既存フレームワーク整合（22-mnt §3.2 / §9）を追加突合。**新規 P1/P2 0 → 収束**。P3 3 件（ExportMode::Diff コメント / 20-io 構造体フィールド / 30-biz 更新スコープの粒度）は artifacts 行へ同 round 内で反映済み。

## Self-Review

1. **前提条件**: 現行設計の破綻 3 段は 33-biz §16.3 step 5・master-tables 部門表・53-ui-home 通知条件の一次ソース直読みで裏取り済み（推測での断定なし）。CV17 merge 仕様はマニュアル p.71-73 の原文引用に基づく。
2. **検証手段**: 本 packet 自体は doc-consistency-check --target plan で機械検証。設計内容は D-1〜D-6 それぞれに却下代替案と理由を付し、レビュー可能な形にした。
3. **後処理**: 完了時は docs/archive/plans/ へ移動（相対パス変換）。Plans.md の backlog 項目「Post-UI-08 JANなし商品のPLU対象扱い設計」を進行中へ移し、完了時に削除する。
4. **制約整合**: 実店舗データの repo 非取込み（構造・件数のみ）、CMD 薄層維持、POS adapter boundary（メモリNo. 規則は adapter 側、plu_target は core 側)を確認済み。
5. **scope 規律**: D-6 恒久設計（スロット永続割当）は意図的に独立 packet へ分離し、本 packet の膨張を避けた。owner 判断事項として明示。
6. **commit 分割**: 本 packet 追加 → source docs 更新 → Plans.md 同期 の順で docs PR 1 本にまとめる（設計 PR の先例 = UI-08 design readiness と同型）。
7. **残リスク**: D-6 の「残留スロット」挙動は実機でしか確認できず、暫定ガードは運用注意文言に依存する。機械強制できない点を §Deferred と 67-ui 注意文言の両方に記録して緩和する。
