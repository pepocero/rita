import { error } from "../../_shared/http";
import type { Env } from "../../_shared/types";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  if (!env.MEDIA) return error("R2 no configurado", 500);
  const parts = params.key;
  const key = Array.isArray(parts) ? parts.join("/") : String(parts || "");
  if (!key || key.includes("..")) return error("Clave inválida", 400);

  const object = await env.MEDIA.get(key);
  if (!object) return error("No encontrado", 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
};
