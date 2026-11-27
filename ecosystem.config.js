const path = require("node:path");

const apiDirectory = path.join(__dirname, "apps", "api");
const webDirectory = path.join(__dirname, "apps", "web");

const nodeInterpreter = process.env.TPP_NODE_BIN || process.execPath;

module.exports = {
  apps: [
    {
      name: "propertypillars-api",
      cwd: apiDirectory,
      script: "dist/server.js",
      interpreter: nodeInterpreter,

      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      restart_delay: 5000,
      max_memory_restart: "768M",

      env: {
        NODE_ENV: "production",
        API_HOST: "127.0.0.1",
        API_PORT: "4301",
      },
    },

    {
      name: "propertypillars-web",
      cwd: webDirectory,

      script: require.resolve("next/dist/bin/next", {
        paths: [webDirectory],
      }),

      args: ["start", "--hostname", "127.0.0.1", "--port", "3301"],

      interpreter: nodeInterpreter,

      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      restart_delay: 5000,
      max_memory_restart: "1024M",

      env: {
        NODE_ENV: "production",
        PORT: "3301",
        API_PROXY_TARGET: "http://127.0.0.1:4301",
      },
    },
  ],
};
