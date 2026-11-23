import {Router, type Router as ExpressRouter} from "express";
import {z} from "zod";
import {env} from "../config/env.js";
import {sendSuccess} from "../helpers/api-response.js";
import {parseInput} from "../helpers/parse-input.js";
import {requireRole} from "../middleware/session.middleware.js";
import {asyncHandler} from "../utils/async-handler.js";
import {workspacePrisma} from "./db.js";

export const websiteThemeRouter: ExpressRouter = Router();
const fields = z.object({accentColor: z.string().regex(/^#[0-9a-f]{6}$/i, "Choose a six-digit hex color.").transform((color) => color.toLowerCase()).nullable()}).strict();

websiteThemeRouter.get("/public/website-theme", asyncHandler(async (req, res) => {
  const id = req.session?.tenantId ?? env.PUBLIC_TENANT_ID;
  const settings = await workspacePrisma.tenant.findFirst({where: {id, isDemo: false}, select: {accentColor: true}});
  res.set("Cache-Control", "private, no-store");
  sendSuccess(res, {accentColor: settings?.accentColor ?? null});
}));

websiteThemeRouter.patch("/workspace/website-theme", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const data = parseInput(fields, req.body);
  sendSuccess(res, await workspacePrisma.tenant.update({where: {id: req.session!.tenantId}, data, select: {accentColor: true}}));
}));
