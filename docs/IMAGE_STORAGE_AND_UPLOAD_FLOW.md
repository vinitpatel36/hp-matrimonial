# Image Storage and Upload Flow (Local Folder + MinIO Option)

This document explains the complete image flow for backend + Flutter app.

## 1) Where Images Are Stored

Current default in this project:
- **Local folder mode** (`STORAGE_PROVIDER=local`)
- Files stored in `uploads/`
- Served from `http://localhost:4000/uploads/...`

- Images are stored in **MinIO bucket** (free, S3-compatible).
- PostgreSQL stores only metadata in `profile_photos`:
  - `id`
  - `user_id`
  - `storage_key`
  - `file_url`
  - `visibility` (`public` or `locked`)
  - `is_primary`

## 2) Why This Architecture

- DB is not used for heavy binaries.
- Upload/download is faster via object storage.
- Same code can move from MinIO to AWS S3 later by environment config only.

## 3) Local Folder Mode (Simplest)

Use these `.env` values:

```env
STORAGE_PROVIDER=local
STORAGE_LOCAL_DIR=uploads
STORAGE_PUBLIC_BASE_URL=http://localhost:4000
```

Upload API in local mode:
- `POST /api/v1/profiles/me/photos/upload-local`

Payload:
```json
{
  "fileName": "profile_1.jpg",
  "contentType": "image/jpeg",
  "fileBase64": "<base64-string>",
  "visibility": "locked",
  "is_primary": true
}
```

## 4) MinIO Setup (Optional S3-compatible)

Run MinIO:

```bash
docker run -p 9000:9000 -p 9001:9001 ^
  -e MINIO_ROOT_USER=minioadmin ^
  -e MINIO_ROOT_PASSWORD=minioadmin ^
  -v minio_data:/data ^
  quay.io/minio/minio server /data --console-address ":9001"
```

Open console:
- `http://localhost:9001`
- user: `minioadmin`
- pass: `minioadmin`

Create bucket:
- `hp-matrimonial`

## 5) Required .env Values

```env
STORAGE_PROVIDER=minio
STORAGE_BUCKET=hp-matrimonial
STORAGE_REGION=us-east-1
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_FORCE_PATH_STYLE=true
SIGNED_URL_EXPIRES_SECONDS=900
```

## 6) Backend APIs for Image Flow

All endpoints require bearer token.

1. `POST /api/v1/profiles/me/photos/upload-url`
2. `POST /api/v1/profiles/me/photos/upload-local` (only for `STORAGE_PROVIDER=local`)
3. `POST /api/v1/profiles/me/photos/confirm`
4. `GET /api/v1/profiles/me/photos`
5. `PATCH /api/v1/profiles/me/photos/:photoId/primary`
6. `DELETE /api/v1/profiles/me/photos/:photoId`

## 7) End-to-End Upload Sequence

1. App asks backend for upload URL:
```json
POST /profiles/me/photos/upload-url
{
  "fileName": "profile_1.jpg",
  "contentType": "image/jpeg"
}
```

Response contains:
- `uploadUrl` (presigned PUT URL)
- `storageKey`
- `fileUrl`

2. App uploads binary directly to MinIO using `PUT uploadUrl`.

3. App confirms metadata with backend:
```json
POST /profiles/me/photos/confirm
{
  "storage_key": "profiles/<userId>/...jpg",
  "file_url": "http://localhost:9000/hp-matrimonial/profiles/<userId>/...jpg",
  "visibility": "locked",
  "is_primary": true
}
```

4. App reads images:
- `GET /profiles/me/photos`

5. Optional actions:
- set primary photo
- delete photo

## 8) Flutter Integration Notes

- Use `dio.put(uploadUrl, fileBytes, headers: {'Content-Type': 'image/jpeg'})`.
- Call `confirm` only after PUT success.
- Render returned `file_url` using `Image.network`.
- For locked visibility flows, keep using backend privacy logic.

## 9) Migration/DB Note

Apply latest schema after pulling changes:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

This creates `profile_photos` if not already present.
