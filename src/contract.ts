import { readFile, readdir, stat } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const ENGINE_VERSION = "4.0.0";
export const REQUIRED_COMPONENTS = [
  "document", "header", "brand", "navigation", "main", "article", "footer",
  "heading", "paragraph", "link", "image", "list", "strong", "blockquote", "table",
  "inline-code", "code-block", "horizontal-rule", "homepage", "search", "table-of-contents", "callout", "mermaid", "theme-toggle"
] as const;
export const ALLOWED_ASSET_EXTENSIONS = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp", ".woff2"]);
export type ThemeSetting = { key: string; label: string; type: "color" | "font" | "select"; token: string; default: string; options?: { label: string; value: string }[] };
export type ThemeManifest = {
  manifestVersion: "1.0.0";
  theme: { id: string; name: string; version: string; tokens: Record<string, string>; assets?: string[] };
  engine: { supportedVersions: string };
  entrypoints: { stylesheet: string; template: string };
  components: readonly string[];
  settings: ThemeSetting[];
  preview: { title: string; description: string; image: string; background: string; accent: string };
};
const moduleDirectory = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = basename(dirname(moduleDirectory)) === "dist" ? dirname(dirname(moduleDirectory)) : dirname(moduleDirectory);
export const themesRoot = join(repositoryRoot, "themes");
const json = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, "utf8")) as T;
export async function themeDirectories(): Promise<string[]> {
  const entries = await readdir(themesRoot, { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory()).map(entry => join(themesRoot, entry.name)).sort();
}
export async function themeFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  const visit = async (current: string): Promise<void> => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path); else if (entry.isFile()) files.push(safeRelative(directory, path));
    }
  };
  await visit(directory);
  return files.sort();
}
export async function readManifest(directory: string): Promise<ThemeManifest> { return json<ThemeManifest>(join(directory, "manifest.json")); }
export async function readEngineTheme(directory: string): Promise<ThemeManifest["theme"]> { return json<ThemeManifest["theme"]>(join(directory, "theme.json")); }
export async function fileExists(directory: string, packagePath: string): Promise<boolean> {
  if (!packagePath || packagePath.startsWith("/") || packagePath.includes("\\") || packagePath.split("/").includes("..")) return false;
  try { return (await stat(join(directory, packagePath))).isFile(); } catch { return false; }
}
export function assetExtension(path: string): string { return path.slice(path.lastIndexOf(".")).toLowerCase(); }
export function isSemver(value: string): boolean { return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value); }
export function supportsVersion(range: string, version: string): boolean {
  const match = /^>=([0-9]+)\.([0-9]+)\.([0-9]+)\s+<([0-9]+)\.([0-9]+)\.([0-9]+)$/.exec(range);
  const target = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match || !target) return false;
  const asTuple = (items: string[], from: number): number[] => items.slice(from, from + 3).map(Number);
  const compare = (a: number[], b: number[]) => a.findIndex((n, i) => n !== b[i]) === -1 ? 0 : a.find((n, i) => n !== b[i])! > b[a.findIndex((n, i) => n !== b[i])]! ? 1 : -1;
  const v = asTuple(target, 1), min = asTuple(match, 1), max = asTuple(match, 4);
  return compare(v, min) >= 0 && compare(v, max) < 0;
}
export function safeRelative(directory: string, file: string): string { return relative(directory, file).replaceAll("\\", "/"); }
