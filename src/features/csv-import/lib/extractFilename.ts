// src/features/csv-import/lib/extractFilename.ts
//
// File オブジェクトから filename を取り出す純関数。
// Windows path 区切り (\) も処理して basename のみ返す (drag&drop の OS native path 経路で
// File.name に絶対パスが入る webview 実装に備えた防御)。
// 設計: docs/function-design/55-ui-csv-import.md §55.1

/// File.name から basename を取り出す。
/// 通常 File.name は browser 側で basename のみだが、Windows webview の drag&drop で
/// 絶対パスが入る場合があるため、`/` と `\` の両方を区切りとして処理する。
export function extractFilename(file: File): string {
  const raw = file.name;
  const lastSep = Math.max(raw.lastIndexOf("/"), raw.lastIndexOf("\\"));
  return lastSep >= 0 ? raw.slice(lastSep + 1) : raw;
}
