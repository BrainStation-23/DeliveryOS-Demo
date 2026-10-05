# ADR-016: Centralized Media Library with Client-Side Crop & Resize

## Status
**Accepted** (2026-10-02)

---

## Context & Problem Statement

Platform images were uploaded per-module (only promotional banners, via the former `POST /admin/uploads` endpoint) with no persistence of what had been uploaded: the file landed in the storage driver, but nothing recorded its URL, size, dimensions, or uploader. Consequences:

1. No way to list, inspect, reuse, or clean up uploaded media — every module that needed an image (banners today; categories, vendor logos, and future modules tomorrow) grew its own inline upload control.
2. Admins could not crop or resize before upload, so oversized camera photos hit the 5 MB server cap with no remedy except external tools.
3. Relative `/uploads/...` URLs were rewritten ad-hoc per consumer against the API origin, and the local nginx edge never routed `/uploads` at all (only the production template did).

---

## Decision

- **`media_assets` registry (23rd Prisma model)**: every upload through `POST /admin/media` — records `url` (unique, relative), stored/generated filenames, MIME, byte size, optional client-measured `width`/`height`, and the uploading admin. The storage driver itself is unchanged (local `UPLOAD_DIR` served at `/uploads`); S3-compatible drivers remain the next increment.
- **Media module** (`src/modules/media/`): `MediaService` wraps `StorageService` + Prisma; `MediaController` exposes upload / paginated list (newest first) / delete under `SUPER_ADMIN`. Shared multipart constraints (MIME allow-list, 5 MB cap) live in `common/storage/image-upload.options.ts` and are reused by both controllers. Deletion removes the database row first, then unlinks the file (a stranded file is harmless; a dangling row is not).
- **Client-side editing before upload** (`react-image-crop` in the admin portal): the `UploadEditorModal` offers free-form + fixed-aspect crop selection and a longest-edge resize cap (original/1920/1280/800) with canvas re-encoding. The server never re-processes pixels — it stores exactly the bytes the admin approved. GIFs re-encode as static frames (canvas limitation, surfaced in the UI); the 5 MB limit is pre-checked client-side and still enforced server-side.
- **Central picker over inline uploads**: the banner form's inline upload is removed; every creation module picks from the shared `MediaPickerModal` (which itself can stage an upload through the same editor). Pure helpers (`computeResizedDimensions`, MIME/quality mapping, `resolveMediaUrl`) are unit-tested.
- **URL resolution**: media URLs stay relative in the database. `/uploads` is routed to the backend by the local nginx edge (mirroring the production template) and by the admin portal's Vite dev proxy; `resolveMediaUrl` prefixes `VITE_API_URL` only for split-origin deployments.

---

## Consequences

**Positive**
- One governed inventory of platform media with attribution, dimensions, and copyable URLs; deletion is a first-class, idempotent operation.
- Upload bandwidth drops (cropped/resized payloads), and admins get an in-browser remedy for oversized files.
- Future modules get picker + upload flow for free (`MediaPickerModal` + `useMediaUpload`), eliminating per-module upload duplication.
- Legacy `/admin/uploads` consumers keep working while gaining registry persistence.

**Negative / Trade-offs**
- Deleting an asset still referenced by a banner leaves that banner without its image; the delete dialog warns, but referential checks are deliberately not implemented yet (no cross-module coupling until a second consumer exists).
- Client-measured dimensions are metadata only (unverified by the server) — acceptable because they inform display, never money or security decisions.
- One new frontend dependency (`react-image-crop`, ~12 KB gzipped).

---

## Technical Implementation Details

- Migration `20261002064236_add_media_assets` (table + `created_at` index; `uploaded_by_id → users ON DELETE SET NULL`).
- `MediaService.uploadImage` sanitizes `originalname` (path separators/newlines stripped, 255-char cap) before persistence.
- Canvas export: `exportMimeType` maps GIF→static PNG, keeps PNG/WebP, else JPEG at quality 0.92; `computeResizedDimensions` never upscales and clamps to ≥1px.

---

## Compliance & Verification

- `media.service.spec.ts` (6 Jest cases): registration with uploader + dimensions, hostile-name sanitization, storage-failure no-row invariant, pagination envelope, row-before-file delete ordering, 404 on unknown ids.
- Portal Vitest (`imageEdit.test.ts`, `mediaUrl.test.ts`): resize math incl. degenerate inputs, MIME/quality mapping, URL resolution across deployment modes; i18n locale-scan covers the new `nav.admin.media` key.
- E2E against the live stack: upload → list → edge-served file (200 `image/png`) → delete → empty list + file 404 + repeat-delete 404 + unauthenticated 401.
