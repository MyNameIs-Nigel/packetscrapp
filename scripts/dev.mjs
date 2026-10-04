import { spawn } from "node:child_process";

const children = [
  spawn(
    process.execPath,
    ["--import", "tsx", "--watch", "server/src/main.ts"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        PACKET_ENV: "local",
        PACKET_REGION: "local",
        PACKET_HOST: "127.0.0.1",
        PACKET_PORT: "2567",
      },
    },
  ),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--config", "client/vite.config.ts"],
    {
      stdio: "inherit",
    },
  ),
];

let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill(signal);
}
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop());
for (const child of children) {
  child.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code || 1;
      stop();
    }
  });
}
