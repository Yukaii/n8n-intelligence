import type { Config } from 'tailwindcss'

const config = {
  content: ['./frontend/**/*.{ts,tsx}', './frontend/components/**/*.{ts,tsx}']
} satisfies Config

export default config