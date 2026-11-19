import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function normalizeForJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalizeForJson(nested)]),
    );
  }
  return value;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(normalizeForJson(value));
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256(secret: string, value: string | Buffer): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function secureHexEqual(expected: string, actual: string): boolean {
  if (!/^[a-f0-9]+$/i.test(expected) || !/^[a-f0-9]+$/i.test(actual))
    return false;
  if (
    expected.length !== actual.length ||
    expected.length % 2 !== 0 ||
    actual.length % 2 !== 0
  )
    return false;
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export function verifyHmacSha256(
  secret: string,
  value: string | Buffer,
  signature: string,
): boolean {
  return secureHexEqual(hmacSha256(secret, value), signature);
}

export function financialYearFor(date: Date): string {
  // Indian financial years turn over at midnight Asia/Kolkata (UTC+05:30).
  const indiaDate = new Date(date.getTime() + 330 * 60 * 1000);
  const year = indiaDate.getUTCFullYear();
  const startsIn = indiaDate.getUTCMonth() >= 3 ? year : year - 1;
  return `${startsIn}-${String(startsIn + 1).slice(-2)}`;
}

export function compactFinancialYear(financialYear: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(financialYear);
  if (!match) throw new Error("Invalid financial year");
  return `${match[1]?.slice(-2)}${match[2]}`;
}

export function splitIndianGst(
  taxPaise: number,
  supplierStateCode: string,
  customerStateCode: string,
) {
  if (supplierStateCode === customerStateCode) {
    const cgstPaise = Math.floor(taxPaise / 2);
    return {
      cgstPaise,
      sgstPaise: taxPaise - cgstPaise,
      igstPaise: 0,
    };
  }
  return { cgstPaise: 0, sgstPaise: 0, igstPaise: taxPaise };
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
