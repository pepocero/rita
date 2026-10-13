import { hashPassword, signJwt, verifyPassword } from "../../_shared/crypto";
import {
  SESSION_TTL_SECONDS,
  clientIp,
  error,
  isAllowedOrigin,
  json,
  readJson,
  sessionCookie,
} from "../../_shared/http";
import { bootstrapAdmin } from "../../_shared/bootstrap";
import { ensureSchema } from "../../_shared/schema";
import type { Env, UserRow } from "../../_shared/types";

const MAX_ATTEMPTS = 8;
const WINDOW_MINUTES = 15;

type LoginBody = { username?: string; password?: string };

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    if (!isAllowedOrigin(request) && request.headers.get("origin")) {
      return error("Origen no permitido", 403);
    }
    if (!env.JWT_SECRET) return error("Servidor sin JWT_SECRET configurado", 500);
    await ensureSchema(env);
    // Touch secrets so Wrangler includes them in the Pages env proxy.
    const bootstrapUser = env.CMS_ADMIN_USER;
    const bootstrapPassword = env.CMS_ADMIN_PASSWORD;
    const bootstrapForce = env.CMS_ADMIN_FORCE;
    await bootstrapAdmin({
      ...env,
      CMS_ADMIN_USER: bootstrapUser,
      CMS_ADMIN_PASSWORD: bootstrapPassword,
      CMS_ADMIN_FORCE: bootstrapForce,
    });

    const body = await readJson<LoginBody>(request);
    const username = (body?.username || "").trim();
    const password = body?.password || "";
    if (!username || !password) return error("Usuario y contraseña obligatorios", 400);
    if (username.length > 64 || password.length > 200) return error("Credenciales inválidas", 400);

    const ip = clientIp(request);

    const recent = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM login_attempts
       WHERE ip = ? AND success = 0 AND attempted_at > datetime('now', ?)`
    )
      .bind(ip, `-${WINDOW_MINUTES} minutes`)
      .first<{ c: number }>();

    if ((recent?.c || 0) >= MAX_ATTEMPTS) {
      return error("Demasiados intentos. Espera unos minutos.", 429);
    }

    const user = await env.DB.prepare(
      "SELECT id, username, password_hash, password_salt FROM users WHERE username = ? LIMIT 1"
    )
      .bind(username)
      .first<UserRow>();

    let ok = false;
    if (user) {
      ok = await verifyPassword(password, user.password_hash, user.password_salt);
    } else {
      // Mitigate user enumeration timing: do a dummy hash.
      await hashPassword(password, "00000000000000000000000000000000");
    }

    await env.DB.prepare(
      "INSERT INTO login_attempts (ip, username, success) VALUES (?, ?, ?)"
    )
      .bind(ip, username.slice(0, 64), ok ? 1 : 0)
      .run();

    if (!ok || !user) return error("Usuario o contraseña incorrectos", 401);

    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt(
      {
        sub: user.id,
        username: user.username,
        iat: now,
        exp: now + SESSION_TTL_SECONDS,
      },
      env.JWT_SECRET
    );

    return json(
      { ok: true, user: { id: user.id, username: user.username } },
      200,
      { "set-cookie": sessionCookie(token, request) }
    );
  } catch (err) {
    console.error("auth login", err);
    return error("Error interno de autenticación", 500);
  }
};
