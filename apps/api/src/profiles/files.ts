import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { Router, raw, type Router as ExpressRouter } from "express";
import rateLimit from "express-rate-limit";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { z } from "zod";
import { MAX_RESUME_BYTES, roleSections } from "@the-property-pillar/contracts";
import { uploadDirectory } from "../uploads/images.js";
import { resumeExtension } from "../uploads/resumes.js";
import { prisma } from "../database/prisma.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { parseInput } from "../helpers/parse-input.js";
import { sendSuccess } from "../helpers/api-response.js";
import { requireSession } from "../middleware/session.middleware.js";
import {
  bump,
  conflict,
  editState,
  ensureProfile,
  fileInfo,
  roleOf,
} from "./profile.js";

const root = resolve(
  uploadDirectory,
  "..",
  basename(resolve(uploadDirectory)) + "-profile-private",
);
const invalidFile = () =>
  new ApiError(
    415,
    "INVALID_FILE",
    "Choose a file whose contents and extension match the requested document type.",
  );
export const profileFiles: ExpressRouter = Router();
profileFiles.post(
  "/",
  requireSession,
  rateLimit({ windowMs: 60000, limit: 20 }),
  raw({
    type: "application/octet-stream",
    limit: Math.max(MAX_RESUME_BYTES, env.MEDIA_IMAGE_MAX_MB * 1048576),
    inflate: false,
  }),
  asyncHandler(async (req, res) => {
    const { field, name, revision } = parseInput(
      z
        .object({
          field: z.string().max(80),
          name: z
            .string()
            .min(1)
            .max(180)
            .regex(/^[^\\/\x00-\x1f]+$/),
          revision: z.coerce.number().int().nonnegative(),
        })
        .strict(),
      req.query,
    );
    const session = req.session!,
      role = roleOf(session.role);
    const [sectionKey, subKey] = field.split(".");
    const top = roleSections[role]
      .flatMap((s) => s.fields)
      .find((f) => f.key === sectionKey);
    const f = subKey ? top?.fields?.find((f) => f.key === subKey) : top;
    if (f?.kind !== "file" || field.split(".").length > 2)
      throw new ApiError(
        403,
        "FILE_PURPOSE",
        "This file field is unavailable for this role.",
      );
    const p = await ensureProfile(session);
    if (p.revision !== revision) throw conflict();
    let bytes: Buffer = req.body;
    if (!Buffer.isBuffer(bytes) || !bytes.length) throw invalidFile();
    const ext = extname(name)
      .slice(1)
      .toLowerCase()
      .replace(/^jpeg$/, "jpg");
    const isPublic = f.use === "IMAGE" || f.use === "PORTFOLIO";
    const detected = await fileTypeFromBuffer(bytes).catch(() => undefined);
    let mime = detected?.mime;
    if (f.use === "RESUME") {
      if (
        bytes.length > MAX_RESUME_BYTES ||
        !ext ||
        (await resumeExtension(bytes)) !== ext
      )
        throw invalidFile();
      mime =
        ext === "doc"
          ? "application/msword"
          : ext === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/pdf";
    } else if (ext === "pdf" && !isPublic && detected?.ext === "pdf") {
      if (
        bytes.length > MAX_RESUME_BYTES ||
        !bytes.subarray(-2048).includes(Buffer.from("%%EOF"))
      )
        throw invalidFile();
    } else {
      if (
        !["jpg", "png", "webp"].includes(ext) ||
        detected?.ext !== ext ||
        bytes.length > env.MEDIA_IMAGE_MAX_MB * 1048576
      )
        throw invalidFile();
      try {
        const image = sharp(bytes, {
          limitInputPixels: 50_000_000,
          failOn: "error",
        }).rotate();
        bytes = isPublic
          ? await image
              .resize({
                width: 1800,
                height: 1800,
                fit: "inside",
                withoutEnlargement: true,
              })
              .webp()
              .toBuffer()
          : await image.toBuffer();
      } catch {
        throw invalidFile();
      }
      if (isPublic) mime = "image/webp";
    }
    const storageKey = randomUUID();
    await mkdir(root, { recursive: true, mode: 0o700 });
    await writeFile(resolve(root, storageKey), bytes, {
      flag: "wx",
      mode: 0o600,
    });
    try {
      const entry = await prisma.$transaction(async (tx) => {
        await bump(
          tx,
          p,
          session.userId,
          editState(p.verification),
          "Profile file saved",
        );
        return tx.profileFile.create({
          data: {
            profileId: p.id,
            field,
            category: f.use!,
            visibility: isPublic ? "PUBLIC" : "PROTECTED",
            originalName: name,
            storageKey,
            size: bytes.length,
            mime: mime!,
          },
          select: fileInfo,
        });
      });
      sendSuccess(res, entry, 201);
    } catch (error) {
      await unlink(resolve(root, storageKey));
      throw error;
    }
  }),
);
profileFiles.get(
  "/:id",
  asyncHandler(async (req, res, next) => {
    const file = await prisma.profileFile.findUnique({
      where: { id: String(req.params.id) },
      include: {
        profile: {
          include: {
            user: { select: { role: true, tenantId: true, status: true } },
          },
        },
      },
    });
    const missing = new ApiError(404, "FILE_NOT_FOUND", "File not found.");
    if (!file) throw missing;
    const { profile: p } = file;
    const session = req.session;
    const owner = session?.userId === p.userId && session.role === p.role;
    const admin =
      session?.role === "ADMIN" && session.tenantId === p.user.tenantId;
    const publicImage =
      file.visibility === "PUBLIC" &&
      p.verification === "VERIFIED" &&
      p.role === p.user.role &&
      p.user.status === "ACTIVE" &&
      p.user.tenantId === (session?.tenantId ?? env.PUBLIC_TENANT_ID);
    if (!owner && !admin) {
      if (!publicImage) throw missing;
      if (file.category !== "PORTFOLIO") {
        const latest = await prisma.profileFile.findFirst({
          where: { profileId: p.id, field: file.field },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true },
        });
        if (latest?.id !== file.id) throw missing;
      }
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (file.visibility === "PROTECTED") res.attachment(file.originalName);
    res
      .type(file.mime)
      .sendFile(
        resolve(root, file.storageKey),
        { cacheControl: false },
        (err) => {
          if (err) next(missing);
        },
      );
  }),
);
