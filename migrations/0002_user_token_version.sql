-- Invalida sesiones JWT al cambiar la contraseña.
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;
