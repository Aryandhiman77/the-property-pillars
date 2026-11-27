import {env} from "../config/env.js";
import {disconnectDatabase} from "../database/prisma.js";
import {syncManagedAdmin} from "../services/managed-admin.js";

try {
  if (env.NODE_ENV === "production" && process.env.ALLOW_ADMIN_BOOTSTRAP !== "true") {
    throw new Error("Set ALLOW_ADMIN_BOOTSTRAP=true to run the manual admin command in production.");
  }
  await syncManagedAdmin(process.env,true);
  console.info("Marketplace administrator synchronised.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Admin sync failed.");
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
