// Utility for extracting keywords from a user prompt using OpenAI

import type OpenAI from "openai";

/**
 * Extracts up to 5 concise keywords or phrases from a user prompt for n8n node search.
 */
export async function extractKeywordsFromPrompt(
  openai: OpenAI,
  userPrompt: string,
): Promise<string[]> {
  const systemPrompt = `You are an expert at extracting relevant search terms for finding n8n nodes.
Given a user prompt describing an n8n workflow, extract up to 5 concise keywords or phrases that best represent the core actions, services, or data transformations involved.
Focus on terms likely to match n8n node names or functionalities. Avoid generic words.
Return the keywords according to the provided JSON schema.`;

  const keywordResp = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "keywords_object",
        description:
          "An object containing a list of extracted keywords for n8n node search.",
        schema: {
          type: "object",
          properties: {
            keywords: {
              type: "array",
              items: { type: "string" },
              description: "Up to 5 relevant keywords or phrases.",
            },
          },
          required: ["keywords"],
          additionalProperties: false,
        },
        strict: true,
      },
    },
  });

  let keywords: string[] = [];
  try {
    const responseContent = keywordResp.choices?.[0]?.message?.content;
    if (!responseContent) {
      throw new Error(
        "No content received from OpenAI for keyword extraction.",
      );
    }
    const parsedJson = JSON.parse(responseContent);

    if (parsedJson && Array.isArray(parsedJson.keywords)) {
      keywords = parsedJson.keywords;
    } else {
      console.error("Unexpected JSON structure for keywords:", parsedJson);
      throw new Error(
        "Keywords extracted are not in the expected {keywords: [...]} format.",
      );
    }

    if (!keywords.every((kw) => typeof kw === "string")) {
      console.error(
        "Not all items in the extracted keywords array are strings:",
        keywords,
      );
      throw new Error("Keywords array contains non-string elements.");
    }
  } catch (e) {
    console.error(
      "Failed to parse keywords JSON:",
      e,
      "Raw content:",
      keywordResp.choices?.[0]?.message?.content,
    );
    throw new Error(
      `Failed to extract or parse keywords: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return keywords;
}
