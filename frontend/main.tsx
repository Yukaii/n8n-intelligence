import { StrictMode } from "react";
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter, createHashHistory } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

import "./index.css";

const history = createHashHistory()

const router = createRouter({ routeTree, history })
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}


// biome-ignore lint/style/noNonNullAssertion: <explanation>
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}