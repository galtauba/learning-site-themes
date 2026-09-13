import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { stat } from "node:fs/promises";
import { ENGINE_VERSION, REQUIRED_COMPONENTS, readManifest, supportsVersion, themeDirectories } from "../src/contract.js";
import { validateThemes } from "../src/validate-themes.js";

test("all official themes pass manifest, Engine schema, asset, component, direction, and responsive validation", async () => {
  const report = await validateThemes();
  assert.equal(report.valid, true, JSON.stringify(report.issues, null, 2));
});

test("every official package is declarative and compatible with the current Engine", async () => {
  const directories = await themeDirectories();
  assert.deepEqual(directories.map(directory => directory.split(/[\\/]/).at(-1)), ["dark", "default"]);
  for (const directory of directories) {
    const manifest = await readManifest(directory);
    assert.ok(supportsVersion(manifest.engine.supportedVersions, ENGINE_VERSION));
    assert.deepEqual(new Set(manifest.components), new Set(REQUIRED_COMPONENTS));
    const packageJson = JSON.parse(await readFile(join(directory, "package.json"), "utf8")) as { scripts?: unknown; version: string };
    assert.equal(packageJson.scripts, undefined, "theme packages must not define executable scripts");
    assert.equal(packageJson.version, manifest.theme.version);
  }
});

test("theme CSS explicitly supports both text directions and narrow screens", async () => {
  for (const directory of await themeDirectories()) {
    const manifest = await readManifest(directory);
    const css = await readFile(join(directory, manifest.entrypoints.stylesheet), "utf8");
    assert.match(css, /\[dir="rtl"\]/);
    assert.match(css, /\[dir="ltr"\]/);
    assert.match(css, /@media \(max-width:/);
  }
});

test("generated registry exposes the package files that clients need", async () => {
  const registry = JSON.parse(await readFile(join(process.cwd(), "registry.json"), "utf8")) as { themes: { manifest: string; theme: string; stylesheet: string; preview: { image: string } }[] };
  assert.equal(registry.themes.length, 2);
  for (const theme of registry.themes) for (const file of [theme.manifest, theme.theme, theme.stylesheet, theme.preview.image]) await stat(join(process.cwd(), file));
});
