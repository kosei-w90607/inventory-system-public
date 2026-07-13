/**
 * 環境変数の型安全 accessor。
 *
 * Vite の import.meta.env.VITE_* は常に string。boolean 扱いは厳格 equality
 * (=== 'true') で評価し、'1' / 'yes' / 空文字等での意図しない true 判定を防ぐ。
 *
 * WARNING: VITE_ prefix 変数はクライアントサイド JS バンドルに平文で埋め込まれる。
 * 秘密情報 (KEY / TOKEN / SECRET / PASSWORD) は絶対に置かないこと。
 * 詳細: docs/UI_TECH_STACK.md §6.9 環境変数設計
 */

export const isDebug = import.meta.env.VITE_DEBUG === "true";
export const isMockMode = import.meta.env.VITE_MOCK_MODE === "true";
