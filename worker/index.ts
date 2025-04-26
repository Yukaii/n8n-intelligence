import { Hono } from "hono";
import type { Context, Next } from "hono";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { Redis } from "@upstash/redis/cloudflare";
import { generateWorkflowHandler } from "./handlers/generateWorkflowHandler";
import { getNodesHandler } from "./handlers/getNodesHandler";
import { QUOTA_LIMIT, QUOTA_WINDOW_SEC } from "./utils/quota";
import { searchHandler } from "./handlers/searchHandler";
// import defaultNodes from "./data/defaultNodes.json";

const app = new Hono();

app.use("*", (c: Context, next: Next) => {
  return clerkMiddleware({
    secretKey: c.env.CLERK_SECRET_KEY,
    publishableKey: c.env.VITE_CLERK_PUBLISHABLE_KEY,
  })(c, next);
});

app.post("/generate-workflow", generateWorkflowHandler);
app.get("/nodes", getNodesHandler);
// POST '/generate-workflow' is now defined above using streamSSE
app.get("/search", searchHandler);

// --- Quota info endpoint ---
app.get("/quota", async (c: Context) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    c.status(403);
    return c.json({ message: "You are not logged in." });
  }
  const redis = new Redis({
    url: c.env.UPSTASH_REDIS_REST_URL,
    token: c.env.UPSTASH_REDIS_REST_TOKEN,
  });
  const quotaKey = `quota:${auth.userId}`;
  const quota = await redis.get(quotaKey);
  const remaining = quota === null ? QUOTA_LIMIT : Number(quota);
  const ttl = await redis.ttl(quotaKey);
  const reset = Date.now() + (ttl > 0 ? ttl * 1000 : QUOTA_WINDOW_SEC * 1000);
  return c.json({ remaining, reset });
});

export default app;
