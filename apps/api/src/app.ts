import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application } from "express";
import helmet from "helmet";

import { billingRouter } from "./billing/router.js";
import { razorpayWebhookHandler } from "./billing/webhook.js";
import { corsOptions } from "./config/http.js";
import { env } from "./config/env.js";
import { locationsRouter } from "./locations/router.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { globalRateLimiter } from "./middleware/rate-limit.middleware.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { requestLoggerMiddleware } from "./middleware/request-logger.middleware.js";
import { sessionContextMiddleware } from "./middleware/session.middleware.js";
import { trustedOriginMiddleware } from "./middleware/trusted-origin.middleware.js";
import { authRouter, healthRouter } from "./routes/index.js";
import { accountRouter } from "./routes/account.routes.js";
import { uploadsRouter } from "./uploads/router.js";
import { resumesRouter } from "./uploads/resumes.js";
import { notificationsRouter } from "./workspace/notifications.js";
import { workspaceRouter } from "./workspace/router.js";

export const app: Application = express();

app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY ? 1 : false);

app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());
app.use(globalRateLimiter);
app.post(
  "/api/v1/webhooks/razorpay",
  express.raw({ type: "application/json", limit: "256kb" }),
  razorpayWebhookHandler,
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());
app.use("/api/v1", (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});

// Liveness never consults the session store or database. Readiness checks Prisma explicitly.
app.use("/api/v1", healthRouter);
app.use("/api/v1/locations", locationsRouter);

app.use(trustedOriginMiddleware);
app.use(sessionContextMiddleware);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/account", accountRouter);
app.use("/api/v1/uploads/resumes", resumesRouter);
app.use("/api/v1/uploads", uploadsRouter);
app.use("/api/v1/workspace/notifications", notificationsRouter);
app.use("/api/v1", billingRouter);

// Workspace private routes enforce sessions internally; public projections stay readable.
app.use("/api/v1", workspaceRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
