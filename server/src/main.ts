import { parseConfig } from "./config.ts";
import { stdoutSink } from "./logger.ts";
import { startServer } from "./server.ts";

try {
  const config = parseConfig(process.env);
  // Structured events on stdout are the only runtime output; `server_started` marks readiness.
  await startServer(config, { logSink: stdoutSink });
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
