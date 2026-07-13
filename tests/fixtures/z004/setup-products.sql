-- tests/fixtures/z004/setup-products.sql
-- Z004 合成 fixture 用 55 商品 seed (Track 1 / PR #62 Plan B)
--
-- 仕様根拠:
--   - schema_v1.rs L29-47 products テーブル定義 (product_code PRIMARY KEY、jan_code UNIQUE 制約なし)
--   - seed_demo.rs DEPARTMENT_SEED_PLAN (id=3 毛糸を採用、seed_demo の最初の seed 部門)
--   - parser docs §13.3 (matched 用 13 桁 EAN-13、normalize_jan 後の値を予め格納)
--
-- 対象 fixture:
--   - normal-small.csv (5 商品): JAN 4900000000001~4900000000005 (R119 検証用 4900000099999 は別商品で除外)
--   - duplicate-same-date.csv (5 商品): JAN 4900000000001~4900000000005 (同 range、別 file_hash)
--   - normal-large.csv (50 商品): JAN 4900000000001~4900000000050 (47 matched + 3 空スロット)
--   - normal-invalidate.csv (3 商品): JAN 4900000000010/0020/0030 (normal-large の subset)
--   - error-invalid-format.csv (6 行): JAN 4900000000011/0012 (matched 2)、4900000000013/0014 はエラー行で参照されるが seed しなくても error 経路は同様
--
-- 実行方法:
--   Windows native: sqlite3 "%APPDATA%\<app-name>\inventory.db" < tests/fixtures/z004/setup-products.sql
--   WSL2 dev:       sqlite3 ~/.local/share/<app-name>/inventory.db < tests/fixtures/z004/setup-products.sql
--
-- ON CONFLICT(product_code) DO NOTHING:
--   - product_code が PRIMARY KEY = 暗黙 UNIQUE で conflict target 適格
--   - jan_code は INDEX のみで UNIQUE 制約なしのため conflict target に使えない (schema_v1.rs L31)

BEGIN;

INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0001', '4900000000001', '手芸 fixture 商品 Z004FIX-0001', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0002', '4900000000002', '手芸 fixture 商品 Z004FIX-0002', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0003', '4900000000003', '手芸 fixture 商品 Z004FIX-0003', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0004', '4900000000004', '手芸 fixture 商品 Z004FIX-0004', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0005', '4900000000005', '手芸 fixture 商品 Z004FIX-0005', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0006', '4900000000006', '手芸 fixture 商品 Z004FIX-0006', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0007', '4900000000007', '手芸 fixture 商品 Z004FIX-0007', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0008', '4900000000008', '手芸 fixture 商品 Z004FIX-0008', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0009', '4900000000009', '手芸 fixture 商品 Z004FIX-0009', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0010', '4900000000010', '手芸 fixture 商品 Z004FIX-0010', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0011', '4900000000011', '手芸 fixture 商品 Z004FIX-0011', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0012', '4900000000012', '手芸 fixture 商品 Z004FIX-0012', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0013', '4900000000013', '手芸 fixture 商品 Z004FIX-0013', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0014', '4900000000014', '手芸 fixture 商品 Z004FIX-0014', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0015', '4900000000015', '手芸 fixture 商品 Z004FIX-0015', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0016', '4900000000016', '手芸 fixture 商品 Z004FIX-0016', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0017', '4900000000017', '手芸 fixture 商品 Z004FIX-0017', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0018', '4900000000018', '手芸 fixture 商品 Z004FIX-0018', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0019', '4900000000019', '手芸 fixture 商品 Z004FIX-0019', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0020', '4900000000020', '手芸 fixture 商品 Z004FIX-0020', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0021', '4900000000021', '手芸 fixture 商品 Z004FIX-0021', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0022', '4900000000022', '手芸 fixture 商品 Z004FIX-0022', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0023', '4900000000023', '手芸 fixture 商品 Z004FIX-0023', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0024', '4900000000024', '手芸 fixture 商品 Z004FIX-0024', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0025', '4900000000025', '手芸 fixture 商品 Z004FIX-0025', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0026', '4900000000026', '手芸 fixture 商品 Z004FIX-0026', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0027', '4900000000027', '手芸 fixture 商品 Z004FIX-0027', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0028', '4900000000028', '手芸 fixture 商品 Z004FIX-0028', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0029', '4900000000029', '手芸 fixture 商品 Z004FIX-0029', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0030', '4900000000030', '手芸 fixture 商品 Z004FIX-0030', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0031', '4900000000031', '手芸 fixture 商品 Z004FIX-0031', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0032', '4900000000032', '手芸 fixture 商品 Z004FIX-0032', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0033', '4900000000033', '手芸 fixture 商品 Z004FIX-0033', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0034', '4900000000034', '手芸 fixture 商品 Z004FIX-0034', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0035', '4900000000035', '手芸 fixture 商品 Z004FIX-0035', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0036', '4900000000036', '手芸 fixture 商品 Z004FIX-0036', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0037', '4900000000037', '手芸 fixture 商品 Z004FIX-0037', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0038', '4900000000038', '手芸 fixture 商品 Z004FIX-0038', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0039', '4900000000039', '手芸 fixture 商品 Z004FIX-0039', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0040', '4900000000040', '手芸 fixture 商品 Z004FIX-0040', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0041', '4900000000041', '手芸 fixture 商品 Z004FIX-0041', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0042', '4900000000042', '手芸 fixture 商品 Z004FIX-0042', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0043', '4900000000043', '手芸 fixture 商品 Z004FIX-0043', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0044', '4900000000044', '手芸 fixture 商品 Z004FIX-0044', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0045', '4900000000045', '手芸 fixture 商品 Z004FIX-0045', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0046', '4900000000046', '手芸 fixture 商品 Z004FIX-0046', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0047', '4900000000047', '手芸 fixture 商品 Z004FIX-0047', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0048', '4900000000048', '手芸 fixture 商品 Z004FIX-0048', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0049', '4900000000049', '手芸 fixture 商品 Z004FIX-0049', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0050', '4900000000050', '手芸 fixture 商品 Z004FIX-0050', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0051', '4900000000051', '手芸 fixture 商品 Z004FIX-0051', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0052', '4900000000052', '手芸 fixture 商品 Z004FIX-0052', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0053', '4900000000053', '手芸 fixture 商品 Z004FIX-0053', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0054', '4900000000054', '手芸 fixture 商品 Z004FIX-0054', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;
INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, stock_quantity, created_at, updated_at)
VALUES ('Z004FIX-0055', '4900000000055', '手芸 fixture 商品 Z004FIX-0055', 3, 1000, 600, 100, '2026-05-16T00:00:00', '2026-05-16T00:00:00')
ON CONFLICT(product_code) DO NOTHING;

COMMIT;

-- 確認: SELECT COUNT(*) FROM products WHERE product_code LIKE 'Z004FIX-%';  -- 期待: 55
