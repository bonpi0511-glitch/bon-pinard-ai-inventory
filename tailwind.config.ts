import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        wineserif: ["var(--font-wine-serif)", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
