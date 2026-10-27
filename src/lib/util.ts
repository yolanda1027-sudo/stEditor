export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

// 字串或字串陣列都轉成去空白、去重複的陣列（舊資料的 tags 可能是「a, b, c」）
export function toStringArray(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value.map((v) => (typeof v === 'string' ? v : String(v ?? '')))
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return dedupe(raw.map((v) => v.trim()).filter(Boolean));
}

export function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = v.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 回傳 incoming 中因為已存在（或在 incoming 內重複）而不會被加入的值 */
export function rejected(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map((v) => v.toLocaleLowerCase()));
  return incoming.filter((v) => {
    const key = v.trim().toLocaleLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
}

export function getPreview(value: string | string[] | undefined, max = 60): string {
  const text = Array.isArray(value) ? value.join('、') : (value ?? '');
  const oneLine = text.trim().replace(/\s+/g, ' ');
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

export function countChars(value: string | string[] | undefined): number {
  return Array.isArray(value) ? value.reduce((n, v) => n + v.length, 0) : (value ?? '').length;
}
