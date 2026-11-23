CREATE TABLE "PropertyView" (
    "propertyId" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,

    CONSTRAINT "PropertyView_pkey" PRIMARY KEY ("propertyId", "visitorHash")
);

ALTER TABLE "PropertyView" ADD CONSTRAINT "PropertyView_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "WorkspaceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
