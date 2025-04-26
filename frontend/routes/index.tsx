import { createFileRoute } from "@tanstack/react-router";
import LandingPage from "@/components/LandingPage";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate({ to: "/app" });
    }
  }, [isLoaded, isSignedIn, navigate]);

  if (isSignedIn) {
    return null;
  }

  return (
    <>
      <LandingPage />
    </>
  );
}
