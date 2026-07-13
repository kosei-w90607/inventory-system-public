Run full code quality check: format, lint, and test.
Report each step's result. Fix any formatting issues automatically.

Step 1: Format
```bash
cargo fmt
```

Step 2: Lint
```bash
cargo clippy -- -D warnings 2>&1
```

Step 3: Test
```bash
cargo test 2>&1
```

If clippy has warnings, fix them and re-run.
