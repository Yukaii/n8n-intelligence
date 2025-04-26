import type { Context } from "hono";

// Handler for GET /search
export async function searchHandler(c: Context) {
  return c.status(403);
  /*
  const query = c.req.query("q");
  if (!query) {
    return c.json({ error: "Query parameter q is required" }, 400);
  }
  try {
    // Use the refactored searchNodesForKeywords. Pass the query as a single-element array.
    const { searchResults } = await searchNodesForKeywords([query], c.env);

    // Process the single result set
    const combinedResultsData = searchResults[0]?.data || [];

    // Fetch full node content for the results
    const combinedFetched = await Promise.all(
      combinedResultsData.map((item: any) => fetchFullNode(item, c.env)),
    );

    // Uniqueness by file_id
    const uniqueNodes = Array.from(
      new Set(combinedFetched.map((node: any) => node.file_id)),
    ).map((id) => combinedFetched.find((node: any) => node.file_id === id));

    // Map and parse content
    const combined = uniqueNodes.map((node: any) => {
      console.log(node, "node");
      const { file_id, filename, content } = node;
      let parsedContent: any = content && content[0] && content[0].text;
      try {
        parsedContent = JSON.parse(parsedContent);
      } catch (error) {
        // leave as string if not JSON
        console.error("Error processing node content:", error, filename);
      }
      return { file_id, filename, content: parsedContent };
    });

    return c.json({
      combined,
      searchResults,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("env.AI") || msg.includes("binding")) {
      console.error("AI Binding Error:", err);
      return c.json(
        { error: "AI binding not configured or accessible.", details: msg },
        500,
      );
    }
    console.error("Search Handler Error:", msg);
    return c.json({ error: msg }, 500);
  }

  */
}
