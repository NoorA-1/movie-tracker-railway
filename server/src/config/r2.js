import { S3Client } from "@aws-sdk/client-s3";

let storage;

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is missing from your .env file`);
  }

  return value;
}

function requireHttpsUrl(name) {
  const value = requiredEnv(name);

  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      `${name} must be an HTTPS base URL without a path, query, or credentials`,
    );
  }

  return url.origin;
}

export function getR2Storage() {
  if (storage) {
    return storage;
  }

  const endpoint = requireHttpsUrl("R2_ENDPOINT");
  const publicBaseUrl = requireHttpsUrl("R2_PUBLIC_BASE_URL");
  const bucket = requiredEnv("R2_BUCKET_NAME");

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
    maxAttempts: 3,
  });

  storage = {
    client,
    bucket,
    publicBaseUrl,
  };

  return storage;
}
