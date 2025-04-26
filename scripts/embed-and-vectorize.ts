// scripts/embed-and-vectorize.ts
// 1. Loads defaultNodes.json
// 2. Uses OpenAI to generate an embedding for each node
// 3. Writes embedding to each node in the JSON
// 4. Inserts each node into Cloudflare Vectorize

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VECTORIZE_API_URL = process.env.VECTORIZE_API_URL!; // e.g. https://api.cloudflare.com/client/v4/accounts/{account_id}/vectorize/indexes/n8n-intelligence/insert
const VECTORIZE_API_TOKEN = process.env.VECTORIZE_API_TOKEN; // Cloudflare API Token

if (!OPENAI_API_KEY || !VECTORIZE_API_URL || !VECTORIZE_API_TOKEN) {
  console.error("Missing OPENAI_API_KEY, VECTORIZE_API_URL, or VECTORIZE_API_TOKEN in environment.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    input: text,
    model: "text-embedding-ada-002",
  });
  return response.data[0].embedding;
}

function nodeToText(node: any): string {
  // Concatenate key fields for embedding, truncating to avoid token limits
  function truncate(str: string, max = 512) {
    if (!str) return "";
    return str.length > max ? str.slice(0, max) + "..." : str;
  }
  return [
    truncate(node.displayName, 128),
    truncate(node.name, 128),
    truncate(node.description, 512),
    truncate(JSON.stringify(node.properties), 2048),
    truncate(JSON.stringify(node.credentials), 512),
  ].filter(Boolean).join("\n");
}

async function appendVectorNdjson(vector: object) {
  const ndjsonPath = path.resolve(process.cwd(), "vectors.ndjson");
  const line = JSON.stringify(vector) + "\n";
  await writeFile(ndjsonPath, line, { flag: "a" });
}

async function main() {
  const jsonPath = path.resolve(process.cwd(), "packages/backend/src/defaultNodes.json");
  const raw = await readFile(jsonPath, "utf-8");
  const nodes = JSON.parse(raw);

  // Progress preservation: collect already embedded node IDs from vectors.ndjson
  const ndjsonPath = path.resolve(process.cwd(), "vectors.ndjson");
  let alreadyEmbedded = new Set<string>();
  try {
    const ndjsonRaw = await readFile(ndjsonPath, "utf-8");
    for (const line of ndjsonRaw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj && obj.id) alreadyEmbedded.add(obj.id);
      } catch {}
    }
  } catch {
    // File may not exist yet, that's fine
  }

  const seenNames = new Set<string>();
  for (const node of nodes) {
    if (!node.name || typeof node.name !== "string" || node.name.trim() === "") {
      console.warn("Skipping node with undefined or empty name:", node);
      continue;
    }
    if (seenNames.has(node.name)) {
      console.warn(`Skipping duplicate node name: ${node.name}`);
      continue;
    }
    if (alreadyEmbedded.has(node.name)) {
      console.log(`Skipping already embedded node: ${node.name}`);
      continue;
    }
    seenNames.add(node.name);
    const text = nodeToText(node);
    const embedding = await getEmbedding(text);
    node.embedding = embedding;
    // Sanitize metadata: arrays must be arrays of strings, objects must be stringified, primitives allowed
    function sanitizeMeta(val: unknown): unknown {
      if (Array.isArray(val)) {
        // Convert all elements to strings
        return val.map((v) => (typeof v === "string" ? v : JSON.stringify(v)));
      }
      if (typeof val === "object" && val !== null) {
        return JSON.stringify(val);
      }
      return val;
    }
    const vector = {
      id: node.name,
      values: embedding,
      metadata: {
        name: String(node.name),
      },
    };
    await appendVectorNdjson(vector);
    console.log(`Embedded and wrote NDJSON: ${node.name}`);
  }

  // No longer writing embeddings to defaultNodes.json
  console.log("All nodes embedded and written to vectors.ndjson.");
}

async function uploadNdjsonToVectorize() {
  const ndjsonPath = path.resolve(process.cwd(), "vectors.ndjson");
  const ndjsonData = await readFile(ndjsonPath, "utf-8");
  const res = await fetch(VECTORIZE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-ndjson",
      "Authorization": `Bearer ${VECTORIZE_API_TOKEN}`,
    },
    body: ndjsonData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vectorize NDJSON upload failed: ${err}`);
  }
  console.log("NDJSON upload to Vectorize successful.");
}

;(async () => {
  try {
    await main()
    console.log("Embedding complete, starting upload…")
    await uploadNdjsonToVectorize()
    console.log("Upload complete.")
  } catch (err) {
    console.error("Error during embedding or upload:", err)
    process.exit(1)
  }
})()


// To upload after embedding, call: await uploadNdjsonToVectorize();
