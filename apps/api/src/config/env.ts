import { z } from "zod";
import { loadApiEnvironment } from "./load-environment.js";

const booleanFromString = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;
  return value.trim().toLowerCase() === "true";
}, z.boolean());

const optionalNonEmptyString = (minimum = 1) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(minimum).optional(),
  );

const TEST_JWT_SECRET =
  "test-only-jwt-secret-never-use-outside-automated-tests-2026";

const environmentFields = z.object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    API_HOST: z.string().min(1).default("127.0.0.1"),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    UPLOAD_ROOT: optionalNonEmptyString(),
    DATABASE_URL: z
      .string()
      .min(1)
      .default(
        "postgresql://postgres:password@127.0.0.1:55432/the-property-pillar?schema=public",
      )
      .refine((value) => /^postgres(?:ql)?:\/\//i.test(value), {
        message: "DATABASE_URL must be a PostgreSQL connection URL",
      }),
    PUBLIC_TENANT_ID: z
      .string()
      .trim()
      .min(8)
      .max(100)
      .default("the-property-pillar-marketplace"),
    CORS_ORIGINS: z
      .string()
      .default("http://localhost:3000,http://127.0.0.1:3000"),
    JWT_SECRET: z.string().min(32).max(1024).optional(),
    JWT_ISSUER: z
      .string()
      .trim()
      .min(3)
      .max(200)
      .default("the-property-pillar-api"),
    JWT_AUDIENCE: z
      .string()
      .trim()
      .min(3)
      .max(200)
      .default("the-property-pillar-web"),
    GOOGLE_OAUTH_CLIENT_ID: optionalNonEmptyString(),
    GOOGLE_OAUTH_CLIENT_SECRET: optionalNonEmptyString(),
    GOOGLE_OAUTH_REDIRECT_URI: optionalNonEmptyString(),
    JWT_CLOCK_TOLERANCE_SECONDS: z.coerce
      .number()
      .int()
      .min(0)
      .max(60)
      .default(5),
    RAZORPAY_KEY_ID: optionalNonEmptyString(),
    RAZORPAY_KEY_SECRET: optionalNonEmptyString(),
    RAZORPAY_WEBHOOK_SECRET: optionalNonEmptyString(16),
    BILLING_CONFIG_FILE: optionalNonEmptyString(),
    SESSION_COOKIE_NAME: z.string().min(1).default("tpp_session"),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    SMTP_HOST: optionalNonEmptyString(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    SMTP_USER: optionalNonEmptyString(),
    SMTP_PASSWORD: optionalNonEmptyString(),
    SMTP_FROM: optionalNonEmptyString(),
    RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(10_000)
      .max(3_600_000)
      .default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(120),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(500).default(20),
    TRUST_PROXY: booleanFromString.default(false),
  });

loadApiEnvironment([...Object.keys(environmentFields.shape), "ALLOW_ADMIN_BOOTSTRAP"]);

const environmentSchema = environmentFields
  .superRefine((value, context) => {
    if (value.NODE_ENV !== "test" && !value.JWT_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message:
          "JWT_SECRET is required outside tests and must contain at least 32 characters",
      });
    }
  })
  .transform((value) => ({
    ...value,
    JWT_SECRET: value.JWT_SECRET ?? TEST_JWT_SECRET,
    allowedOrigins: value.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  }));

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  const summary = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid API environment: ${summary}`);
}

export const env = result.data;
export type Environment = typeof env;
