import { parseConfig } from "./config.ts";
import { startServer } from "./server.ts";

try {
  const config = parseConfig(process.env);
  await startServer(config);
  process.stdout.write(
    `Packet Scrapp ${config.environment}/${config.region} listening on ${config.host}:${config.port}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
