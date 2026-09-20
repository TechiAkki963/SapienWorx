import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const nextCLI = fileURLToPath(
  new URL("../../node_modules/next/dist/bin/next", import.meta.url),
);
const child = spawn(
  process.execPath,
  [nextCLI, "dev", "--hostname", "127.0.0.1", "--port", "3000"],
  {
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:18080",
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
