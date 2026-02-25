/**
 * Express middleware for the collaboration tracker.
 *
 * - Rate limiting per IP (sliding window)
 * - CORS with configurable origins
 * - Request logging
 * - Global error handler
 */

import type { Request, Response, NextFunction } from "express";
import type { AppConfig } from "./config.js";

/** Simple in-memory rate limiter using a sliding window. */
export function rateLimiter(windowMs = 60_000, maxRequests = 100) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Cleanup stale entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of hits) {
      if (val.resetAt < now) hits.delete(key);
    }
  }, 60_000);

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || entry.resetAt < now) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count++;
    if (entry.count > maxRequests) {
      res.status(429).json({
        error: "Too many requests",
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}

/** CORS middleware with configurable origins. */
export function cors(config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && config.corsOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Max-Age", "86400");
    }

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  };
}

/** Request logger. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? "warn" : "info";
    console[level](
      `[http] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
    );
  });
  next();
}

/** Global error handler — catches unhandled errors in route handlers. */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("[error]", err.message);
  res.status(500).json({ error: "Internal server error" });
}
