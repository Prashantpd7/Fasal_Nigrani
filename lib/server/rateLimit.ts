/**
 * Minimal in-memory fixed-window rate limiter (§23). Good enough to stop a
 * demo-day abuse/cost blowout on AI endpoints; resets on server restart.
 * In production replace with a shared store (Redis/Upstash).
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }
  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  existing.count += 1;
  return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
}

/** Best-effort client identifier: forwarded IP (behind proxies) or "local". */
export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : "local-dev";
  return ip;
}
