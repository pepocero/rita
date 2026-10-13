export type Env = {
  DB: D1Database;
  MEDIA?: R2Bucket;
  JWT_SECRET: string;
  PUBLIC_MEDIA_BASE?: string;
  /** Optional: bootstrap first admin when users table is empty */
  CMS_ADMIN_USER?: string;
  /** Optional: bootstrap first admin when users table is empty (secret) */
  CMS_ADMIN_PASSWORD?: string;
  /** Temporary: force recreate bootstrap admin username */
  CMS_ADMIN_FORCE?: string;
};

export type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  password_salt: string;
  /** Incrementa al cambiar la contraseña; debe coincidir con el JWT (`tv`). */
  token_version?: number;
};

export type JwtPayload = {
  sub: number;
  username: string;
  iat: number;
  exp: number;
  /** Versión de credenciales; invalida sesiones previas tras cambio de contraseña. */
  tv?: number;
};

export type ContentBlockRow = {
  page_path: string;
  block_key: string;
  html: string;
  updated_at: string;
};

export type EntryRow = {
  id: number;
  slug: string;
  title: string;
  service: string;
  type: string;
  summary: string;
  body_html: string;
  media_url: string;
  thumb_url: string;
  published: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
