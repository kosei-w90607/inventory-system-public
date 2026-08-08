const COMPOSED_DIGITS_ONLY = /^[0-9０-９]+$/;

export function isComposedDigitsOnly(value: string): boolean {
  return COMPOSED_DIGITS_ONLY.test(value);
}

export function normalizeComposedDigits(value: string): string {
  if (!isComposedDigitsOnly(value)) return value;

  return value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}
