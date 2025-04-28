import type { Config } from 'tailwindcss'

const config = {
  content: ['./frontend/**/*.{ts,tsx}', './frontend/components/**/*.{ts,tsx}'],
  plugins: [
    require('@tailwindcss/aspect-ratio'),
  ],
} satisfies Config

export default config