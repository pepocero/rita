#!/usr/bin/env node
/**
 * Creates / updates the admin user in D1 (local or remote).
 *
 * Usage:
 *   set CMS_ADMIN_USER=admin
 *   set CMS_ADMIN_PASSWORD=...
 *   node scripts/cms-seed-admin.js --local
 *   node scripts/cms-seed-admin.js --remote
 *
 * Never commit the password. Prefer env vars.
 */
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PBKDF2_ITERATIONS = 12000;
const HASH_BYTES = 32;
const SALT_BYTES = 16;
const ROOT = path.resolve(__dirname, "..");

function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, HASH_BYTES, "sha256");
  return { hash: hash.toString("hex"), salt: salt.toString("hex") };
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

const remote = process.argv.includes("--remote");
const local = process.argv.includes("--local") || !remote;
const username = (process.env.CMS_ADMIN_USER || "admin").trim();
const password = process.env.CMS_ADMIN_PASSWORD || "";

if (!password || password.length < 10) {
  console.error(
    "Define CMS_ADMIN_PASSWORD (mín. 10 caracteres). Ejemplo PowerShell:\n" +
      '  $env:CMS_ADMIN_PASSWORD="TuClaveSegura123"\n' +
      "  $env:CMS_ADMIN_USER=\"admin\"\n" +
      "  node scripts/cms-seed-admin.js --local"
  );
  process.exit(1);
}

const { hash, salt } = hashPassword(password);
const sql =
  `DELETE FROM users WHERE username = '${esc(username)}';\n` +
  `INSERT INTO users (username, password_hash, password_salt) VALUES ('${esc(username)}', '${hash}', '${salt}');\n`;

const tmp = path.join(__dirname, `.seed-admin-${Date.now()}.sql`);
fs.writeFileSync(tmp, sql, "utf8");

const args = [
  "d1",
  "execute",
  "rita-cms",
  local && !remote ? "--local" : "--remote",
  ...(local && !remote ? ["--persist-to=.wrangler/state"] : []),
  "--file",
  tmp,
];

console.log("Ejecutando:", "wrangler", args.join(" "));
const result = spawnSync("npx", ["wrangler", ...args], {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
});

try {
  fs.unlinkSync(tmp);
} catch (_) {}

if (result.status !== 0) {
  process.exit(result.status || 1);
}
console.log(`Usuario '${username}' creado/actualizado correctamente.`);
