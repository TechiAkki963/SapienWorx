import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const nextCLI = fileURLToPath(
  new URL("../../node_modules/next/dist/bin/next", import.meta.url),
);
const child = spawn(
  process.execPath,
  [nextCLI, "dev", "--hostname", "127.0.0.1", "--port", process.env.E2E_WEB_PORT || "3000"],
  {
    env: {
      ...process.env,
      // Synthetic CV journeys must not enable unscanned uploads in the real app.
      NEXT_PUBLIC_CV_PARSE_PREVIEW_ENABLED: "true",
      INTERNAL_API_URL: `http://127.0.0.1:${process.env.E2E_MOCK_API_PORT || "18080"}`,
      NEXT_PUBLIC_API_URL: `http://127.0.0.1:${process.env.E2E_MOCK_API_PORT || "18080"}`,
    },
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
