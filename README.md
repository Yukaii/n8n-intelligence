# n8n-intelligence

A workflow AI generator powered by modern web technologies.

## Project Structure

- **Main module:** `worker/index.ts`
- **Frontend:** React, Tailwind CSS (in `frontend/`)
- **Worker:** Cloudflare Worker (in `worker/`)
- **Scripts:** Utility scripts in `scripts/`

## Scripts

| Script      | Description                                                      |
| ----------- | ---------------------------------------------------------------- |
| build       | Build the project (`vite build && tsc -b`)                       |
| cf-typegen  | Generate Cloudflare types (`wrangler types`)                     |
| check       | Build, type-check, and dry-run deploy (`vite build && tsc && wrangler deploy --dry-run`) |
| deploy      | Build and deploy with Wrangler (`npm run build && wrangler deploy`) |
| dev         | Start Vite development server (`vite`)                           |
| preview     | Preview production build (`npm run build && vite preview`)       |
| fmt         | Format code with Biome (`biome format --write ./worker ./frontend`) |
| lint        | Lint code with Biome (`biome lint ./worker ./frontend`)          |
| lint:fix    | Lint and fix code with Biome (`biome lint ./worker ./frontend --write  --unsafe`) |


## Dependencies

- React, React DOM
- Hono (Cloudflare Worker framework)
- Tailwind CSS
- OpenAI
- @tanstack/react-router
- @radix-ui/react-dialog, @radix-ui/react-slot
- Additional utilities: clsx, swr, tailwind-merge, class-variance-authority, tw-animate-css

## Dev Dependencies

- Vite, @vitejs/plugin-react, @cloudflare/vite-plugin, @hono/vite-build, @tailwindcss/vite
- TypeScript, @types/react, @types/react-dom, @types/bun
- Wrangler, Biome

## License

This project is licensed under the [AGPL-3.0](./LICENSE).
