// Utility for generating workflows with OpenAI

import type OpenAI from "openai";
import type { INodeTypeDescription } from "n8n-workflow";

/**
 * Generates a workflow using OpenAI, given a prompt, nodes, and user prompt.
 */
export async function generateWorkflowWithAI(
  openai: OpenAI,
  prompt: string,
  nodes: Array<
    Partial<INodeTypeDescription> & {
      filename?: string;
      file_id?: string;
      content?: unknown;
    }
  >,
  userPrompt: string,
): Promise<unknown> {
  const systemMsg = `${prompt}\n\nRelevant nodes from search: ${JSON.stringify(nodes)}`;
  const userMsg = userPrompt;
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: userMsg },
    ],
    temperature: 0,
    response_format: {
      type: "json_object",
    },
  });
  const content = completion.choices?.[0]?.message?.content || "";
  let workflow: unknown;
  try {
    workflow = JSON.parse(content);
  } catch (parseErr: unknown) {
    throw { error: "Invalid JSON from AI", details: String(parseErr), content };
  }
  return workflow;
}
