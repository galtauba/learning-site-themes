import { mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { repositoryRoot, themeDirectories } from "./contract.js";
import { generateRegistry } from "./generate-registry.js";

const run = promisify(execFile);
export async function packageThemes(): Promise<void> {
  await generateRegistry();
  const output = join(repositoryRoot, "release");
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const npmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  for (const theme of await themeDirectories()) await run(process.execPath, [npmCli, "pack", "--pack-destination", output], { cwd: theme, windowsHide: true });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await packageThemes();
