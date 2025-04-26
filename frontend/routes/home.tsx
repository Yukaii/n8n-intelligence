import { createFileRoute } from "@tanstack/react-router";
import LandingPage from "@/components/LandingPage";

export const Route = createFileRoute("/home")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <LandingPage />
    </>
  );
}
