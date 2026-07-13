# Test Design Matrix: 入出庫記録・在庫変動追跡 Design Phase

## Scope

Design-only R3 change for REQ-206 / REQ-207 / REQ-208 and related REQ-201〜205 / REQ-303 / REQ-902 source docs.

## Matrix

| ID | Spec / Decision | Risk | Check | Evidence |
|---|---|---|---|---|
| T1 | REQ-206 / TRACE-D1 | recent list を業務履歴と誤認する | `65-inventory-record-traceability.md` が records list/detail を定義 | doc review |
| T2 | REQ-207 / TRACE-D2 | 在庫変動から元記録へ辿れない | movement と business record の相互リンクが設計されている | doc review |
| T3 | REQ-208 / TRACE-D4/D5 | 取消/訂正で監査性が失われる | 物理削除禁止、取消理由、逆 movement、訂正は新記録作成を定義 | doc review |
| T4 | REQ-902 / TRACE-D3 | 操作ログを業務記録の代替にしてしまう | operation_logs の役割分担が明記されている | doc review |
| T5 | REQ-206〜208 | Deferred 要求で traceability WARN が出る | `cargo run --bin generate_traceability -- --check` PASS | command |
| T6 | Source docs | Markdown link / consistency drift | `bash scripts/doc-consistency-check.sh` PASS | command |

## Gates

- `bash scripts/doc-consistency-check.sh`
- `cd src-tauri && cargo run --bin generate_traceability -- --check`

## Manual / L3

Not required for this design-only PR. Future UI implementation PRs must define Windows native L3 checks per route.
