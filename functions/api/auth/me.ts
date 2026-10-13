import { error, json, requireAuth } from "../../_shared/http";
import { ensureSchema } from "../../_shared/schema";
import type { Env } from "../../_shared/types";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await ensureSchema(context.env);
  const auth = await requireAuth(context.request, context.env);
  if (auth instanceof Response) return auth;
  return json({
    ok: true,
    user: { id: auth.user.id, username: auth.user.username },
  });
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "GET") return error("Método no permitido", 405);
  return onRequestGet(context);
};
