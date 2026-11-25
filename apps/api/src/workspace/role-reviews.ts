import {Router, type Router as ExpressRouter} from "express";
import {z} from "zod";
import {sendSuccess} from "../helpers/api-response.js";
import {parseInput} from "../helpers/parse-input.js";
import {requireRole} from "../middleware/session.middleware.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {workspacePrisma as db} from "./db.js";

export const roleReviews: ExpressRouter = Router();
roleReviews.use(requireRole("ADMIN"));
roleReviews.get("/", asyncHandler(async (req,res) => {
  const rows = await db.legacyRoleReview.findMany({
    where: {tenantId:req.session!.tenantId, decidedAt:null}, orderBy:{userId:"asc"}, take:50,
    select:{userId:true,originalRole:true,reason:true,user:{select:{fullName:true}}},
  });
  sendSuccess(res,rows);
}));
export async function requireConfirmedListingRole(tenantId:string,userId:string) {
  if (await db.legacyRoleReview.findFirst({where:{tenantId,userId,decidedAt:null},select:{userId:true}})) {
    throw new ApiError(409,"ACCOUNT_ROLE_REVIEW","Your account role is under review. You can view your existing records while an administrator confirms your listing access.");
  }
}

const decision = z.object({role:z.enum(["BUYER","OWNER","DEALER","WHITE_COLLAR_SEEKER","BLUE_COLLAR_WORKER"]),note:z.string().trim().min(10).max(1000)}).strict();
roleReviews.post("/:id", asyncHandler(async(req,res) => {
  const {role,note} = parseInput(decision,req.body);
  const {tenantId,userId:actor} = req.session!;
  const userId = String(req.params.id);
  await db.$transaction(async tx => {
    const row = await tx.legacyRoleReview.findFirst({where:{userId,tenantId,decidedAt:null}});
    if (!row) throw new ApiError(404,"NO_PENDING_REVIEW","This review is no longer pending.");
    const worker = row.originalRole === "WHITE_COLLAR_SEEKER";
    if (worker !== (role === "WHITE_COLLAR_SEEKER" || role === "BLUE_COLLAR_WORKER")) throw new ApiError(422,"INVALID_ROLE","Choose a role from this account’s review group.");
    const updated = await tx.legacyRoleReview.updateMany({where:{userId,tenantId,decidedAt:null},data:{decidedAt:new Date(),decidedById:actor,decisionNote:note,decidedRole:role}});
    if (!updated.count) throw new ApiError(409,"ALREADY_REVIEWED","This review has already been decided.");
    const changed = await tx.user.updateMany({where:{id:userId,tenantId,role:row.originalRole},data:{role}});
    if (!changed.count) throw new ApiError(409,"ROLE_CHANGED","The account role has changed since review was opened.");
    if (role !== row.originalRole) await tx.session.updateMany({where:{userId,tenantId,revokedAt:null},data:{revokedAt:new Date()}});
  });
  sendSuccess(res,{role});
}));
