import {existsSync, readFileSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {parseEnv} from "node:util";

const configDirectory = dirname(fileURLToPath(import.meta.url));
const projectEnvPath = resolve(configDirectory, "../../../../.env");
const localEnvPath = resolve(configDirectory, "../../.env");
export const adminEnvPaths = [projectEnvPath, localEnvPath];
const adminKeys = ["ADMIN_USERNAME","ADMIN_NAME","ADMIN_EMAIL","ADMIN_PASSWORD"] as const;
// Capture deployment overrides before the general dotenv loader fills process.env.
const deploymentAdmin = Object.fromEntries(adminKeys.map(key => [key,process.env[key]]));

export function readAdminEnvironment(): NodeJS.ProcessEnv {
  const [project,local] = adminEnvPaths.map(path => existsSync(path) ? parseEnv(readFileSync(path,"utf8")) : {});
  return Object.fromEntries(adminKeys.map(key => [key, deploymentAdmin[key] ?? (project?.[key]?.trim() ? project[key] : local?.[key])]));
}

export function loadApiEnvironment(keys: readonly string[]) {
  if (existsSync(projectEnvPath)) {
    const projectEnv = parseEnv(readFileSync(projectEnvPath, "utf8"));
    for (const key of keys) {
      const value = projectEnv[key];
      if (process.env[key] === undefined && value?.trim()) process.env[key] = value;
    }
  }
  if (existsSync(localEnvPath)) process.loadEnvFile(localEnvPath);
}
