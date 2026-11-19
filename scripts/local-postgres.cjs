const {existsSync, mkdirSync, readFileSync, writeFileSync} = require("node:fs");
const {join, resolve} = require("node:path");
const {spawnSync} = require("node:child_process");
const {randomBytes} = require("node:crypto");
const {parseEnv} = require("node:util");

const root = resolve(__dirname, "..");
const runtime = join(root, "tmp", "local-postgres");
const data = join(runtime, "data");
const passwordFile = join(runtime, "password");
const envFile = join(root, "apps", "api", ".env");
const windows = process.platform === "win32";
const projectEnv = join(root, ".env");
const localBin = existsSync(projectEnv) ? parseEnv(readFileSync(projectEnv, "utf8")).TPP_POSTGRES_BIN : undefined;
const bin = process.env.TPP_POSTGRES_BIN || localBin || (windows
  ? "C:\\Program Files\\PostgreSQL\\18\\bin"
  : "");
const port = "55432";
const user = "tpp_local";
const database = "the-property-pillar";

function run(command, args, options = {}) {
  const executable = bin ? join(bin, command + (windows ? ".exe" : "")) : command;
  const result = spawnSync(executable, args, {encoding: "utf8", ...options});
  if (result.error) throw result.error;
  return result;
}

function runRequired(command, args, options) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || command + " failed");
  }
  return result.stdout;
}

function start() {
  mkdirSync(runtime, {recursive: true});
  if (!existsSync(passwordFile)) {
    writeFileSync(passwordFile, randomBytes(24).toString("hex") + "\n", {flag: "wx"});
  }
  const password = readFileSync(passwordFile, "utf8").trim();
  if (!existsSync(join(data, "PG_VERSION"))) {
    runRequired("initdb", [
      "-D", data, "-U", user, "--auth=scram-sha-256",
      "--pwfile=" + passwordFile, "--encoding=UTF8", "--no-locale",
    ]);
  }

  if (run("pg_ctl", ["-D", data, "status"]).status !== 0) {
    runRequired("pg_ctl", [
      "-D", data, "-l", join(runtime, "postgres.log"), "-w", "-t", "20",
      "-o", "-p " + port + " -h 127.0.0.1", "start",
    ], {stdio: "ignore"});
  }

  const psqlArgs = ["-h", "127.0.0.1", "-p", port, "-U", user, "-d", "postgres", "-Atw", "-c"];
  const options = {env: {...process.env, PGPASSWORD: password}};
  const exists = runRequired(
    "psql", [...psqlArgs, "SELECT 1 FROM pg_database WHERE datname = 'the-property-pillar'"], options,
  ).trim();
  if (!exists) runRequired("psql", [...psqlArgs, 'CREATE DATABASE "the-property-pillar"'], options);

  if (!existsSync(envFile)) {
    const url = "postgresql://" + user + ":" + password + "@127.0.0.1:" + port + "/" + database + "?schema=public";
    writeFileSync(envFile, [
      "NODE_ENV=development",
      "API_HOST=127.0.0.1",
      "API_PORT=4000",
      "DATABASE_URL=" + url,
      "CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001",
      "JWT_SECRET=" + randomBytes(48).toString("base64url"),
      "AUTH_RATE_LIMIT_MAX=60",
      "RATE_LIMIT_MAX=240",
      "",
    ].join("\n"), {flag: "wx"});
  }
  console.log("PostgreSQL is running at 127.0.0.1:" + port + " with database " + database + ".");
}

try {
  if (process.argv[2] === "stop") {
    if (existsSync(join(data, "PG_VERSION")) && run("pg_ctl", ["-D", data, "status"]).status === 0) {
      runRequired("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
    }
  } else {
    start();
  }
} catch (error) {
  console.error("Local PostgreSQL setup failed:", error.message);
  process.exitCode = 1;
}
