import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import {
  RouterProvider,
  createRouter,
  createHashHistory,
} from "@tanstack/react-router";
import { ClerkProvider } from "@clerk/clerk-react";
import { PostHogProvider } from "posthog-js/react";

import { routeTree } from "./routeTree.gen";

import "./index.css";

const history = createHashHistory();

const router = createRouter({ routeTree, history });
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

const posthogOptions = {
  api_host: import.meta.env.VITE_POSTHOG_HOST,
};

// biome-ignore lint/style/noNonNullAssertion: <explanation>
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <PostHogProvider
        apiKey={import.meta.env.VITE_POSTHOG_KEY}
        options={posthogOptions}
      >
        <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
          <RouterProvider router={router} />
        </ClerkProvider>
      </PostHogProvider>
    </StrictMode>,
  );
}
