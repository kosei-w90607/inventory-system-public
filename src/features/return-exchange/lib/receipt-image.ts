import type { SaveImageRequest } from "@/lib/bindings";

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

export function getAllowedReceiptExtension(fileName: string): string | null {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_EXTENSIONS.has(extension) ? extension : null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function buildSaveImageRequest(file: File): Promise<SaveImageRequest> {
  const extension = getAllowedReceiptExtension(file.name);
  if (extension === null) {
    throw new Error("jpg / jpeg / png / gif / webp の画像を選択してください");
  }
  const buffer = await file.arrayBuffer();
  return {
    image_base64: bytesToBase64(new Uint8Array(buffer)),
    extension,
  };
}
