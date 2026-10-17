const buckets = new Map();

function pruneExpired(now = Date.now()) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

const cleanupTimer = setInterval(() => pruneExpired(), 60_000);
cleanupTimer.unref?.();

function rateLimit({ windowMs, max, message, skipSuccessfulRequests = false }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.baseUrl || ''}${req.path}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    if (bucket.count >= max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({ message });
    }

    const increment = () => { bucket.count += 1; };
    if (skipSuccessfulRequests) {
      res.once('finish', () => {
        if (res.statusCode >= 400) increment();
      });
    } else {
      increment();
    }
    next();
  };
}

module.exports = { rateLimit };
