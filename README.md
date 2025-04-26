# n8n-intelligence

A workflow AI generator powered by modern web technologies.

## Project Structure

- **Main module:** `worker/index.ts`
- **Frontend:** React, Tailwind CSS (in `frontend/`)
- **Worker:** Cloudflare Worker (in `worker/`)
- **Scripts:** Utility scripts in `scripts/`

## Scripts

| Script         | Description                                 |
| -------------- | ------------------------------------------- |
| build          | Build the project (`vite build && tsc -b`)  |
| cf-typegen     | Generate Cloudflare types (`wrangler types`) |
| check          | Build, type-check, and dry-run deploy       |
| deploy         | Build and deploy with Wrangler              |
| dev            | Start Vite development server               |
| lint           | Lint code with ESLint                       |
| preview        | Preview production build                    |
| fmt            | Format code with Biome                      |

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
- Wrangler, Biome, ESLint

## License

This project is licensed under the [AGPL-3.0](./LICENSE).
