import * as React from "react";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Header } from "../components/Header";


export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <React.Fragment>
      <Header />

      <main className="min-h-[calc(100vh-4rem)]">
        <Outlet />
      </main>

      <TanStackRouterDevtools />
    </React.Fragment>
  );
}
