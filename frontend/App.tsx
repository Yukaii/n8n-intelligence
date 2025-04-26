import { useState, useEffect, useRef } from "react";
// Removed useSWRMutation import
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Copy, Settings } from "lucide-react";

type WorkflowResult = {
  // workflow?: unknown; // Removed duplicate
  workflow?: any; // More specific type if known, otherwise any
  keywords?: string[];
  searchResults?: any[];
  nodes?: any[]; // This might be the full or trimmed nodes depending on backend
  [key: string]: unknown; // Keep for flexibility
};

// Removed the old generateWorkflow function

// Helper to parse SSE messages
function parseSSEMessage(chunk: string): { event: string; data: any } | null {
  const lines = chunk.split('\n').filter(line => line.trim() !== '');
  let event = 'message'; // Default event type
  let data = '';

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.substring(6).trim();
    } else if (line.startsWith('data:')) {
      data += line.substring(5).trim(); // Accumulate data if split across lines (though unlikely here)
    }
    // Ignore id: lines for now
  }

  if (data) {
    try {
      return { event, data: JSON.parse(data) };
    } catch (e) {
      console.error("Failed to parse SSE data:", data, e);
      return { event: 'error', data: { error: 'Failed to parse server event data' } }; // Treat parse failure as an error event
    }
  }
  return null;
}


