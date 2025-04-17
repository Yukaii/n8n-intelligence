// scripts/query-vectorize.ts
// Usage: ts-node scripts/query-vectorize.ts "your query here"

import OpenAI from "openai";
import { argv, exit, env } from "node:process";

const OPENAI_API_KEY = env.OPENAI_API_KEY;
const VECTORIZE_API_URL = env.VECTORIZE_API_URL; // e.g. .../vectorize/indexes/n8n-intelligence/query
const VECTORIZE_API_TOKEN = env.VECTORIZE_API_TOKEN;

if (!OPENAI_API_KEY || !VECTORIZE_API_URL || !VECTORIZE_API_TOKEN) {
  console.error("Missing OPENAI_API_KEY, VECTORIZE_API_URL, or VECTORIZE_API_TOKEN in environment.");
  exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    input: text,
    model: "text-embedding-ada-002",
  });
  if (!response.data?.[0]?.embedding) {
    throw new Error("No embedding returned from OpenAI.");
  }
  return response.data[0].embedding;
}

async function queryVectorize(query: string) {
  const embedding = await getEmbedding(query);

  const res = await fetch((VECTORIZE_API_URL as string).replace(/\/insert$/, "/query"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${VECTORIZE_API_TOKEN}`,
    },
    body: JSON.stringify({
      vector: embedding,
      topK: 5,
      includeVectors: false,
      includeMetadata: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vectorize query failed: ${err}`);
  }

  const data = await res.json();
  console.log("Query results:", JSON.stringify(data, null, 2));
}

async function main() {
  const query = argv.slice(2).join(" ");
  if (!query) {
    console.error("Usage: ts-node scripts/query-vectorize.ts \"your query here\"");
    exit(1);
  }
  await queryVectorize(query);
}

main().catch((err) => {
  console.error("Error during query:", err);
  exit(1);
});
