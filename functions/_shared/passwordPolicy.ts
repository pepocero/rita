const MIN_LEN = 12;
const MAX_LEN = 200;

/** Contraseñas demasiado habituales (lista corta, no exhaustiva). */
const BLOCKLIST = new Set(
  [
    "password",
    "password123",
    "password1234",
    "123456789012",
    "qwertyuiopas",
    "adminadmin12",
    "changeme1234",
    "ritavalero12",
    "ritavalero123",
  ].map((s) => s.toLowerCase())
);

export type PasswordPolicyResult = { ok: true } | { ok: false; error: string };

/**
 * Política orientada a longitud + diversidad básica (NIST + rechazo de basura obvia).
 * No registra ni devuelve la contraseña.
 */
export function validateNewPassword(
  password: string,
  opts: { username?: string; currentPassword?: string } = {}
): PasswordPolicyResult {
  if (typeof password !== "string") return { ok: false, error: "Contraseña inválida" };
  if (password.length < MIN_LEN) {
    return { ok: false, error: `La nueva contraseña debe tener al menos ${MIN_LEN} caracteres` };
  }
  if (password.length > MAX_LEN) {
    return { ok: false, error: "La nueva contraseña es demasiado larga" };
  }
  // Evitar caracteres de control / null.
  if (/[\u0000-\u001F\u007F]/.test(password)) {
    return { ok: false, error: "La contraseña contiene caracteres no permitidos" };
  }
  if (opts.currentPassword && password === opts.currentPassword) {
    return { ok: false, error: "La nueva contraseña debe ser distinta de la actual" };
  }
  const user = (opts.username || "").trim().toLowerCase();
  if (user && password.toLowerCase().includes(user) && user.length >= 3) {
    return { ok: false, error: "La contraseña no debe contener el nombre de usuario" };
  }
  if (BLOCKLIST.has(password.toLowerCase())) {
    return { ok: false, error: "Esa contraseña es demasiado predecible" };
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (classes < 3) {
    return {
      ok: false,
      error:
        "Usa al menos 3 de: minúsculas, mayúsculas, números y símbolos",
    };
  }

  // Secuencias triviales
  if (/^(.)\1+$/.test(password) || /^(0123456789|9876543210|abcdefghij)/i.test(password)) {
    return { ok: false, error: "Esa contraseña es demasiado predecible" };
  }

  return { ok: true };
}

export const PASSWORD_POLICY_HINT =
  "Mínimo 12 caracteres, con mayúsculas, minúsculas, números y/o símbolos (al menos 3 tipos).";
