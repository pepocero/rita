import type { Env } from "./types";

let schemaReady = false;

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS content_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_path TEXT NOT NULL,
  block_key TEXT NOT NULL,
  html TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER,
  UNIQUE(page_path, block_key)
);
CREATE INDEX IF NOT EXISTS idx_content_blocks_page ON content_blocks(page_path);
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  service TEXT NOT NULL,
  type TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  media_url TEXT NOT NULL DEFAULT '',
  thumb_url TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER
);
CREATE INDEX IF NOT EXISTS idx_entries_service ON entries(service, published, sort_order);
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  attempted_at TEXT NOT NULL DEFAULT (datetime('now')),
  success INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip, attempted_at);
`;

async function ensureUserTokenVersion(env: Env): Promise<void> {
  const info = await env.DB.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  const hasTv = (info.results || []).some((col) => col.name === "token_version");
  if (!hasTv) {
    await env.DB.prepare(
      "ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1"
    ).run();
  }
}

/** Ensures CMS tables exist (safe to call repeatedly). Helps local Pages/D1 mismatches. */
export async function ensureSchema(env: Env): Promise<void> {
  if (schemaReady) return;
  const statements = INIT_SQL.split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((sql) => env.DB.prepare(sql));
  await env.DB.batch(statements);
  await ensureUserTokenVersion(env);
  schemaReady = true;
}
