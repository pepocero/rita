import { clearSessionCookie, isAllowedOrigin, json, error } from "../../_shared/http";
import type { Env } from "../../_shared/types";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!isAllowedOrigin(context.request) && context.request.headers.get("origin")) {
    return error("Origen no permitido", 403);
  }
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie(context.request) });
};
