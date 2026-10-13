import { error, json, requireAuth } from "../../../_shared/http";
import { ensureSchema } from "../../../_shared/schema";
import type { EntryRow, Env } from "../../../_shared/types";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const slug = String(context.params.slug || "").trim();
  if (!slug || slug.length > 120) return error("Slug inválido", 400);
  await ensureSchema(context.env);

  const row = await context.env.DB.prepare(
    `SELECT id, slug, title, service, type, summary, body_html, media_url, thumb_url,
            published, sort_order, created_at, updated_at
     FROM entries WHERE slug = ? LIMIT 1`
  )
    .bind(slug)
    .first<EntryRow>();

  if (!row) return error("Entrada no encontrada", 404);
  if (!row.published) {
    const auth = await requireAuth(context.request, context.env);
    if (auth instanceof Response) return error("Entrada no encontrada", 404);
  }
  return json({ ok: true, entry: row }, 200, {
    "cache-control": row.published ? "public, max-age=60" : "no-store",
  });
};
