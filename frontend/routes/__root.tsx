import * as React from 'react'
import { Outlet, createRootRoute, Link } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <React.Fragment>
      <div className="p-2 flex gap-2">
        <Link to="/" className="[&.active]:font-bold">
          Home
        </Link>{' '}
        <Link to="/app" className="[&.active]:font-bold">
          App
        </Link>
      </div>

      <Outlet />

      <TanStackRouterDevtools />
    </React.Fragment>
  )
}
