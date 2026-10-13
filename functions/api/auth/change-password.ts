import { hashPassword, signJwt, verifyPassword } from "../../_shared/crypto";
import {
  SESSION_TTL_SECONDS,
  clientIp,
  error,
  isAllowedOrigin,
  json,
  readJson,
  requireAuth,
  sessionCookie,
} from "../../_shared/http";
import { validateNewPassword } from "../../_shared/passwordPolicy";
import { ensureSchema } from "../../_shared/schema";
import type { Env } from "../../_shared/types";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

type Body = {
  current_password?: string;
  new_password?: string;
  confirm_password?: string;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    if (!isAllowedOrigin(request)) return error("Origen no permitido", 403);
    if (!env.JWT_SECRET) return error("Servidor sin JWT_SECRET configurado", 500);

    await ensureSchema(env);

    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const ip = clientIp(request);
    const attemptKey = `pwdchange:${auth.user.id}`.slice(0, 64);

    const recent = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM login_attempts
       WHERE ip = ? AND username = ? AND success = 0 AND attempted_at > datetime('now', ?)`
    )
      .bind(ip, attemptKey, `-${WINDOW_MINUTES} minutes`)
      .first<{ c: number }>();

    if ((recent?.c || 0) >= MAX_ATTEMPTS) {
      return error("Demasiados intentos de cambio de contraseña. Espera unos minutos.", 429);
    }

    const body = await readJson<Body>(request);
    const currentPassword = body?.current_password || "";
    const newPassword = body?.new_password || "";
    const confirmPassword = body?.confirm_password || "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      return error("Completa todos los campos", 400);
    }
    if (newPassword !== confirmPassword) {
      return error("La confirmación no coincide con la nueva contraseña", 400);
    }

    const policy = validateNewPassword(newPassword, {
      username: auth.user.username,
      currentPassword,
    });
    if (!policy.ok) return error(policy.error, 400);

    const currentOk = await verifyPassword(
      currentPassword,
      auth.user.password_hash,
      auth.user.password_salt
    );

    await env.DB.prepare(
      "INSERT INTO login_attempts (ip, username, success) VALUES (?, ?, ?)"
    )
      .bind(ip, attemptKey, currentOk ? 1 : 0)
      .run();

    if (!currentOk) return error("La contraseña actual no es correcta", 401);

    const { hash, salt } = await hashPassword(newPassword);
    const nextVersion = (auth.user.token_version ?? 1) + 1;

    const updated = await env.DB.prepare(
      `UPDATE users
       SET password_hash = ?, password_salt = ?, token_version = ?
       WHERE id = ? AND token_version = ?`
    )
      .bind(hash, salt, nextVersion, auth.user.id, auth.user.token_version ?? 1)
      .run();

    if (!(updated.meta && updated.meta.changes)) {
      return error("No se pudo actualizar la contraseña. Recarga e inténtalo de nuevo.", 409);
    }

    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt(
      {
        sub: auth.user.id,
        username: auth.user.username,
        tv: nextVersion,
        iat: now,
        exp: now + SESSION_TTL_SECONDS,
      },
      env.JWT_SECRET
    );

    return json(
      {
        ok: true,
        message:
          "Contraseña actualizada. Las demás sesiones quedan invalidadas. Si CMS_ADMIN_PASSWORD sigue en Cloudflare, elimínalo.",
      },
      200,
      { "set-cookie": sessionCookie(token, request) }
    );
  } catch (err) {
    console.error("auth change-password", err);
    return error("Error al cambiar la contraseña", 500);
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") return error("Método no permitido", 405);
  return onRequestPost(context);
};
