const buckets = new Map<string, { count: number; resetAt: number }>();

export const enforceInMemoryRateLimit = ({
  bucket,
  limit,
  windowMs,
}: {
  bucket: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; retryAfterSeconds?: number } => {
  const now = Date.now();
  const current = buckets.get(bucket);

  if (!current || now >= current.resetAt) {
    buckets.set(bucket, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (current.count < limit) {
    current.count += 1;
    buckets.set(bucket, current);
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
};
