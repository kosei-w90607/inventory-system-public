/**
 * FilePicker が受け取る dialog path / drop File.name から basename を返す。
 *
 * 通常の File.name は basename のみだが、Windows WebView2 の drag & drop では
 * 絶対パスが入る場合があるため、`/` と `\` の両方を区切りとして扱う。
 */
export function extractFilename(pathOrName: string): string {
  const lastSeparator = Math.max(pathOrName.lastIndexOf("/"), pathOrName.lastIndexOf("\\"));
  return lastSeparator >= 0 ? pathOrName.slice(lastSeparator + 1) : pathOrName;
}
