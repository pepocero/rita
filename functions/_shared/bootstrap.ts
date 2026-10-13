import { hashPassword } from "./crypto";
import type { Env } from "./types";

/**
 * If users table is empty and CMS_ADMIN_USER + CMS_ADMIN_PASSWORD secrets exist,
 * create the first admin. Password is never returned or logged.
 * Set CMS_ADMIN_FORCE=1 (temporary) to recreate/overwrite that username.
 */
export async function bootstrapAdmin(env: Env): Promise<void> {
  const username = (env.CMS_ADMIN_USER || "").trim();
  const password = env.CMS_ADMIN_PASSWORD || "";
  if (!username || password.length < 10) return;

  const force = (env as Env & { CMS_ADMIN_FORCE?: string }).CMS_ADMIN_FORCE === "1";
  const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM users").first<{ c: number }>();
  if ((row?.c || 0) > 0 && !force) return;

  const { hash, salt } = await hashPassword(password);
  if (force) {
    await env.DB.prepare("DELETE FROM users WHERE username = ?").bind(username).run();
  }
  await env.DB.prepare(
    "INSERT INTO users (username, password_hash, password_salt) VALUES (?, ?, ?)"
  )
    .bind(username, hash, salt)
    .run();
}
