import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_VERSION, readManifest, safeRelative, themeDirectories, repositoryRoot } from "./contract.js";
import { validateThemes } from "./validate-themes.js";

const output = join(repositoryRoot, "registry.json");
export async function generateRegistry(): Promise<void> {
  const report = await validateThemes();
  if (!report.valid) throw new Error(`Cannot generate registry:\n${report.issues.map(issue => `${issue.theme}: ${issue.code} — ${issue.message}`).join("\n")}`);
  const themes = await Promise.all((await themeDirectories()).map(async directory => { const manifest = await readManifest(directory); return { id: manifest.theme.id, name: manifest.theme.name, version: manifest.theme.version, engine: manifest.engine.supportedVersions, manifest: safeRelative(repositoryRoot, join(directory, "manifest.json")), theme: safeRelative(repositoryRoot, join(directory, "theme.json")), stylesheet: safeRelative(repositoryRoot, join(directory, manifest.entrypoints.stylesheet)), preview: { ...manifest.preview, image: safeRelative(repositoryRoot, join(directory, manifest.preview.image)) } }; }));
  await mkdir(repositoryRoot, { recursive: true });
  await writeFile(output, `${JSON.stringify({ registryVersion: "1.0.0", engineVersion: ENGINE_VERSION, generatedAt: "deterministic", themes }, null, 2)}\n`, "utf8");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generateRegistry();
