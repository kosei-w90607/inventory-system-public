# 日報取込み synthetic fixture

`Z001_260321.CSV`、`Z002_260321.CSV`、`Z005_260321.CSV` は、`src-tauri/src/io/daily_report_parser.rs` の REQ-401 happy-path test リテラルを実ファイル化した同一日付（2026-03-21）の bundle です。すべて匿名化した synthetic 値であり、実店舗の商品名・売上・支払・部門実績を含みません。

CSV は UTF-8 テキストのまま保存していません。Rust source 内の UTF-8 リテラルを、parser test helper `encode_cp932` と同じ次の処理で CP932 バイト列へ変換して書き出しています。

```rust
let (encoded, _, _) = encoding_rs::SHIFT_JIS.encode(text);
std::fs::write(path, encoded.as_ref())?;
```

内容を更新する場合は、先に `daily_report_parser.rs` の source literal と期待値を同期し、同じ `encoding_rs::SHIFT_JIS.encode` で 3 file を再生成してください。エディタで UTF-8 として上書き保存しないでください。
