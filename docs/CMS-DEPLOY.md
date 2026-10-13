# CMS Rita Valero — despliegue Cloudflare Pages + D1 + JWT

## Qué incluye

- Login en `/admin/` (cookie JWT `HttpOnly` + `Secure` + `SameSite=Strict`)
- Edición in-place de textos (`data-rita-block`) con barra de herramientas
- Nuevos contenidos por servicio (texto / vídeo / enlace) en D1
- Ficha pública en `/entrada/<slug>`
- Subida de miniaturas a R2 (`MEDIA`) vía `/api/upload`

Las contraseñas **nunca** van en el código: solo hash + salt en D1. El secreto JWT es un **secret** de Cloudflare.

## 1. Requisitos

- Cuenta Cloudflare con el proyecto Pages enlazado al repo GitHub
- Node.js 18+
- Wrangler CLI (`npm install` en la raíz del sitio)

## 2. Recursos Cloudflare (proyecto Pages `rita`)

Ya configurado:

| Binding | Tipo | Recurso |
|---------|------|---------|
| `DB` | D1 | `rita-cms` (`fc45335e-7487-4fe7-8f8b-bff624f5735f`) |
| `MEDIA` | R2 | `ritavalero-medios` |

Secrets en production/preview: `JWT_SECRET`, `CMS_ADMIN_USER`, `CMS_ADMIN_PASSWORD`.

Variable `PUBLIC_MEDIA_BASE`: `https://pub-12c0781474b34a949cebe4bd27c5faaf.r2.dev`

Los MP3/MP4 grandes viven en R2 (`ritavalero-medios/wp-content/uploads/...`) y se sirven con redirecciones en [`_redirects`](../_redirects). No se suben a Pages (límite 25 MiB); ver [`.cfignore`](../.cfignore).

Sitio: `https://rita-8in.pages.dev` (y dominio custom si lo hay).

Si hay que recrear D1/R2:

```bash
npx wrangler d1 create rita-cms
# R2 existente: ritavalero-medios
```

## 3. Migraciones

```bash
npm install
npm run db:migrate:remote
```

Local (opcional):

```bash
npm run db:migrate:local
```

## 4. Secreto JWT

```bash
# Genera un secreto
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# En Pages (sustituye el nombre del proyecto)
npx wrangler pages secret put JWT_SECRET --project-name=NOMBRE_PROYECTO_PAGES
```

Variable opcional (si sirves R2 con dominio público propio):

- `PUBLIC_MEDIA_BASE` = `https://pub-xxxxx.r2.dev` (Pages → Environment variables)

Sin `PUBLIC_MEDIA_BASE`, las subidas se sirven por `/api/media/...`.

## 5. Usuario administrador

**No subas la contraseña al repo.**

### Opción A — bootstrap automático (recomendada)

Configura secrets en Pages (solo se usan si `users` está vacía):

```bash
npx wrangler pages secret put CMS_ADMIN_USER --project-name=NOMBRE_PROYECTO_PAGES
npx wrangler pages secret put CMS_ADMIN_PASSWORD --project-name=NOMBRE_PROYECTO_PAGES
```

Al primer login contra una DB vacía, se crea el admin. Después puedes **eliminar** el secret `CMS_ADMIN_PASSWORD`.

Si necesitas recrear el admin (cambio de hash/iteraciones), usa temporalmente el secret `CMS_ADMIN_FORCE=1` y quítalo al terminar.

### Opción B — seed manual D1

```powershell
$env:CMS_ADMIN_USER="admin"
$env:CMS_ADMIN_PASSWORD="EligeUnaClaveLargaYUnica"
node scripts/cms-seed-admin.js --remote
```

Para regenerar solo el hash:

```bash
node scripts/cms-hash-password.js "TuClave"
```

## 6. Etiquetado HTML (ya aplicado en el repo)

Si añades páginas nuevas exportadas de Divi:

```bash
npm run cms:migrate-html
```

Eso:

- marca bloques con `data-rita-block`
- inserta `/js/cms-hydrate.js` y `/js/cms-edit.js`
- crea `#rita-entries-<servicio>` en Música/Radio/Escritos/Formación/Terapias

## 7. Despliegue

Push a `main` (Pages despliega solo). Tras el primer deploy con Functions:

1. Abre `https://TU-DOMINIO/admin/`
2. Inicia sesión
3. Ve al inicio → debe aparecer la barra **Modo edición**
4. Edita un texto → **Guardar textos**
5. En un servicio → **Añadir contenido** → crea una entrada publicada
6. Comprueba `/entrada/<slug>`

## 8. Desarrollo local

```bash
copy .dev.vars.example .dev.vars
# edita JWT_SECRET en .dev.vars
npm run db:migrate:local
$env:CMS_ADMIN_PASSWORD="..."
node scripts/cms-seed-admin.js --local
npm run dev
```

`db:migrate:local`, `cms-seed-admin --local` y `npm run dev` comparten `.wrangler/state` para usar la misma D1 local.

Abre la URL que indique Wrangler (normalmente `http://127.0.0.1:8788`).

## 9. Seguridad (checklist)

- [ ] `JWT_SECRET` configurado como secret (no en Git)
- [ ] Usuario admin creado solo vía `cms-seed-admin` / D1
- [ ] Contraseña admin larga y única
- [ ] Login rate-limited (tabla `login_attempts`)
- [ ] Cookie de sesión `HttpOnly; Secure; SameSite=Strict`
- [ ] Escrituras API validan origen same-site
- [ ] HTML sanitizado al guardar
- [ ] R2 sin listado público innecesario; subida solo autenticada

## 10. API rápida

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/api/auth/login` | no |
| POST | `/api/auth/logout` | cookie |
| GET | `/api/auth/me` | cookie |
| GET | `/api/content?path=/musica/` | no |
| PUT | `/api/content` | sí |
| GET | `/api/entries?service=musica` | no (solo published) |
| POST | `/api/entries` | sí |
| PUT/DELETE | `/api/entries/:id` | sí |
| POST | `/api/upload` | sí |
| GET | `/entrada/:slug` | no (published) |
