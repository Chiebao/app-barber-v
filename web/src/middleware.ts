import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "https://barberpro-mauve.vercel.app",
  "https://barberpro.com.br",
  ...(process.env.NEXT_PUBLIC_BASE_URL ? [process.env.NEXT_PUBLIC_BASE_URL] : []),
  "http://localhost:3000",
];

// ──── Rate Limiter (in-memory, per-IP) ────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  "/api/auth/login":        { max: 10, windowMs: 60_000 },
  "/api/auth/register":     { max: 5,  windowMs: 60_000 },
  "/api/auth/refresh":      { max: 20, windowMs: 60_000 },
  "/api/auth/recover":      { max: 5,  windowMs: 60_000 },
  "/api/admin":             { max: 5,  windowMs: 60_000 },
  "/api/appointments":      { max: 15, windowMs: 60_000 },
  "/api/waitlist":          { max: 10, windowMs: 60_000 },
  "/api/track":             { max: 30, windowMs: 60_000 },
  "/api/me/account":        { max: 5,  windowMs: 60_000 },
};

function getRateLimitKey(ip: string, path: string) {
  return `${ip}:${path}`;
}

function isRateLimited(ip: string, path: string): { limited: boolean; remaining: number; resetAt: number } {
  const config = Object.entries(RATE_LIMITS).find(([prefix]) => path.startsWith(prefix));
  if (!config) return { limited: false, remaining: -1, resetAt: 0 };

  const [, { max, windowMs }] = config;
  const key = getRateLimitKey(ip, config[0]);
  const now = Date.now();

  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: max - 1, resetAt: now + windowMs };
  }

  entry.count++;
  if (entry.count > max) {
    return { limited: true, remaining: 0, resetAt: entry.resetAt };
  }

  return { limited: false, remaining: max - entry.count, resetAt: entry.resetAt };
}

// Limpa entries expiradas a cada 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 60_000);

// ──── Middleware ────
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get("origin") || "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";

  // ── CORS (apenas rotas /api) ──
  if (pathname.startsWith("/api")) {
    if (req.method === "OPTIONS") {
      const res = new NextResponse(null, { status: 204 });
      if (ALLOWED_ORIGINS.includes(origin)) {
        res.headers.set("Access-Control-Allow-Origin", origin);
      }
      res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.headers.set("Access-Control-Max-Age", "86400");
      return res;
    }
  }

  // ── Rate limiting (rotas públicas) ──
  if (pathname.startsWith("/api")) {
    const { limited, remaining, resetAt } = isRateLimited(ip, pathname);
    if (limited) {
      return NextResponse.json(
        { error: "Muitas requisições. Tente novamente em instantes." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const res = NextResponse.next();

    // ── CORS headers ──
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.headers.set("Access-Control-Allow-Origin", origin);
    }

    // ── Rate limit headers ──
    if (remaining >= 0) {
      res.headers.set("X-RateLimit-Remaining", String(remaining));
    }

    // ── Security headers ──
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.headers.set("X-DNS-Prefetch-Control", "off");

    return res;
  }

  // ── Security headers para páginas HTML ──
  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
