import { defineConfig } from "vite";

// The build environment is chosen by the same variable the artifact builder
// validates. Anything but `local` compiles the local movement prototype out.
const environment = process.env.PACKET_BUILD_ENV ?? "local";

export default defineConfig({
  root: import.meta.dirname,
  define: { __CLIENT_ENV__: JSON.stringify(environment) },
  build: { outDir: "../dist/client", emptyOutDir: true },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
