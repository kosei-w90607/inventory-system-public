import { normalizeComposedDigits } from "@/components/patterns/normalizeComposedDigits";

const JAN_LENGTH_ERROR = "JANコードは13桁または8桁で入力してください";
const JAN_CHECK_DIGIT_ERROR =
  "JANコードのチェックディジットが一致しません。入力値を確認してください";

export function normalizeJanCodeCandidate(value: string): string {
  return normalizeComposedDigits(value.trim());
}

export function validateJanCode(value: string): string | null {
  if (!/^(?:\d{8}|\d{13})$/.test(value)) return JAN_LENGTH_ERROR;

  const digits = Array.from(value, (digit) => Number(digit));
  const firstWeight = value.length === 8 ? 3 : 1;
  const sum = digits
    .slice(0, -1)
    .reduce(
      (total, digit, index) => total + digit * (index % 2 === 0 ? firstWeight : 4 - firstWeight),
      0,
    );
  const expectedCheckDigit = (10 - (sum % 10)) % 10;

  return expectedCheckDigit === digits[digits.length - 1] ? null : JAN_CHECK_DIGIT_ERROR;
}

export function suggestPluTarget(value: string | null): boolean {
  return value !== null && /^\d{13}$/.test(normalizeJanCodeCandidate(value));
}
