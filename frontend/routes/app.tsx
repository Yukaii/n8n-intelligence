import { createFileRoute } from "@tanstack/react-router";
import App from "../components/App";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";

export const Route = createFileRoute("/app")({
  component: RouteComponent,
});


function RouteComponent() {
  return (
    <>
      <SignedIn>
        <App />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
