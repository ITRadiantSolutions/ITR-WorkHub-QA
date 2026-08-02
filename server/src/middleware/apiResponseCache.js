import crypto from "crypto";
import jwt from "jsonwebtoken";

const responseCache = new Map();
const CACHE_TTL_MS = Math.max(
  1000,
  Number(process.env.API_RESPONSE_CACHE_TTL_MS || 15000),
);
const MAX_CACHE_ENTRIES = 500;

const tokenKey = (token) =>
  crypto.createHash("sha256").update(token).digest("hex").slice(0, 24);

const clearExpiredEntries = () => {
  const now = Date.now();
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) responseCache.delete(key);
  }
};

export const clearApiResponseCache = () => {
  responseCache.clear();
};

export const apiResponseCache = (req, res, next) => {
  if (!req.originalUrl.startsWith("/api")) return next();

  if (req.method !== "GET") {
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        clearApiResponseCache();
      }
    });
    return next();
  }

  if (req.originalUrl.startsWith("/api/auth/")) return next();

  const token = req.headers.authorization?.split(" ")[1];
  if (!token || !process.env.JWT_SECRET) return next();

  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next();
  }

  const key = `${tokenKey(token)}:${req.originalUrl}`;
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    req.user = cached.user;
    res.setHeader("X-ItrOne-Cache", "HIT");
    res.setHeader("Vary", "Authorization");
    res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
    return res.status(cached.statusCode).json(cached.body);
  }
  if (cached) responseCache.delete(key);

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (responseCache.size >= MAX_CACHE_ENTRIES) {
        clearExpiredEntries();
        if (responseCache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = responseCache.keys().next().value;
          if (oldestKey) responseCache.delete(oldestKey);
        }
      }
      responseCache.set(key, {
        body,
        statusCode: res.statusCode,
        user: req.user,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      res.setHeader("X-ItrOne-Cache", "MISS");
      res.setHeader("Vary", "Authorization");
      res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
    }
    return originalJson(body);
  };

  next();
};
