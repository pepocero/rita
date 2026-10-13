import {
  error,
  isAllowedOrigin,
  json,
  normalizePagePath,
  readJson,
  requireAuth,
} from "../_shared/http";
import { sanitizeHtml } from "../_shared/sanitize";
import { ensureSchema } from "../_shared/schema";
import type { ContentBlockRow, Env } from "../_shared/types";

type PutBody = {
  page_path?: string;
  blocks?: Array<{ block_key?: string; html?: string }>;
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    await ensureSchema(context.env);
    const url = new URL(context.request.url);
    const pagePath = normalizePagePath(url.searchParams.get("path") || "/");
    const rows = await context.env.DB.prepare(
      "SELECT page_path, block_key, html, updated_at FROM content_blocks WHERE page_path = ?"
    )
      .bind(pagePath)
      .all<ContentBlockRow>();

    const blocks: Record<string, string> = {};
    for (const row of rows.results || []) {
      blocks[row.block_key] = row.html;
    }
    return json(
      { ok: true, page_path: pagePath, blocks },
      200,
      { "cache-control": "public, max-age=30" }
    );
  } catch (err) {
    console.error("content GET", err);
    return error("Error al leer contenidos", 500);
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    await ensureSchema(env);
    if (!isAllowedOrigin(request)) return error("Origen no permitido", 403);
    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const body = await readJson<PutBody>(request);
    if (!body?.blocks || !Array.isArray(body.blocks) || !body.blocks.length) {
      return error("No hay bloques para guardar", 400);
    }
    const pagePath = normalizePagePath(body.page_path || "/");
    if (body.blocks.length > 200) return error("Demasiados bloques", 400);

    const statements = [];
    const saved: string[] = [];
    for (const block of body.blocks) {
      const key = (block.block_key || "").trim();
      if (!key || key.length > 120) continue;
      if (!/^[a-zA-Z0-9._:-]+$/.test(key)) continue;
      const html = sanitizeHtml(block.html || "");
      if (html.length > 200000) return error(`Bloque demasiado grande: ${key}`, 400);
      statements.push(
        env.DB.prepare(
          `INSERT INTO content_blocks (page_path, block_key, html, updated_at, updated_by)
           VALUES (?, ?, ?, datetime('now'), ?)
           ON CONFLICT(page_path, block_key) DO UPDATE SET
             html = excluded.html,
             updated_at = excluded.updated_at,
             updated_by = excluded.updated_by`
        ).bind(pagePath, key, html, auth.user.id)
      );
      saved.push(key);
    }

    if (!statements.length) return error("Ningún bloque válido", 400);
    await env.DB.batch(statements);
    return json({ ok: true, page_path: pagePath, saved });
  } catch (err) {
    console.error("content PUT", err);
    return error("Error al guardar contenidos", 500);
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === "GET") return onRequestGet(context);
  if (context.request.method === "PUT") return onRequestPut(context);
  return error("Método no permitido", 405);
};