function App() {
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState("");
  const [serverUrlInput, setServerUrlInput] = useState("");

  // New state for SSE handling
  const [isLoading, setIsLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<WorkflowResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null); // To abort fetch if needed
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1); // -1: not started, 0: step 1 done, etc.

  // Define the steps in order
  const generationSteps = [
    'extract_keywords',
    'search_nodes',
    'fetch_nodes',
    'parse_nodes',
    'generate_workflow'
  ];

  useEffect(() => {
    const stored = localStorage.getItem("serverUrl") || "";
    setServerUrl(stored);
    setServerUrlInput(stored);

    // Cleanup fetch on component unmount
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Removed useSWRMutation hook

  const handleGenerate = async () => {
    // Abort previous request if any
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    setFinalResult(null);
    setError(null);
    setProgressMessage("Initiating workflow generation...");
    setCurrentStepIndex(-1); // Reset step index
    setCopied(false);

    const apiUrl = serverUrl ? `${serverUrl.replace(/\/$/, "")}/generate-workflow` : "/generate-workflow";

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({ prompt }),
        signal, // Pass the abort signal
      });

      if (!response.ok) {
        // Try to parse error from body if possible, otherwise use status text
        let errorMsg = `Request failed: ${response.statusText}`;
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
        } catch (e) { /* Ignore parsing error */ }
        throw new Error(errorMsg);
      }

      if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
        throw new Error("Expected Server-Sent Events stream, but received different response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Check if loading is still true, meaning no 'result' or 'error' event was received before stream ended
          if (isLoading) {
             setProgressMessage("Stream ended without final result.");
             // Consider setting an error or leaving as is depending on desired UX
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split('\n\n'); // SSE messages are separated by double newlines

        // Process all complete messages except the last partial one
        for (let i = 0; i < messages.length - 1; i++) {
          const message = messages[i];
          if (message.trim()) {
            const parsed = parseSSEMessage(message);
            if (parsed) {
              if (parsed.event === 'progress') {
                const { step, status, message } = parsed.data;
                setProgressMessage(message || `Processing step: ${step}...`);
                // Update step index when a step is completed
                if (status === 'completed') {
                  const stepIndex = generationSteps.indexOf(step);
                  if (stepIndex > currentStepIndex) { // Ensure we only move forward
                    setCurrentStepIndex(stepIndex);
                  }
                }
              } else if (parsed.event === 'result') {
                setFinalResult(parsed.data);
                setProgressMessage("Workflow generated successfully!");
                setCurrentStepIndex(generationSteps.length); // Mark all steps as done
                setIsLoading(false); // Set loading false on final result
              } else if (parsed.event === 'error') {
                setError(parsed.data.error || 'An unknown error occurred during generation.');
                setProgressMessage(null); // Clear progress on error
                setCurrentStepIndex(-1); // Reset steps on error
                setIsLoading(false); // Set loading false on error
                reader.cancel(); // Stop reading further
                return; // Exit the loop
              }
            }
          }
        }
        // Keep the last partial message in the buffer
        buffer = messages[messages.length - 1];
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Fetch aborted');
        setError('Request cancelled.');
      } else {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      }
      setProgressMessage(null);
    } finally {
      // Ensure loading is set to false if it hasn't been already (e.g., stream ended abruptly)
      if (isLoading) { // Check isLoading again in case it was set false by 'result' or 'error'
         setIsLoading(false);
      }
      abortControllerRef.current = null; // Clear the ref
    }
  };


  const handleCopy = async () => {
    // Use finalResult now
    if (finalResult && finalResult.workflow) {
      await navigator.clipboard.writeText(JSON.stringify(finalResult.workflow, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleSaveServerUrl = () => {
    setServerUrl(serverUrlInput);
    localStorage.setItem("serverUrl", serverUrlInput);
    setDialogOpen(false);
  };

  return (
    <div className="max-w-xl mx-auto mt-16 p-6 border rounded-lg shadow space-y-6">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold">n8n Workflow Generator</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="icon" aria-label="Settings">
              <Settings />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Server URL Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Input
                value={serverUrlInput}
                onChange={e => setServerUrlInput(e.target.value)}
                placeholder="e.g. https://api.example.com"
                className="w-full"
              />
              <div className="text-xs text-muted-foreground">
                Leave blank to use the default server.
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSaveServerUrl}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Textarea
        value={prompt}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
        placeholder="Describe your workflow..."
        rows={6}
        className="mb-2"
      />
      <div className="flex items-center gap-4">
        {/* Use isLoading state */}
        <Button onClick={handleGenerate} disabled={isLoading || !prompt.trim()}>
          {isLoading ? (
            <>
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              Generating...
            </>
          ) : (
            "Generate Workflow"
          )}
        </Button>
        {/* Display progress message */}
        {isLoading && progressMessage && (
          <span className="text-muted-foreground text-sm">{progressMessage}</span>
        )}
      </div>

      {/* Progress Bar */}
      {isLoading && (
        <div className="w-full bg-muted rounded-full h-2.5 dark:bg-gray-700 my-3">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${((currentStepIndex + 1) / generationSteps.length) * 100}%` }}
           ></div>
           {/* Optional: Add step labels below */}
           {/* <div className="flex justify-between text-xs text-muted-foreground mt-1">
             {generationSteps.map((step, index) => (
               <span key={step} className={index <= currentStepIndex ? 'font-semibold' : ''}>
                 {step.replace('_', ' ')}
               </span>
             ))}
           </div> */}
        </div>
      )}

      {/* Display error state */}
      {error && !isLoading && (
        <div className="text-red-500 text-sm mt-2">{error}</div>
      )}
      {/* Display finalResult state */}
      {finalResult && !isLoading && (
        <div className="mt-4">
          <div className="flex items-center mb-1 gap-2">
            <h2 className="font-semibold">Result</h2>
            {/* Use finalResult for copy button */}
            {finalResult.workflow ? (
              <Button
                size="sm"
                className="px-2 py-1 h-7"
                onClick={handleCopy}
                title="Copy workflow JSON"
              >
                <Copy className="w-4 h-4 mr-1" />
                {copied ? "Copied!" : "Copy"}
              </Button>
            ) : null}
          </div>
          {/* Display finalResult workflow */}
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
            {JSON.stringify(finalResult?.workflow || {}, null, 2)}
          </pre>
          {/* Optionally display other parts of finalResult like keywords for debugging */}
          {/* <details className="mt-2 text-xs">
            <summary>Debug Info</summary>
            <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
              {JSON.stringify({ keywords: finalResult.keywords, nodes_returned: finalResult.nodes?.length }, null, 2)}
            </pre>
          </details> */}
        </div>
      )}
    </div>
  );
}

export default App;
