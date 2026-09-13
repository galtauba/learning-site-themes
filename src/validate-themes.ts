import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { themeSchema } from "@learning-site/engine";
import { ALLOWED_ASSET_EXTENSIONS, ENGINE_VERSION, REQUIRED_COMPONENTS, assetExtension, fileExists, isSemver, readEngineTheme, readManifest, supportsVersion, themeDirectories, themeFiles, type ThemeManifest } from "./contract.js";

export type ThemeIssue = { theme: string; code: string; message: string };
export type ValidationReport = { valid: boolean; issues: ThemeIssue[] };
const issue = (issues: ThemeIssue[], theme: string, code: string, message: string) => issues.push({ theme, code, message });
function equalJson(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
function validateSettings(manifest: ThemeManifest, issues: ThemeIssue[]) {
  const seen = new Set<string>();
  for (const setting of manifest.settings) {
    if (!/^[a-z][a-z0-9-]*$/.test(setting.key) || seen.has(setting.key)) issue(issues, manifest.theme.id, "INVALID_SETTING_KEY", `Setting key '${setting.key}' must be unique kebab-case.`);
    seen.add(setting.key);
    if (!setting.label || !setting.default || !setting.token.startsWith("--") || !(setting.token in manifest.theme.tokens)) issue(issues, manifest.theme.id, "INVALID_SETTING", `Setting '${setting.key}' must declare a label, default, and existing token.`);
    if (setting.type === "select" && (!setting.options?.length || !setting.options.some(option => option.value === setting.default))) issue(issues, manifest.theme.id, "INVALID_SETTING_OPTIONS", `Select setting '${setting.key}' must include its default in options.`);
  }
}
export async function validateThemes(): Promise<ValidationReport> {
  const issues: ThemeIssue[] = [], ids = new Set<string>();
  for (const directory of await themeDirectories()) {
    let manifest: ThemeManifest;
    try { manifest = await readManifest(directory); } catch { issue(issues, directory, "INVALID_MANIFEST_JSON", "manifest.json is not valid JSON."); continue; }
    const engineTheme = await readEngineTheme(directory).catch(() => undefined);
    const parsed = themeSchema.safeParse(manifest.theme);
    if (!parsed.success) issue(issues, manifest.theme?.id ?? directory, "ENGINE_SCHEMA", parsed.error.message);
    if (!engineTheme || !equalJson(engineTheme, manifest.theme)) issue(issues, manifest.theme?.id ?? directory, "THEME_CONTRACT_MISMATCH", "theme.json must exactly match manifest.theme.");
    if (!isSemver(manifest.theme.version)) issue(issues, manifest.theme.id, "INVALID_SEMVER", "Theme version must be semantic version.");
    if (ids.has(manifest.theme.id)) issue(issues, manifest.theme.id, "DUPLICATE_ID", "Theme id must be unique."); ids.add(manifest.theme.id);
    if (manifest.manifestVersion !== "1.0.0") issue(issues, manifest.theme.id, "MANIFEST_VERSION", "Unsupported manifest version.");
    if (!/^>=[0-9]+\.[0-9]+\.[0-9]+\s+<[0-9]+\.[0-9]+\.[0-9]+$/.test(manifest.engine.supportedVersions)) issue(issues, manifest.theme.id, "INVALID_ENGINE_RANGE", "Engine range must be an explicit >= / < range.");
    if (!manifest.engine.supportedVersions || !ENGINE_VERSION) issue(issues, manifest.theme.id, "MISSING_ENGINE_RANGE", "Engine compatibility is required.");
    else if (!supportsVersion(manifest.engine.supportedVersions, ENGINE_VERSION)) issue(issues, manifest.theme.id, "INCOMPATIBLE_ENGINE", `Theme does not support Engine ${ENGINE_VERSION}.`);
    try {
      const packageJson = JSON.parse(await readFile(join(directory, "package.json"), "utf8")) as { scripts?: unknown; version?: string };
      if (packageJson.scripts !== undefined) issue(issues, manifest.theme.id, "EXECUTABLE_THEME", "Theme packages must not define Node.js scripts.");
      if (packageJson.version !== manifest.theme.version) issue(issues, manifest.theme.id, "PACKAGE_VERSION_MISMATCH", "package.json version must match the manifest.");
    } catch { issue(issues, manifest.theme.id, "INVALID_PACKAGE_JSON", "Theme package.json is required and must be valid JSON."); }
    for (const file of await themeFiles(directory)) if (/\.(?:c?js|mjs|ts|tsx|sh|ps1|cmd|bat)$/i.test(file)) issue(issues, manifest.theme.id, "EXECUTABLE_FILE", `Theme packages may not contain executable file '${file}'.`);
    if (!(await fileExists(directory, manifest.entrypoints.stylesheet)) || !(await fileExists(directory, manifest.entrypoints.template))) issue(issues, manifest.theme.id, "MISSING_ENTRYPOINT", "Stylesheet and template files must exist.");
    for (const asset of [...(manifest.theme.assets ?? []), manifest.preview.image]) {
      if (!ALLOWED_ASSET_EXTENSIONS.has(assetExtension(asset)) || !(await fileExists(directory, asset))) issue(issues, manifest.theme.id, "INVALID_ASSET", `Asset '${asset}' is missing or uses a disallowed extension.`);
    }
    const componentSet = new Set(manifest.components);
    for (const component of REQUIRED_COMPONENTS) if (!componentSet.has(component)) issue(issues, manifest.theme.id, "MISSING_COMPONENT", `Required component '${component}' is not declared.`);
    validateSettings(manifest, issues);
    if (await fileExists(directory, manifest.entrypoints.stylesheet)) {
      const css = await readFile(join(directory, manifest.entrypoints.stylesheet), "utf8");
      for (const marker of ["[dir=\"rtl\"]", "[dir=\"ltr\"]", "@media (max-width:", "header", "nav", "article", "footer", "table", "pre", "blockquote"]) if (!css.includes(marker)) issue(issues, manifest.theme.id, "INCOMPLETE_STYLE_SUPPORT", `Stylesheet must support '${marker}'.`);
    }
  }
  return { valid: issues.length === 0, issues };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { const report = await validateThemes(); process.stdout.write(`${JSON.stringify(report, null, 2)}\n`); process.exitCode = report.valid ? 0 : 1; }
