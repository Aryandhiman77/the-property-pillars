import { Router } from "express";
import { prisma } from "../database/prisma.js";
import { requireSession } from "../middleware/session.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { sendSuccess } from "../helpers/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { listingPlanInput } from "./listing-plans.js";

export const planAdminRouter: Router = Router();
planAdminRouter.use(requireSession, (req, _res, next) =>
  next(
    req.session?.role === "ADMIN"
      ? undefined
      : new ApiError(403, "ADMIN_REQUIRED", "Administrator access required."),
  ),
);
planAdminRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await prisma.listingPlan.findMany({
        where: { tenantId: req.session!.tenantId },
        orderBy: { createdAt: "desc" },
      }),
    );
  }),
);
planAdminRouter.post(
  "/",
  validateBody(listingPlanInput),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await prisma.listingPlan.create({
        data: { ...req.body, tenantId: req.session!.tenantId },
      }),
      201,
    );
  }),
);
planAdminRouter.put(
  "/:id",
  validateBody(listingPlanInput),
  asyncHandler(async (req, res) => {
    const [plan] = await prisma.listingPlan.updateManyAndReturn({
      where: { id: String(req.params.id), tenantId: req.session!.tenantId },
      data: req.body,
    });
    if (!plan) throw new ApiError(404, "PLAN_NOT_FOUND", "Plan not found.");
    sendSuccess(res, plan);
  }),
);
planAdminRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await prisma.listingPlan.deleteMany({
      where: { id: String(req.params.id), tenantId: req.session!.tenantId },
    });
    if (!result.count)
      throw new ApiError(404, "PLAN_NOT_FOUND", "Plan not found.");
    sendSuccess(res, { deleted: true });
  }),
);
