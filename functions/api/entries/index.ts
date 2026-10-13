import {
  error,
  isAllowedOrigin,
  json,
  readJson,
  requireAuth,
} from "../../_shared/http";
import { sanitizeHtml, slugify } from "../../_shared/sanitize";
import { ensureSchema } from "../../_shared/schema";
import type { EntryRow, Env } from "../../_shared/types";

const SERVICES = new Set(["musica", "radio", "escritos", "formacion", "terapias"]);
const TYPES = new Set(["texto", "video", "enlace"]);

type EntryBody = {
  slug?: string;
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await ensureSchema(context.env);
  const url = new URL(context.request.url);
  const service = (url.searchParams.get("service") || "").trim();
  const all = url.searchParams.get("all") === "1";

  let authUserId: number | null = null;
  if (all) {
    const auth = await requireAuth(context.request, context.env);
    if (auth instanceof Response) return auth;
    authUserId = auth.user.id;
  }

  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (service) {
    if (!SERVICES.has(service)) return error("Servicio inválido", 400);
    clauses.push("service = ?");
    binds.push(service);
  }
  if (!authUserId) {
    clauses.push("published = 1");
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await context.env.DB.prepare(
    `SELECT id, slug, title, service, type, summary, body_html, media_url, thumb_url,
            published, sort_order, created_at, updated_at
     FROM entries ${where}
     ORDER BY sort_order ASC, updated_at DESC
     LIMIT 200`
  )
    .bind(...binds)
    .all<EntryRow>();

  return json(
    { ok: true, entries: rows.results || [] },
    200,
    { "cache-control": authUserId ? "no-store" : "public, max-age=30" }
  );
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  await ensureSchema(env);
  if (!isAllowedOrigin(request)) return error("Origen no permitido", 403);
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = await readJson<EntryBody>(request);
  const title = (body?.title || "").trim();
  const service = (body?.service || "").trim();
  const type = (body?.type || "").trim();
  if (!title || title.length > 200) return error("Título inválido", 400);
  if (!SERVICES.has(service)) return error("Servicio inválido", 400);
  if (!TYPES.has(type)) return error("Tipo inválido", 400);

  let slug = slugify((body?.slug || title).trim());
  const existing = await env.DB.prepare("SELECT id FROM entries WHERE slug = ? LIMIT 1")
    .bind(slug)
    .first();
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const summary = sanitizeHtml(body?.summary || "").slice(0, 2000);
  const bodyHtml = sanitizeHtml(body?.body_html || "");
  const mediaUrl = sanitizeUrlField(body?.media_url || "");
  const thumbUrl = sanitizeUrlField(body?.thumb_url || "");
  const published = body?.published ? 1 : 0;
  const sortOrder = Number.isFinite(body?.sort_order) ? Number(body?.sort_order) : 0;

  const result = await env.DB.prepare(
    `INSERT INTO entries
      (slug, title, service, type, summary, body_html, media_url, thumb_url, published, sort_order, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      slug,
      title,
      service,
      type,
      summary,
      bodyHtml,
      mediaUrl,
      thumbUrl,
      published,
      sortOrder,
      auth.user.id
    )
    .run();

  return json({
    ok: true,
    entry: {
      id: result.meta.last_row_id,
      slug,
      title,
      service,
      type,
      summary,
      body_html: bodyHtml,
      media_url: mediaUrl,
      thumb_url: thumbUrl,
      published,
      sort_order: sortOrder,
    },
  });
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

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === "GET") return onRequestGet(context);
  if (context.request.method === "POST") return onRequestPost(context);
  return error("Método no permitido", 405);
};
