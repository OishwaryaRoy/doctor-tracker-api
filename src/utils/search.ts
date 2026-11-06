const MAX_QUERY_TOKENS = 5;

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function buildSearchTokens(words: string[], whole: string[] = []): string[] {
  const tokens = new Set<string>();
  for (const value of words) tokenize(value).forEach((token) => tokens.add(token));
  for (const value of whole) {
    const normalized = value.trim().toLowerCase();
    if (normalized) tokens.add(normalized);
  }
  return [...tokens];
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function buildSearchFilter(query: string | undefined): Record<string, unknown> {
  if (!query) return {};

  const raw = query.trim().toLowerCase();
  const tokens = tokenize(raw).slice(0, MAX_QUERY_TOKENS);

  const conditions: Record<string, unknown>[] = [];
  if (tokens.length > 0) {
    conditions.push({
      $and: tokens.map((token) => ({ searchTokens: { $regex: `^${escapeRegex(token)}` } })),
    });
  }
  const looksLikePhone = /^[\d\s+()-]+$/.test(raw) && digitsOnly(raw).length >= 3;
  if (raw.includes('@')) {
    conditions.push({ searchTokens: { $regex: `^${escapeRegex(raw)}` } });
  } else if (looksLikePhone) {
    conditions.push({ searchTokens: { $regex: `^${digitsOnly(raw)}` } });
  }

  if (conditions.length === 0) return { searchTokens: { $in: [] } };
  return conditions.length === 1 ? conditions[0]! : { $or: conditions };
}
