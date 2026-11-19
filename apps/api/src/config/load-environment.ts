import {existsSync, readFileSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {parseEnv} from "node:util";

const configDirectory = dirname(fileURLToPath(import.meta.url));
const projectEnvPath = resolve(configDirectory, "../../../../.env");
const localEnvPath = resolve(configDirectory, "../../.env");

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
