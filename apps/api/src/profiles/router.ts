import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import {
  requireSession,
  requireRole,
} from "../middleware/session.middleware.js";
import { sendSuccess } from "../helpers/api-response.js";
import { parseInput } from "../helpers/parse-input.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  ensureProfile,
  snapshot,
  saveSection,
  conflict,
  bump,
} from "./profile.js";
import { mastersRouter } from "./masters.js";
import { profileFiles } from "./files.js";
import { profileLocations } from "./places.js";

export const profilesRouter: ExpressRouter = Router();
profilesRouter.use("/files", profileFiles);
profilesRouter.use(requireSession);
profilesRouter.use("/masters", mastersRouter);
profilesRouter.use("/places", profileLocations);
profilesRouter.get(
  ["/me", "/completion"],
  asyncHandler(async (req, res) => {
    const p = await ensureProfile(req.session!);
    const detail = await snapshot(prisma, p.id, req.session!.tenantId);
    sendSuccess(
      res,
      req.path === "/completion"
        ? { role: p.role, ...detail.completion }
        : detail,
    );
  }),
);
profilesRouter.patch(
  "/me/:role",
  asyncHandler(async (req, res) => {
    const session = req.session!;
    if (req.params.role !== session.role)
      throw new ApiError(403, "WRONG_ROLE", "Choose your own role profile.");
    const body = parseInput(
      z
        .object({
          revision: z.number().int().nonnegative(),
          section: z.string(),
          values: z.record(z.unknown()),
        })
        .strict(),
      req.body,
    );
    const p = await ensureProfile(session);
    sendSuccess(
      res,
      await saveSection(
        session,
        p.id,
        body.section,
        body.values,
        body.revision,
      ),
    );
  }),
);
profilesRouter.post(
  "/me/submit",
  asyncHandler(async (req, res) => {
    const session = req.session!;
    const { revision } = parseInput(
      z.object({ revision: z.number().int() }).strict(),
      req.body,
    );
    const p = await ensureProfile(session);
    sendSuccess(
      res,
      await prisma.$transaction(async (tx) => {
        const current = await snapshot(tx, p.id, session.tenantId);
        if (
          current.revision !== revision ||
          !["NOT_SUBMITTED", "CHANGES_REQUIRED", "REJECTED"].includes(
            current.verification,
          )
        )
          throw conflict();
        if (current.completion.percentage !== 100)
          throw new ApiError(
            422,
            "PROFILE_INCOMPLETE",
            "Complete the required sections first.",
          );
        await bump(
          tx,
          current,
          session.userId,
          "PENDING",
          "Submitted for verification",
        );
        return snapshot(tx, p.id, session.tenantId);
      }),
    );
  }),
);
profilesRouter.get(
  "/reviews",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { status, cursor } = parseInput(
      z.object({
        status: z
          .enum([
            "PENDING",
            "VERIFIED",
            "REJECTED",
            "CHANGES_REQUIRED",
            "SUSPENDED",
          ])
          .default("PENDING"),
        cursor: z.string().optional(),
      }),
      req.query,
    );
    const rows = await prisma.domainProfile.findMany({
      where: {
        user: { tenantId: req.session!.tenantId },
        verification: status,
      },
      select: {
        id: true,
        role: true,
        verification: true,
        user: { select: { fullName: true, role: true } },
      },
      orderBy: { id: "asc" },
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    sendSuccess(res, {
      items: rows.slice(0, 50).filter((r) => r.role === r.user.role),
      next: rows.length > 50 ? rows[49]!.id : null,
    });
  }),
);
profilesRouter.get(
  "/reviews/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) =>
    sendSuccess(
      res,
      await snapshot(prisma, String(req.params.id), req.session!.tenantId),
    ),
  ),
);
profilesRouter.post(
  "/reviews/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const session = req.session!;
    const body = parseInput(
      z
        .object({
          revision: z.number().int(),
          decision: z.enum([
            "VERIFIED",
            "CHANGES_REQUIRED",
            "REJECTED",
            "SUSPENDED",
          ]),
          reason: z.string().trim().max(1000).default(""),
        })
        .strict(),
      req.body,
    );
    if (body.decision !== "VERIFIED" && body.reason.length < 5)
      throw new ApiError(422, "REASON_REQUIRED", "Explain the decision.", {
        reason: ["Enter at least five characters."],
      });
    sendSuccess(
      res,
      await prisma.$transaction(async (tx) => {
        const p = await snapshot(tx, String(req.params.id), session.tenantId);
        if (
          p.revision !== body.revision ||
          (body.decision === "SUSPENDED"
            ? p.verification !== "VERIFIED"
            : !(
                p.verification === "PENDING" ||
                (p.verification === "SUSPENDED" &&
                  body.decision === "CHANGES_REQUIRED")
              ))
        )
          throw conflict();
        if (body.decision === "VERIFIED" && p.completion.percentage !== 100)
          throw new ApiError(
            409,
            "PROFILE_INCOMPLETE",
            "The account is no longer complete.",
          );
        await bump(tx, p, session.userId, body.decision, body.reason);
        return snapshot(tx, p.id, session.tenantId);
      }),
    );
  }),
);

profilesRouter.use("/saved-jobs", requireRole("WHITE_COLLAR_SEEKER"));
profilesRouter.get(
  "/saved-jobs",
  asyncHandler(async (req, res) => {
    const rows = await prisma.savedJob.findMany({
      where: {
        userId: req.session!.userId,
        job: { tenantId: req.session!.tenantId, collection: "JOBS" },
      },
      orderBy: { createdAt: "desc" },
      select: { job: { select: { id: true, title: true, status: true } } },
    });
    sendSuccess(
      res,
      rows.map((r) => r.job),
    );
  }),
);
profilesRouter.get(
  "/saved-jobs/:id",
  asyncHandler(async (req, res) => {
    const row = await prisma.savedJob.findUnique({
      where: {
        userId_jobId: {
          userId: req.session!.userId,
          jobId: String(req.params.id),
        },
      },
      select: { jobId: true },
    });
    sendSuccess(res, { saved: !!row });
  }),
);
profilesRouter.put(
  "/saved-jobs/:id",
  asyncHandler(async (req, res) => {
    const { userId, tenantId } = req.session!,
      jobId = String(req.params.id);
    const job = await prisma.workspaceItem.findFirst({
      where: {
        id: jobId,
        tenantId,
        collection: "JOBS",
        status: "PUBLISHED",
        publicAt: { not: null },
      },
      select: { id: true },
    });
    if (!job)
      throw new ApiError(404, "JOB_NOT_FOUND", "This job is unavailable.");
    await prisma.savedJob.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: { userId, jobId },
      update: {},
    });
    sendSuccess(res, { saved: true });
  }),
);
profilesRouter.delete(
  "/saved-jobs/:id",
  asyncHandler(async (req, res) => {
    await prisma.savedJob.deleteMany({
      where: { userId: req.session!.userId, jobId: String(req.params.id) },
    });
    sendSuccess(res, { saved: false });
  }),
);
