// scripts/crawl-nodes.ts
// Crawls all n8n basic nodes from n8n-nodes-base and outputs a JSON file for AI/RAG use.
// Run with: bun run scripts/crawl-nodes.ts

import { writeFile } from "node:fs/promises";
import path from "node:path";

// Try to import all node classes from n8n-nodes-base
// This script assumes n8n-nodes-base is installed as a dependency or linked in node_modules
// and that it exposes a directory of node files under 'n8n-nodes-base/dist/nodes'

async function main() {
  // Try to resolve the n8n-nodes-base package
  let nodesBasePath: string;
  try {
    nodesBasePath = require.resolve("n8n-nodes-base");
  } catch (e) {
    console.error("n8n-nodes-base not found. Please install it in your project.");
    process.exit(1);
  }

  // Find the nodes directory (works for both ESM and CJS builds)
  const nodesDir = path.join(
    nodesBasePath,
    "..",
    "dist",
    "nodes"
  );

  // Recursively find all .node.js files in nodesDir and subdirectories
  async function findNodeFiles(dir: string): Promise<string[]> {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await findNodeFiles(fullPath)));
      } else if (entry.isFile() && entry.name.endsWith(".node.js")) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const nodeFiles = await findNodeFiles(nodesDir);

  const nodes: unknown[] = [];

  for (const file of nodeFiles) {
    try {
      // Dynamic import for ESM/CJS compatibility
      const mod = await import(file);
      // Derive export name from filename (e.g., ActionNetwork from ActionNetwork.node.js)
      const match = /([A-Za-z0-9_]+)\.node\.js$/.exec(file);
      if (!match) continue;
      const exportName = match[1];
      const NodeClass = mod[exportName];
      if (!NodeClass) continue;
      const nodeInstance = new NodeClass();
      if (!nodeInstance.description) continue;
      // Only keep the fields needed for AI/RAG
      const {
        name,
        displayName,
        group,
        description,
        version,
        inputs,
        outputs,
        properties,
        credentials,
        documentationUrl,
      } = nodeInstance.description;
      nodes.push({
        name,
        displayName,
        group,
        description,
        version,
        inputs,
        outputs,
        properties,
        credentials,
        documentationUrl,
      });
    } catch (e) {
      // Ignore files that aren't valid nodes
    }
  }

  const outputPath = path.resolve(
    process.cwd(),
    "packages/backend/data/defaultNodes.json"
  );
  await writeFile(outputPath, JSON.stringify(nodes, null, 2), "utf-8");
  console.log(`Wrote ${nodes.length} nodes to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
