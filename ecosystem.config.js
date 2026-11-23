const path = require("node:path");

const apiDirectory = path.join(__dirname, "apps", "api");
const webDirectory = path.join(__dirname, "apps", "web");

module.exports = {
  apps: [
    {
      name: "tpp-api",
      cwd: apiDirectory,
      script: "dist/server.js",
      env: { NODE_ENV: "production" },
    },
    {
      name: "tpp-web",
      cwd: webDirectory,
      script: require.resolve("next/dist/bin/next", { paths: [webDirectory] }),
      args: ["start", "--hostname", "127.0.0.1", "--port", "3000"],
      env: { NODE_ENV: "production" },
    },
  ],
};
