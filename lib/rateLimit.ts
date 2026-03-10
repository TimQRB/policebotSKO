type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

export function rateLimit(options: {
  key: string;
  windowMs: number;
  max: number;
}): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = buckets.get(options.key);

  if (!existing || existing.resetAt <= now) {
    const entry: Entry = { count: 1, resetAt: now + options.windowMs };
    buckets.set(options.key, entry);
    return { ok: true, remaining: options.max - 1, resetAt: entry.resetAt };
  }

  existing.count += 1;
  buckets.set(options.key, existing);
  const remaining = Math.max(0, options.max - existing.count);
  return { ok: existing.count <= options.max, remaining, resetAt: existing.resetAt };
}

