import {
  error,
  isAllowedOrigin,
  json,
  readJson,
  requireAuth,
} from "../../_shared/http";
import { sanitizeHtml } from "../../_shared/sanitize";
import { ensureSchema } from "../../_shared/schema";
import type { EntryRow, Env } from "../../_shared/types";

const SERVICES = new Set(["musica", "radio", "escritos", "formacion", "terapias"]);
const TYPES = new Set(["texto", "video", "enlace"]);

type EntryBody = {
  title?: string;
  service?: string;
  type?: string;
  summary?: string;
  body_html?: string;
  media_url?: string;
  thumb_url?: string;
  published?: boolean | number;
  sort_order?: number;
};

function sanitizeUrlField(value: string): string {
  const v = value.trim();
  if (!v) return "";
  const lower = v.toLowerCase();
  if (
    lower.startsWith("https://") ||
    lower.startsWith("http://") ||
    lower.startsWith("/") ||
    lower.startsWith("./")
  ) {
    return v.slice(0, 2000);
  }
  return "";
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await ensureSchema(context.env);
  const id = Number(context.params.id);
  if (!Number.isFinite(id)) return error("ID inválido", 400);
  const row = await context.env.DB.prepare(
    `SELECT id, slug, title, service, type, summary, body_html, media_url, thumb_url,
            published, sort_order, created_at, updated_at
     FROM entries WHERE id = ? LIMIT 1`
  )
    .bind(id)
    .first<EntryRow>();
  if (!row) return error("Entrada no encontrada", 404);
  if (!row.published) {
    const auth = await requireAuth(context.request, context.env);
    if (auth instanceof Response) return error("Entrada no encontrada", 404);
  }
  return json({ ok: true, entry: row });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  if (!isAllowedOrigin(request)) return error("Origen no permitido", 403);
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!Number.isFinite(id)) return error("ID inválido", 400);
  const existing = await env.DB.prepare("SELECT id FROM entries WHERE id = ? LIMIT 1")
    .bind(id)
    .first();
  if (!existing) return error("Entrada no encontrada", 404);

  const body = await readJson<EntryBody>(request);
  const title = (body?.title || "").trim();
  const service = (body?.service || "").trim();
  const type = (body?.type || "").trim();
  if (!title || title.length > 200) return error("Título inválido", 400);
  if (!SERVICES.has(service)) return error("Servicio inválido", 400);
  if (!TYPES.has(type)) return error("Tipo inválido", 400);

  const summary = sanitizeHtml(body?.summary || "").slice(0, 2000);
  const bodyHtml = sanitizeHtml(body?.body_html || "");
  const mediaUrl = sanitizeUrlField(body?.media_url || "");
  const thumbUrl = sanitizeUrlField(body?.thumb_url || "");
  const published = body?.published ? 1 : 0;
  const sortOrder = Number.isFinite(body?.sort_order) ? Number(body?.sort_order) : 0;

  await env.DB.prepare(
    `UPDATE entries SET
      title = ?, service = ?, type = ?, summary = ?, body_html = ?,
      media_url = ?, thumb_url = ?, published = ?, sort_order = ?,
      updated_at = datetime('now'), updated_by = ?
     WHERE id = ?`
  )
    .bind(
      title,
      service,
      type,
      summary,
      bodyHtml,
      mediaUrl,
      thumbUrl,
      published,
      sortOrder,
      auth.user.id,
      id
    )
    .run();

  return json({ ok: true, id });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  if (!isAllowedOrigin(request)) return error("Origen no permitido", 403);
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const id = Number(params.id);
  if (!Number.isFinite(id)) return error("ID inválido", 400);
  await env.DB.prepare("DELETE FROM entries WHERE id = ?").bind(id).run();
  return json({ ok: true });
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const method = context.request.method;
  if (method === "GET") return onRequestGet(context);
  if (method === "PUT") return onRequestPut(context);
  if (method === "DELETE") return onRequestDelete(context);
  return error("Método no permitido", 405);
};
