CREATE TABLE "WorkspaceNotificationRead" (
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceNotificationRead_pkey" PRIMARY KEY ("userId", "eventId"),
    CONSTRAINT "WorkspaceNotificationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceNotificationRead_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "WorkspaceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WorkspaceNotificationRead_eventId_idx" ON "WorkspaceNotificationRead"("eventId");
CREATE INDEX "WorkspaceEvent_tenantId_createdAt_id_idx" ON "WorkspaceEvent"("tenantId", "createdAt", "id");
