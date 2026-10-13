import { requireAuth } from "../_shared/http";
import { ensureSchema } from "../_shared/schema";
import type { EntryRow, Env } from "../_shared/types";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mediaEmbed(entry: EntryRow): string {
  const url = entry.media_url || "";
  if (!url) return "";
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (yt) {
    return `<div class="rita-entry-media"><iframe src="https://www.youtube.com/embed/${yt[1]}" title="${escapeHtml(entry.title)}" loading="lazy" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>`;
  }
  if (/open\.spotify\.com/.test(url)) {
    const embed = url.replace("open.spotify.com/", "open.spotify.com/embed/");
    return `<div class="rita-entry-media"><iframe src="${escapeHtml(embed)}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe></div>`;
  }
  if (entry.type === "enlace" || entry.type === "video") {
    return `<p class="rita-entry-link"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Abrir enlace</a></p>`;
  }
  return "";
}

function renderPage(entry: EntryRow): string {
  const serviceHref = `/${entry.service}/`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(entry.title)} | Rita Valero</title>
  <link rel="icon" href="/wp-content/uploads/2021/08/cropped-favicon-rita-valero-32x32.jpg" sizes="32x32" />
  <style>
    body{margin:0;font-family:Open Sans,Arial,sans-serif;color:#444;background:#fff;line-height:1.7}
    .wrap{max-width:860px;margin:0 auto;padding:40px 20px 80px}
    a{color:#b64ed8}
    .back{display:inline-block;margin-bottom:18px;text-decoration:none}
    h1{font-family:Georgia,"Times New Roman",serif;font-size:2rem;color:#222;margin:0 0 10px}
    .meta{color:#888;font-size:.9rem;margin-bottom:24px}
    .rita-entry-media iframe{width:100%;min-height:380px;border:0;border-radius:8px}
    .thumb{max-width:100%;height:auto;border-radius:8px;margin:0 0 20px}
    .body{font-size:1.05rem}
  </style>
</head>
<body>
  <main class="wrap">
    <a class="back" href="${serviceHref}">← Volver a ${escapeHtml(entry.service)}</a>
    <h1>${escapeHtml(entry.title)}</h1>
    <p class="meta">${escapeHtml(entry.service)} · ${escapeHtml(entry.type)}</p>
    ${entry.thumb_url ? `<img class="thumb" src="${escapeHtml(entry.thumb_url)}" alt="" />` : ""}
    ${entry.summary ? `<p>${escapeHtml(entry.summary.replace(/<[^>]+>/g, ""))}</p>` : ""}
    ${mediaEmbed(entry)}
    <div class="body">${entry.body_html || ""}</div>
  </main>
  <script src="/js/cms-hydrate.js"></script>
  <script src="/js/cms-edit.js"></script>
</body>
</html>`;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const slug = String(context.params.slug || "").trim();
  if (!slug) {
    return new Response("No encontrado", { status: 404 });
  }
  await ensureSchema(context.env);

  const entry = await context.env.DB.prepare(
    `SELECT id, slug, title, service, type, summary, body_html, media_url, thumb_url,
            published, sort_order, created_at, updated_at
     FROM entries WHERE slug = ? LIMIT 1`
  )
    .bind(slug)
    .first<EntryRow>();

  if (!entry) return new Response("No encontrado", { status: 404 });
  if (!entry.published) {
    const auth = await requireAuth(context.request, context.env);
    if (auth instanceof Response) return new Response("No encontrado", { status: 404 });
  }

  return new Response(renderPage(entry), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": entry.published ? "public, max-age=60" : "no-store",
    },
  });
};
