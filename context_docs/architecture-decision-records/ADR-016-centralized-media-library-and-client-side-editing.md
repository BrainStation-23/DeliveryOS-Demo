# ADR-016: Centralized Media Library with Client-Side Crop & Resize

## Status
**Accepted** (2026-10-02)

---

## Context & Problem Statement

Platform image assets require persistent attribution, dimension metadata, and centralized lifecycle governance:

1. Governed central inventory to list, search, inspect, reuse, and clean up uploaded media across modules (promotional banners, outlets, categories).
2. Client-side crop and resize before upload, allowing administrators to optimize aspect ratios and dimensions without exceeding payload limits.
3. Clean, consistent relative `/uploads/...` URL resolution across local edge proxies and production environments.

---

## Decision

- **`media_assets` registry**: Every upload through `POST /admin/media` records `url` (unique, relative), stored display names, MIME type, byte size, client-measured `width`/`height`, and the uploading admin ID. Storage is served from the persistent upload directory at `/uploads`.
- **Media module** (`src/modules/media/`): `MediaService` manages database persistence and disk writes via `StorageService`; `MediaController` exposes upload, paginated listing (newest first, search by name), and deletion under `SUPER_ADMIN`. Shared multipart constraints (MIME allow-list, 5 MB cap) enforce security. Deletion safely removes the database row first, then unlinks the file.
- **Client-side editing before upload** (`react-image-crop` in the admin portal): The `UploadEditorModal` offers free-form and fixed-aspect crop selection with a longest-edge resize cap (original/1920/1280/800) and canvas re-encoding. The server stores the exact approved bytes.
- **Central picker over inline uploads**: Creation forms select images via the shared `MediaPickerModal`.
- **URL resolution**: Media URLs persist as relative paths (`/uploads/...`) in the database. Nginx edge routes `/uploads` to the storage volume; `resolveMediaUrl` prefixes `VITE_API_URL` for split-origin deployments.

---

## Consequences

**Positive**
- One governed inventory of platform media with attribution, dimensions, and copyable URLs; deletion is a first-class, idempotent operation.
- Upload bandwidth drops (cropped/resized payloads), and admins get an in-browser remedy for oversized files.
- Modules share a unified picker and upload workflow (`MediaPickerModal`), eliminating per-module upload duplication.

**Negative / Trade-offs**
- Deleting an asset referenced by an active banner requires manual administrator confirmation.
- Client-measured dimensions are display metadata only (unverified by the server).
- Introduces `react-image-crop` (~12 KB gzipped) on the admin portal.

---

## Technical Implementation Details

- Database schema: `media_assets` table with `created_at` index; `uploaded_by_id → users ON DELETE SET NULL`.
- `MediaService.uploadImage` sanitizes filenames (path separators and newlines stripped, 255-char cap) before persistence.
- Canvas export: `exportMimeType` maps GIF→static PNG, keeps PNG/WebP, else JPEG at quality 0.92; `computeResizedDimensions` clamps to $\ge 1$px without upscaling.

---

## Compliance & Verification

- `media.service.spec.ts` (6 Jest cases): registration with uploader + dimensions, hostile-name sanitization, storage-failure no-row invariant, pagination envelope, row-before-file delete ordering, 404 on unknown ids.
- Portal Vitest (`imageEdit.test.ts`, `mediaUrl.test.ts`): resize math incl. degenerate inputs, MIME/quality mapping, URL resolution across deployment modes; i18n locale-scan covers the new `nav.admin.media` key.
- E2E against the live stack: upload → list → edge-served file (200 `image/png`) → delete → empty list + file 404 + repeat-delete 404 + unauthenticated 401.
