import { error, isAllowedOrigin, json, requireAuth } from "../_shared/http";
import type { Env } from "../_shared/types";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  if (!isAllowedOrigin(request)) return error("Origen no permitido", 403);
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  if (!env.MEDIA) return error("R2 no configurado (binding MEDIA)", 500);

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return error("Se espera multipart/form-data", 400);
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return error("Archivo requerido", 400);
  if (!ALLOWED_TYPES.has(file.type)) return error("Tipo de archivo no permitido", 400);
  if (file.size <= 0 || file.size > MAX_BYTES) return error("Archivo demasiado grande (máx. 5MB)", 400);

  const ext = file.type.split("/")[1] || "bin";
  const key = `uploads/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const bytes = await file.arrayBuffer();
  await env.MEDIA.put(key, bytes, {
    httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000" },
  });

  const base = (env.PUBLIC_MEDIA_BASE || "").replace(/\/$/, "");
  const url = base ? `${base}/${key}` : `/api/media/${key}`;
  return json({ ok: true, key, url });
};
