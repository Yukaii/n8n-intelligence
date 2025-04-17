// scripts/export-nodes.ts
// Extracts unique nodes and writes each as nodes/$name.json

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const NODES_JSON = path.resolve(process.cwd(), "packages/backend/src/defaultNodes.json");
const OUT_DIR = path.resolve(process.cwd(), "nodes");

const KEYS = [
  "name",
  "displayName",
  "group",
  "description",
  "version",
  "inputs",
  "outputs",
  "properties",
  "credentials",
];

async function main() {
  const raw = await readFile(NODES_JSON, "utf-8");
  const nodes = JSON.parse(raw);

  await mkdir(OUT_DIR, { recursive: true });

  const seen = new Set<string>();
  for (const node of nodes) {
    if (!node.name || typeof node.name !== "string" || seen.has(node.name)) continue;
    seen.add(node.name);

    const filtered: Record<string, unknown> = {};
    for (const key of KEYS) {
      if (node[key] !== undefined) filtered[key] = node[key];
    }

    const filePath = path.join(OUT_DIR, `${node.name}.json`);
    await writeFile(filePath, JSON.stringify(filtered, null, 2), "utf-8");
    console.log(`Wrote ${filePath}`);
  }
}

main().catch((err) => {
  console.error("Error exporting nodes:", err);
  process.exit(1);
});
