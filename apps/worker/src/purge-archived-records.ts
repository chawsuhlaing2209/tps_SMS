import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");
const cliScript = path.join(repoRoot, "apps/api/src/archive/purge-archived-cli.ts");

/** Runs the archive retention purge across all tenants via the API CLI. */
export async function handlePurgeArchivedRecords() {
  return new Promise<unknown>((resolve, reject) => {
    const child = spawn(tsxBin, [cliScript], {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "inherit"]
    });

    let stdout = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`purge-archived-records exited with code ${code}`));
        return;
      }
      const trimmed = stdout.trim();
      if (!trimmed) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(trimmed));
      } catch {
        resolve(trimmed);
      }
    });
  });
}
