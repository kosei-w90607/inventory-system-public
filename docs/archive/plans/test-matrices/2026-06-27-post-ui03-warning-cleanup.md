# Post UI-03 Warning Cleanup Test Matrix

| ID | Risk | Test / Gate | Expected |
|---|---|---|---|
| WARN-CLEANUP-1 | Vite chunk split introduces a new warning or masks the original warning | `npm run build` | build succeeds without 500kB chunk warning and without circular chunk warning |
| WARN-CLEANUP-2 | Deferred requirements hide all no-test problems | `cargo test --bin generate_traceability` | tests prove `deferred` is excluded but `required` still warns |
| WARN-CLEANUP-3 | Generated traceability drifts | `cargo run --bin generate_traceability -- --check` | exit 0 / WARN 0 |
| WARN-CLEANUP-4 | Docs / active plan state becomes inconsistent | `bash scripts/doc-consistency-check.sh --target plan` and full docs check | checks pass |
