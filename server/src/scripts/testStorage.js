import sharp from "sharp";

import { getR2Storage } from "../config/r2.js";
import { processPoster } from "../services/imageService.js";
import { uploadObject, getObjectMetadata } from "../services/storageService.js";

async function main() {
  const { client } = getR2Storage();

  try {
    console.log("Creating test image...");

    const original = await sharp({
      create: {
        width: 1000,
        height: 1500,
        channels: 3,
        background: {
          r: 37,
          g: 99,
          b: 235,
        },
      },
    })
      .png()
      .toBuffer();

    const poster = await processPoster(original);

    console.log(
      `Processed image: ${poster.width} x ${poster.height}, ${poster.size} bytes`,
    );

    console.log("Uploading to R2...");

    const uploaded = await uploadObject({
      key: "tests/storage-check.webp",
      body: poster.buffer,
      contentType: poster.contentType,
      cacheControl: "no-store",
    });

    console.log("Upload successful");

    const metadata = await getObjectMetadata(uploaded.key);

    if (
      metadata.ContentLength !== poster.size ||
      metadata.ContentType !== poster.contentType
    ) {
      throw new Error("Uploaded object metadata did not match the image");
    }

    console.log("Stored object verified");
    console.log(`Image URL: ${uploaded.url}`);

    console.log("Checking public image access...");

    const response = await fetch(uploaded.url, {
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(
        `Upload succeeded, but the public URL returned HTTP ${response.status}. ` +
          "Check your bucket's Public Development URL settings.",
      );
    }

    const downloaded = Buffer.from(await response.arrayBuffer());

    if (!downloaded.equals(poster.buffer)) {
      throw new Error(
        "The public URL did not return the uploaded image. " +
          "Check that R2_PUBLIC_BASE_URL belongs to the same bucket.",
      );
    }

    console.log("Public image verified");
    console.log("Storage test passed");
  } finally {
    client.destroy();
  }
}

main().catch((error) => {
  console.error("Storage test failed:", error.message);
  process.exitCode = 1;
});
