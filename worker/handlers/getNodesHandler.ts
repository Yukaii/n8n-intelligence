import type { Context } from "hono";

// Handler for GET /nodes
export async function getNodesHandler(c: Context) {
  return c.json({
    message: "Not implemented yet",
  });

  // try {
  //   const endpoint = c.req.query("endpoint");
  //   const token = c.req.query("token");
  //   const nodes = await fetchNodes(endpoint, token);
  //   return c.json(nodes);
  // } catch (err: unknown) {
  //   const msg = err instanceof Error ? err.message : String(err);
  //   return c.json({ error: msg }, 500);
  // }
}
