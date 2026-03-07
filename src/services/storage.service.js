import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { S3Client, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageConfig } from "../config/storage.js";

const s3 = new S3Client({
  region: storageConfig.region,
  endpoint: storageConfig.endpoint,
  forcePathStyle: storageConfig.forcePathStyle,
  credentials: {
    accessKeyId: storageConfig.accessKeyId,
    secretAccessKey: storageConfig.secretAccessKey,
  },
});

const safeName = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

export const createPhotoUploadUrl = async ({ userId, fileName, contentType }) => {
  if (storageConfig.provider === "local") {
    const key = `profiles/${userId}/${Date.now()}-${randomUUID()}-${safeName(fileName)}`;
    const fileUrl = `${storageConfig.publicBaseUrl.replace(/\/$/, "")}/uploads/${key}`;
    return {
      uploadUrl: `${storageConfig.publicBaseUrl.replace(/\/$/, "")}/api/v1/profiles/me/photos/upload-local`,
      storageKey: key,
      fileUrl,
      expiresInSeconds: null,
    };
  }

  const key = `profiles/${userId}/${Date.now()}-${randomUUID()}-${safeName(fileName)}`;
  const cmd = new PutObjectCommand({
    Bucket: storageConfig.bucket,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3, cmd, {
    expiresIn: storageConfig.signedUrlExpiresSeconds,
  });
  const fileUrl = `${storageConfig.endpoint.replace(/\/$/, "")}/${storageConfig.bucket}/${key}`;
  return { uploadUrl, storageKey: key, fileUrl, expiresInSeconds: storageConfig.signedUrlExpiresSeconds };
};

export const deletePhotoObject = async ({ storageKey }) => {
  if (storageConfig.provider === "local") {
    const fullPath = path.resolve(storageConfig.localDir, storageKey);
    await fs.rm(fullPath, { force: true });
    return;
  }

  const cmd = new DeleteObjectCommand({
    Bucket: storageConfig.bucket,
    Key: storageKey,
  });
  await s3.send(cmd);
};

export const saveLocalPhoto = async ({ userId, fileName, fileBuffer }) => {
  const key = `profiles/${userId}/${Date.now()}-${randomUUID()}-${safeName(fileName)}`;
  const fullPath = path.resolve(storageConfig.localDir, key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, fileBuffer);
  const fileUrl = `${storageConfig.publicBaseUrl.replace(/\/$/, "")}/uploads/${key}`;
  return { storageKey: key, fileUrl };
};
