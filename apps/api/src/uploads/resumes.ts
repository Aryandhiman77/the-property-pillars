import {createHash, randomUUID} from "node:crypto";
import {access, mkdir, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {Router, raw, type Router as ExpressRouter} from "express";
import rateLimit from "express-rate-limit";
import {FileTypeParser} from "file-type";
import {detectCfbf} from "@file-type/cfbf";
import {MAX_RESUME_BYTES} from "@the-property-pillar/contracts";
import {z} from "zod";
import {sendSuccess} from "../helpers/api-response.js";
import {requireRole, requireSession} from "../middleware/session.middleware.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {workspacePrisma} from "../workspace/db.js";
import {uploadDirectory} from "./images.js";

const root = join(uploadDirectory, "resumes");
const prefix = "/api/v1/uploads/resumes/";
const fileNamePattern = /^[a-f0-9]{64}-[a-f0-9-]{36}\.(pdf|docx|doc)$/;
const parser = new FileTypeParser({customDetectors: [detectCfbf]});
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function isResumePath(value: string) {
  return value.startsWith(prefix) && fileNamePattern.test(value.slice(prefix.length));
}

export async function assertResumeUploaded(value: unknown, tenantId: string, userId: string) {
  if (typeof value === "string" && isResumePath(value)) {
    const filename = value.slice(prefix.length);
    if (filename.startsWith(hash(userId) + "-")) {
      try {
        await access(join(root, hash(tenantId), filename));
        return;
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
      }
    }
  }
  throw new z.ZodError([{code: "custom", path: ["resumeUrl"], message: "Upload your résumé before submitting."}]);
}

export const resumesRouter: ExpressRouter = Router();
resumesRouter.use(requireSession);

resumesRouter.post("/", requireRole("WHITE_COLLAR_SEEKER"),
  rateLimit({windowMs: 60_000, limit: 12, standardHeaders: "draft-8", legacyHeaders: false}),
  raw({type: ["application/octet-stream", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], limit: MAX_RESUME_BYTES, inflate: false}),
  asyncHandler(async (request, response) => {
    const file = request.body;
    if (!Buffer.isBuffer(file) || !file.length) throw new ApiError(415, "INVALID_RESUME", "Choose a PDF, DOC, or DOCX file.");
    const type = await parser.fromBuffer(file).catch(() => undefined);
    const extension = type?.ext === "pdf" || type?.ext === "docx" ? type.ext
      : type?.ext === "cfb" && file.includes(Buffer.from("WordDocument\0", "utf16le")) ? "doc" : null;
    if (!extension) throw new ApiError(415, "INVALID_RESUME", "Choose a valid PDF, DOC, or DOCX file.");
    const {tenantId, userId} = request.session!;
    const directory = join(root, hash(tenantId));
    const filename = `${hash(userId)}-${randomUUID()}.${extension}`;
    await mkdir(directory, {recursive: true});
    await writeFile(join(directory, filename), file, {flag: "wx"});
    sendSuccess(response, {url: prefix + filename}, 201);
  }),
);

resumesRouter.get("/:filename", asyncHandler(async (request, response, next) => {
  const filename = typeof request.params.filename === "string" ? request.params.filename : "";
  const {tenantId, userId, role} = request.session!;
  const missing = new ApiError(404, "RESUME_NOT_FOUND", "Résumé not found.");
  if (!fileNamePattern.test(filename)) throw missing;
  if (!filename.startsWith(hash(userId) + "-")) {
    const application = await workspacePrisma.workspaceItem.findFirst({
      where: {
        tenantId, collection: "JOB_APPLICATIONS", data: {path: ["resumeUrl"], equals: prefix + filename},
        ...(role === "ADMIN" ? {} : {targetUserId: userId}),
      },
      select: {id: true},
    });
    if (!application) throw missing;
  }
  response.download(join(root, hash(tenantId), filename), "resume." + filename.split(".").at(-1), {cacheControl: false}, (error) => {
    if (error) next("status" in error && error.status === 404 ? missing : error);
  });
}));
