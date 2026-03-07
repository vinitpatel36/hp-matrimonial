export const storageConfig = {
  provider: process.env.STORAGE_PROVIDER || "minio",
  bucket: process.env.STORAGE_BUCKET || "hp-matrimonial",
  region: process.env.STORAGE_REGION || "us-east-1",
  endpoint: process.env.STORAGE_ENDPOINT || "http://localhost:9000",
  accessKeyId: process.env.STORAGE_ACCESS_KEY || "minioadmin",
  secretAccessKey: process.env.STORAGE_SECRET_KEY || "minioadmin",
  forcePathStyle: (process.env.STORAGE_FORCE_PATH_STYLE || "true").toLowerCase() === "true",
  signedUrlExpiresSeconds: Number(process.env.SIGNED_URL_EXPIRES_SECONDS || 900),
  localDir: process.env.STORAGE_LOCAL_DIR || "uploads",
  publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`,
};
