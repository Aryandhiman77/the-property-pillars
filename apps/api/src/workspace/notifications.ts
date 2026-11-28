import {Prisma, WorkspaceCollection} from "@prisma/client";
import {Router, type Request, type Router as ExpressRouter} from "express";
import {sendSuccess} from "../helpers/api-response.js";
import {requireSession} from "../middleware/session.middleware.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {collectionConfigs} from "./config.js";
import {workspacePrisma} from "./db.js";

const configs = Object.values(collectionConfigs);

function visibleEvents(request: Request): Prisma.WorkspaceEventWhereInput {
  const session = request.session!;
  return {
    tenantId: session.tenantId,
    OR: [{actorId: {not: session.userId}}, {actorId: null, item: {targetUserId: session.userId}}, ...(session.role === "ADMIN" ? [{actorId:null, item:{collection:"GRIEVANCES" as const}}] : [])],
    item: {
      tenantId: session.tenantId,
      collection: {in: configs.filter(({visibleRoles}) => visibleRoles.includes(session.role)).map(({dbCollection}) => dbCollection as WorkspaceCollection)},
      ...(session.role !== "ADMIN" ? {OR: [{ownerId: session.userId}, {targetUserId: session.userId, collection: {not:"JOB_APPLICATIONS"}}]} : {}),
    },
  };
}

export const notificationsRouter: ExpressRouter = Router();
notificationsRouter.use(requireSession);

notificationsRouter.get("/", asyncHandler(async (request, response) => {
  const {userId} = request.session!;
  const unread = request.query.unread === "1";
  const cursor = !unread && typeof request.query.cursor === "string" ? request.query.cursor.slice(0, 80) : "";
  const limit = unread ? 10 : 25;
  const events = await workspacePrisma.workspaceEvent.findMany({
    where: {...visibleEvents(request), ...(unread ? {notificationReads: {none: {userId}}} : {})},
    orderBy: [{createdAt: "desc"}, {id: "desc"}],
    take: limit + 1,
    ...(cursor ? {cursor: {id: cursor}, skip: 1} : {}),
    select: {
      id: true, action: true, toStatus: true, createdAt: true,
      item: {select: {id: true, title: true, collection: true}},
      notificationReads: {where: {userId}, select: {readAt: true}},
    },
  });
  const entries = events.slice(0, limit).map((entry) => {
    const collection = configs.find(({dbCollection}) => dbCollection === entry.item.collection)!;
    return {
      id: entry.id, action: entry.action, status: entry.toStatus, createdAt: entry.createdAt.toISOString(),
      itemId: entry.item.id, title: entry.item.title, collection: collection.key, collectionLabel: collection.label,
      readAt: entry.notificationReads[0]?.readAt.toISOString() ?? null,
    };
  });
  sendSuccess(response, {entries, nextCursor: !unread && events.length > limit ? entries.at(-1)?.id : null});
}));

notificationsRouter.patch("/:id/read", asyncHandler(async (request, response) => {
  const id = typeof request.params.id === "string" ? request.params.id.slice(0, 80) : "";
  const userId = request.session!.userId;
  const item = await workspacePrisma.workspaceEvent.findFirst({where: {...visibleEvents(request), id}, select: {id: true}});
  if (!item) throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
  await workspacePrisma.workspaceNotificationRead.createMany({data: [{eventId: id, userId}], skipDuplicates: true});
  const read = await workspacePrisma.workspaceNotificationRead.findUniqueOrThrow({where: {userId_eventId: {userId, eventId: id}}});
  sendSuccess(response, {readAt: read.readAt.toISOString()});
}));
