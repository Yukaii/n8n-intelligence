import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Copy, Settings } from "lucide-react";

type WorkflowResult = {
  workflow?: Record<string, unknown>;
  keywords?: string[];
  searchResults?: unknown[];
  nodes?: unknown[];
  [key: string]: unknown;
};

function parseSSEMessage(chunk: string): { event: string; data: unknown } | null {
  const lines = chunk.split("\n").filter((line) => line.trim() !== "");
  let event = "message"; // Default event type
  let data = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.substring(6).trim();
    } else if (line.startsWith("data:")) {
      data += line.substring(5).trim(); // Accumulate data if split across lines (though unlikely here)
    }
    // Ignore id: lines for now
  }

  if (data) {
    try {
      return { event, data: JSON.parse(data) };
    } catch (e) {
      console.error("Failed to parse SSE data:", data, e);
      return {
        event: "error",
        data: { error: "Failed to parse server event data" },
      }; // Treat parse failure as an error event
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

  // Quota with SWR
  const quotaFetcher = async (url: string) => {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to fetch quota: ${res.statusText}`);
    return res.json();
  };
  const quotaApiUrl = serverUrl
    ? `${serverUrl.replace(/\/$/, "")}/quota`
    : "/quota";
  const {
    data: quota,
    error: quotaError,
    isLoading: quotaLoading,
  } = useSWR(
    quotaApiUrl,
    quotaFetcher,
    { refreshInterval: 60000 }, // refresh every 60s
  );

  const [isLoading, setIsLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<WorkflowResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null); // To abort fetch if needed
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1); // -1: not started, 0: step 1 done, etc.

  // Define the steps in order
  const generationSteps = [
    "extract_keywords",
    "search_nodes",
    "fetch_nodes",
    "parse_nodes",
    "generate_workflow",
  ];

  // Step icons and labels for visual representation
  const stepLabels = [
    { icon: "🔍", label: "Extract Keywords" },
    { icon: "🔎", label: "Search Nodes" },
    { icon: "📦", label: "Fetch Nodes" },
    { icon: "🧩", label: "Parse Nodes" },
    { icon: "✨", label: "Generate Workflow" },
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

    const apiUrl = serverUrl
      ? `${serverUrl.replace(/\/$/, "")}/generate-workflow`
      : "/generate-workflow";

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ prompt }),
        signal, // Pass the abort signal
      });

      if (!response.ok) {
        // Handle 403 Forbidden specifically
        if (response.status === 403) {
          setError(
            "You do not have permission to access this resource (403 Forbidden).",
          );
          setIsLoading(false);
          setProgressMessage(null);
          return;
        }
        // Try to parse error from body if possible, otherwise use status text
        let errorMsg = `Request failed: ${response.statusText}`;
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
        } catch (e) {
          /* Ignore parsing error */
        }
        throw new Error(errorMsg);
      }

      if (
        !response.body ||
        !response.headers.get("content-type")?.includes("text/event-stream")
      ) {
        throw new Error(
          "Expected Server-Sent Events stream, but received different response.",
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
        const messages = buffer.split("\n\n"); // SSE messages are separated by double newlines

        // Process all complete messages except the last partial one
        for (let i = 0; i < messages.length - 1; i++) {
          const message = messages[i];
          if (message.trim()) {
            const parsed = parseSSEMessage(message);
            if (parsed) {
              if (parsed.event === "progress") {
                // Type guard for progress event
                const data = parsed.data as { step?: string; status?: string; message?: string };
                const { step, status, message: progressMsg } = data;
                setProgressMessage(progressMsg || (step ? `Processing step: ${step}...` : "Processing..."));
                // Update step index when a step is completed
                if (step && status === "completed") {
                  const stepIndex = generationSteps.indexOf(step);
                  if (stepIndex > currentStepIndex) {
                    // Ensure we only move forward
                    setCurrentStepIndex(stepIndex);
                  }
                }
              } else if (parsed.event === "result") {
                setFinalResult(parsed.data as WorkflowResult);
                setProgressMessage("Workflow generated successfully!");
                setCurrentStepIndex(generationSteps.length); // Mark all steps as done
                setIsLoading(false); // Set loading false on final result
              } else if (parsed.event === "error") {
                // Type guard for error event
                const data = parsed.data as { error?: string };
                setError(
                  data.error ||
                    "An unknown error occurred during generation.",
                );
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
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("Fetch aborted");
        setError("Request cancelled.");
      } else {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred",
        );
      }
      setProgressMessage(null);
    } finally {
      // Ensure loading is set to false if it hasn't been already (e.g., stream ended abruptly)
      if (isLoading) {
        // Check isLoading again in case it was set false by 'result' or 'error'
        setIsLoading(false);
      }
      abortControllerRef.current = null; // Clear the ref
    }
  };

  const handleCopy = async () => {
    // Use finalResult now
    if (finalResult?.workflow) {
      await navigator.clipboard.writeText(
        JSON.stringify(finalResult.workflow, null, 2),
      );
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">
            <span className="text-blue-600 dark:text-blue-400">n8n</span>{" "}
            Workflow
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600">
              {" "}
              AI Generator
            </span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Generate powerful n8n workflows using natural language. Tell AI what
            you want to automate.
          </p>
        </div>

        {/* Main Interface Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Card Header with Settings */}
          <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <div className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                Workflow Generator
              </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="p-2"
                  aria-label="Settings"
                >
                  <Settings className="h-5 w-5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">
                    Server URL Settings
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Input
                    value={serverUrlInput}
                    onChange={(e) => setServerUrlInput(e.target.value)}
                    placeholder="e.g. https://api.example.com"
                    className="w-full"
                  />
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Leave blank to use the default server.
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleSaveServerUrl}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                  >
                    Save Settings
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Prompt Input Section */}
          <div className="p-6 space-y-6">
            {/* Example Prompts */}
            <div>
              {/* Example prompts array */}
              {(() => {
                const examples = [
                  "Create a workflow to send weekly reports from Google Sheets to Slack",
                  "Monitor a Gmail inbox and save attachments to Dropbox",
                  "Post a daily summary of new GitHub issues to Microsoft Teams",
                  "Sync new Airtable records to a Notion database",
                  "Send an SMS via Twilio when a Stripe payment is received",
                  "Backup files from Google Drive to AWS S3 every Friday",
                  "Alert me on Telegram when a website is down",
                  "Extract data from incoming emails and add to Google Sheets"
                ];
                return (
                  <div className="mb-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Example prompts:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {examples.map((ex) => (
                        <button
                          key={ex}
                          type="button"
                          onClick={() => setPrompt(ex)}
                          className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs hover:bg-blue-100 dark:hover:bg-blue-800 border border-blue-100 dark:border-blue-800 transition"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <label
                htmlFor="prompt"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Describe your workflow in natural language
              </label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setPrompt(e.target.value)
                }
                placeholder="E.g., Create a workflow to send weekly reports from Google Sheets to Slack"
                rows={6}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200"
              />
            </div>

            {/* Quota Info */}
            <div className="mb-2">
              {quotaLoading ? (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Loading quota...
                </span>
              ) : quotaError ? (
                <span className="text-sm text-red-500 dark:text-red-400">
                  {quotaError.message || String(quotaError)}
                </span>
              ) : quota ? (
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Quota left:{" "}
                  <span className="font-semibold">{quota.remaining}</span>
                  {" | "}
                  Resets:{" "}
                  <span>
                    {new Date(quota.reset).toLocaleString(undefined, {
                      hour12: false,
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              ) : null}
            </div>

            {/* Generate Button and Progress Message */}
            <div className="flex items-center gap-4 flex-wrap">
              <Button
                onClick={handleGenerate}
                disabled={
                  isLoading || !prompt.trim() || (quota && quota.remaining <= 0)
                }
                size="lg"
                className={`bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium transition-all duration-300 ${isLoading ? "opacity-90" : ""}`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-5 w-5" />
                    Generating...
                  </>
                ) : (
                  "Generate Workflow"
                )}
              </Button>

              {/* Progress Message */}
              {isLoading && progressMessage && (
                <span className="text-gray-600 dark:text-gray-300 text-sm animate-pulse">
                  {progressMessage}
                </span>
              )}
            </div>

            {/* Step Indicators */}
            {isLoading && (
              <div className="my-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Generation Progress
                  </span>
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {Math.round(
                      ((currentStepIndex + 1) / generationSteps.length) * 100,
                    )}
                    %
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700 mb-4">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${((currentStepIndex + 1) / generationSteps.length) * 100}%`,
                    }}
                  />
                </div>

                {/* Step Pills */}
                <div className="flex justify-between flex-wrap gap-2">
                  {stepLabels.map((step, index) => (
                    <div
                      key={step.label}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200
                        ${
                          index <= currentStepIndex
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                    >
                      <span>{step.icon}</span>
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && !isLoading && (
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Results Section */}
            {finalResult && !isLoading && (
              <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Generated Workflow
                  </h2>

                  {finalResult.workflow && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopy}
                      className="flex items-center gap-1 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900"
                    >
                      <Copy className="w-4 h-4" />
                      <span>{copied ? "Copied!" : "Copy JSON"}</span>
                    </Button>
                  )}
                </div>

                {/* Results Card */}
                <div className="overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-2 p-3 bg-gray-200 dark:bg-gray-800">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      workflow.json
                    </div>
                  </div>
                  <pre className="p-4 overflow-x-auto text-sm text-gray-800 dark:text-gray-200">
                    {JSON.stringify(finalResult?.workflow || {}, null, 2)}
                  </pre>
                </div>

                {/* Success Message */}
                <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm">
                  ✓ Workflow generated successfully! You can now copy the JSON
                  and import it into your n8n instance.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Tips Section */}
        {!finalResult && !isLoading && !error && (
          <div className="mt-8 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quick Tips for Better Results
            </h3>
            <ul className="space-y-2 text-gray-600 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 dark:text-blue-400">•</span>
                <span>
                  Be specific about which services to connect (e.g., Gmail,
                  Slack, Google Sheets)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 dark:text-blue-400">•</span>
                <span>
                  Describe the trigger conditions and frequency (e.g., "when new
                  email arrives", "every Monday")
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 dark:text-blue-400">•</span>
                <span>
                  Mention specific data transformations or conditions (e.g.,
                  "only if subject contains", "format as table")
                </span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
