import { useState } from "react";
import useSWRMutation from "swr/mutation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Copy } from "lucide-react";

type WorkflowResult = {
  workflow?: unknown;
  [key: string]: unknown;
};

async function generateWorkflow(
  url: string,
  { arg }: { arg: { prompt: string } }
): Promise<WorkflowResult> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || "Request failed");
  }
  return resp.json();
}

function App() {
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  const {
    trigger,
    data: result,
    error,
    isMutating: loading,
    reset,
  } = useSWRMutation("/generate-workflow", generateWorkflow);

  const handleGenerate = async () => {
    reset();
    setCopied(false);
    await trigger({ prompt });
  };

  const handleCopy = async () => {
    if (result && result.workflow) {
      await navigator.clipboard.writeText(JSON.stringify(result.workflow, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-16 p-6 border rounded-lg shadow space-y-6">
      <h1 className="text-2xl font-bold mb-2">n8n Workflow Generator</h1>
      <Textarea
        value={prompt}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
        placeholder="Describe your workflow..."
        rows={6}
        className="mb-2"
      />
      <div className="flex items-center gap-4">
        <Button onClick={handleGenerate} disabled={loading || !prompt.trim()}>
          {loading ? (
            <>
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              Generating...
            </>
          ) : (
            "Generate Workflow"
          )}
        </Button>
        {loading && (
          <span className="text-muted-foreground text-sm">This may take ~20 seconds...</span>
        )}
      </div>
      {error && (
        <div className="text-red-500 text-sm">{error.message}</div>
      )}
      {result && (
        <div className="mt-4">
          <div className="flex items-center mb-1 gap-2">
            <h2 className="font-semibold">Result</h2>
            {result.workflow && (
              <Button
                type="button"
                size="sm"
                className="px-2 py-1 h-7"
                onClick={handleCopy}
                title="Copy workflow JSON"
              >
                <Copy className="w-4 h-4 mr-1" />
                {copied ? "Copied!" : "Copy"}
              </Button>
            )}
          </div>
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;
