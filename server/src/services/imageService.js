import sharp from "sharp";

const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

const inputOptions = {
  limitInputPixels: 40_000_000,
  failOn: "warning",
};

export async function inspectPoster(inputBuffer) {
  if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    throw new Error("Poster must be a non-empty image");
  }

  if (inputBuffer.length > MAX_INPUT_BYTES) {
    throw new Error("Poster image must be 10 MB or smaller");
  }

  const metadata = await sharp(inputBuffer, inputOptions).metadata();

  if (!ALLOWED_FORMATS.has(metadata.format)) {
    throw new Error("Poster must be a JPEG, PNG, or WebP image");
  }

  if (!metadata.width || !metadata.height) {
    throw new Error("Poster dimensions could not be read");
  }

  if ((metadata.pages ?? 1) > 1) {
    throw new Error("Animated poster images are not supported");
  }

  return metadata;
}

export async function processPoster(inputBuffer) {
  await inspectPoster(inputBuffer);

  const { data, info } = await sharp(inputBuffer, inputOptions)
    .rotate()
    .resize({
      width: 500,
      height: 750,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: 80,
      effort: 4,
    })
    .toBuffer({
      resolveWithObject: true,
    });

  return {
    buffer: data,
    contentType: "image/webp",
    width: info.width,
    height: info.height,
    size: info.size,
  };
}
