import {
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

import { getR2Storage } from "../config/r2.js";

function validateKey(key) {
  if (
    typeof key !== "string" ||
    key.length === 0 ||
    key.length > 512 ||
    !/^[a-zA-Z0-9/_\-.]+$/.test(key) ||
    key.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error("Invalid storage object key");
  }
}

export function getPublicObjectUrl(key) {
  validateKey(key);

  const { publicBaseUrl } = getR2Storage();
  const encodedKey = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${publicBaseUrl}/${encodedKey}`;
}

export async function uploadObject({
  key,
  body,
  contentType,
  cacheControl = "public, max-age=3600",
}) {
  validateKey(key);

  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw new Error("Upload body must be a non-empty Buffer");
  }

  if (!contentType) {
    throw new Error("Upload content type is required");
  }

  const { client, bucket } = getR2Storage();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
    {
      abortSignal: AbortSignal.timeout(30_000),
    },
  );

  return {
    key,
    url: getPublicObjectUrl(key),
    size: body.length,
  };
}

export async function getObjectMetadata(key) {
  validateKey(key);

  const { client, bucket } = getR2Storage();

  return client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    {
      abortSignal: AbortSignal.timeout(15_000),
    },
  );
}

export async function deleteObject(key) {
  validateKey(key);

  const { client, bucket } = getR2Storage();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    {
      abortSignal: AbortSignal.timeout(15_000),
    },
  );
}

export async function downloadObject(key, maxBytes = 10 * 1024 * 1024) {
  validateKey(key);

  const { client, bucket } = getR2Storage();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    {
      abortSignal: AbortSignal.timeout(20_000),
    },
  );

  if (!response.Body) {
    throw new Error("Stored image is empty");
  }

  const chunks = [];
  let total = 0;

  try {
    for await (const chunk of response.Body) {
      total += chunk.length;

      if (total > maxBytes) {
        throw new Error("Stored image exceeds the allowed size");
      }

      chunks.push(Buffer.from(chunk));
    }
  } finally {
    response.Body.destroy?.();
  }

  return Buffer.concat(chunks, total);
}
