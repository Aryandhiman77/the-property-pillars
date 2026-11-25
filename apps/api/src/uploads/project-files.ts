import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { raw, type RequestHandler } from "express";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { uploadDirectory } from "./images.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";
const invalidProperty = (key: string, msg: string) =>
  new ApiError(422, "INVALID_FILE", msg, { [key]: [msg] });
export const directory = resolve(
  uploadDirectory,
  "..",
  basename(resolve(uploadDirectory)) + "-property-private",
);
export const imageLimit = env.MEDIA_IMAGE_MAX_MB * 1048576;
export const pdfLimit = 10 * 1048576;
export const parseMultipart: RequestHandler = raw({
  type: "multipart/form-data",
  limit: imageLimit + pdfLimit + 65536,
  inflate: false,
});
export async function saveFile(
  value: FormDataEntryValue | null,
  kind: "image" | "pdf" | "either",
  created: string[],
) {
  if (!value || typeof value === "string" || !value.size) return null;
  const bytes = Buffer.from(await value.arrayBuffer()),
    ext = extname(value.name).toLowerCase(),
    detected = await fileTypeFromBuffer(bytes).catch(() => undefined);
  let payload = bytes as Buffer,
    suffix: string;
  if (
    kind !== "image" &&
    detected?.ext === "pdf" &&
    ext === ".pdf" &&
    bytes.length <= pdfLimit &&
    bytes.subarray(-2048).includes(Buffer.from("%%EOF"))
  )
    suffix = ".pdf";
  else if (
    kind !== "pdf" &&
    detected &&
    ["jpg", "png", "webp"].includes(detected.ext) &&
    ext.replace(".jpeg", ".jpg") === "." + detected.ext &&
    bytes.length <= imageLimit
  ) {
    try {
      payload = await sharp(bytes, {
        limitInputPixels: 50_000_000,
        failOn: "error",
      })
        .rotate()
        .resize({
          width: 4096,
          height: 4096,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 90 })
        .toBuffer();
    } catch {
      throw invalidProperty(kind, "The image could not be decoded.");
    }
    suffix = ".webp";
  } else
    throw invalidProperty(
      kind,
      "Choose a supported image or PDF within the displayed size limit.",
    );
  const key = randomUUID() + suffix;
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, key), payload, { flag: "wx" });
  created.push(key);
  return key;
}
