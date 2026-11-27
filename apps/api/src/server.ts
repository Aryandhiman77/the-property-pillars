import type { Server } from 'node:http';

import { app } from './app.js';
import { env } from './config/env.js';
import { disconnectDatabase, prisma } from './database/prisma.js';
import { logger } from './utils/logger.js';
import { cleanStagedUploads } from './uploads/cleanup.js';
import {deliverPropertyEnquiryEmails} from "./workspace/property-enquiry-email.js";

import {watchFile,unwatchFile} from "node:fs";
import {adminEnvPaths,readAdminEnvironment} from "./config/load-environment.js";
import {syncManagedAdmin} from "./services/managed-admin.js";

await syncManagedAdmin(readAdminEnvironment());
let adminSync = Promise.resolve();
function refreshAdmin() {
  adminSync = adminSync.then(() => syncManagedAdmin(readAdminEnvironment())).catch(() => {
    logger.error("Managed admin sync failed. Check admin configuration, account conflicts and database availability.");
  });
}
for (const path of adminEnvPaths) watchFile(path,{interval:2000,persistent:false},refreshAdmin);
// Re-read after installing the watchers to cover configuration changes during startup.
refreshAdmin();
const server: Server = app.listen(env.API_PORT, env.API_HOST, () => {
  logger.info('API server listening', {
    host: env.API_HOST,
    port: env.API_PORT,
    environment: env.NODE_ENV,
  });
});

let shuttingDown = false;
let cleaningUploads: Promise<void> | undefined;
const uploadCleanup = setInterval(() => {
  cleaningUploads ??= cleanStagedUploads().catch((error) => logger.error('Staged upload cleanup failed', {error: String(error)}))
    .finally(() => {cleaningUploads = undefined;});
}, 60 * 60 * 1000);
uploadCleanup.unref();
let cleaningChallenges: Promise<unknown> | undefined;
const challengeCleanup = setInterval(() => {
  cleaningChallenges ??= prisma.mobileChallenge.deleteMany({where: {expiresAt: {lt: new Date(Date.now() - 24 * 60 * 60_000)}}})
    .catch(() => logger.error("Mobile challenge cleanup failed"))
    .finally(() => {cleaningChallenges = undefined;});
}, 60 * 60_000);
challengeCleanup.unref();
let deliveringEnquiries: Promise<void> | undefined;
const enquiryDelivery = setInterval(() => {
  deliveringEnquiries ??= deliverPropertyEnquiryEmails()
    .catch(() => logger.error("Property enquiry email queue is unavailable"))
    .finally(() => {deliveringEnquiries = undefined;});
}, 10_000);
enquiryDelivery.unref();

async function closeServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const path of adminEnvPaths) unwatchFile(path,refreshAdmin);
  clearInterval(uploadCleanup);
  clearInterval(challengeCleanup);
  clearInterval(enquiryDelivery);
  logger.info('Graceful shutdown started', { signal });

  const forceTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out; closing active connections');
    server.closeAllConnections();
    process.exitCode = 1;
  }, 10_000);
  forceTimer.unref();

  try {
    await closeServer();
    await cleaningUploads;
    await cleaningChallenges;
    await deliveringEnquiries;
    await adminSync;
    await disconnectDatabase();
    process.exitCode = exitCode;
    logger.info('Graceful shutdown completed');
  } catch (error) {
    process.exitCode = 1;
    logger.error('Graceful shutdown failed', {
      error: error instanceof Error ? error.message : 'unknown error',
    });
  } finally {
    clearTimeout(forceTimer);
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

process.once('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
  });
  void shutdown('unhandledRejection', 1);
});

process.once('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  void shutdown('uncaughtException', 1);
});
