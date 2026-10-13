import type { Env, JwtPayload, UserRow } from "./types";
import { verifyJwt } from "./crypto";

export const SESSION_COOKIE = "rita_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function error(message: string, status = 400): Response {
  return json({ ok: false, error: message }, status);
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function sessionCookie(token: string, request: Request, maxAge = SESSION_TTL_SECONDS): string {
  const secure = new URL(request.url).protocol === "https:";
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookie(request?: Request): string {
  const secure = request ? new URL(request.url).protocol === "https:" : true;
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Strict",
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Same-origin navigations / some clients omit Origin on GET; writes should send it.
    return request.method === "GET" || request.method === "HEAD";
  }
  try {
    const originHost = new URL(origin).host;
    const requestHost = new URL(request.url).host;
    return originHost === requestHost;
  } catch {
    return false;
  }
}

export async function requireAuth(
  request: Request,
  env: Env
): Promise<{ user: UserRow; payload: JwtPayload } | Response> {
  if (!env.JWT_SECRET) return error("Servidor sin JWT_SECRET configurado", 500);
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE];
  if (!token) return error("No autenticado", 401);
  const payload = await verifyJwt<JwtPayload>(token, env.JWT_SECRET);
  if (!payload?.sub || !payload.username) return error("Sesión inválida", 401);
  const user = await env.DB.prepare(
    "SELECT id, username, password_hash, password_salt FROM users WHERE id = ? LIMIT 1"
  )
    .bind(payload.sub)
    .first<UserRow>();
  if (!user) return error("Usuario no encontrado", 401);
  return { user, payload };
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function normalizePagePath(raw: string): string {
  let path = (raw || "/").trim();
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/index\.html$/i, "/");
  path = path.replace(/\/{2,}/g, "/");
  if (!path.endsWith("/")) path += "/";
  return path;
}
