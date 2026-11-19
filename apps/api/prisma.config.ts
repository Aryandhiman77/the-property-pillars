import {defineConfig} from "prisma/config";
import {loadApiEnvironment} from "./src/config/load-environment.ts";

loadApiEnvironment(["DATABASE_URL"]);

export default defineConfig({schema: "prisma/schema.prisma"});
