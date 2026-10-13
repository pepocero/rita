#!/usr/bin/env node
/**
 * Generate PBKDF2 password hash+salt compatible with functions/_shared/crypto.ts
 * Usage: node scripts/cms-hash-password.js "tu-contraseña"
 */
const crypto = require("crypto");

const PBKDF2_ITERATIONS = 12000;
const HASH_BYTES = 32;
const SALT_BYTES = 16;

function hashPassword(password, saltBuf) {
  const salt = saltBuf || crypto.randomBytes(SALT_BYTES);
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, HASH_BYTES, "sha256");
  return { hash: hash.toString("hex"), salt: salt.toString("hex") };
}

const password = process.argv[2];
if (!password) {
  console.error('Uso: node scripts/cms-hash-password.js "tu-contraseña"');
  process.exit(1);
}

const result = hashPassword(password);
console.log(JSON.stringify(result, null, 2));
console.log("\nSQL de ejemplo:");
console.log(
  `INSERT INTO users (username, password_hash, password_salt) VALUES ('admin', '${result.hash}', '${result.salt}');`
);
