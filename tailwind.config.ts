import type { Config } from "tailwindcss";

// Design direction: still a travel notebook, not a generic booking-site
// template — but a colorful one. Bright warm-white canvas, a vivid coral
// brand/CTA color, and a distinct hue per itinerary category and visa
// status so color carries real information, not just decoration.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FDF9F0",
        paperDark: "#F5EDDD",
        ink: "#22283B",
        inkLight: "#3A4A6B",
        charcoal: "#242420",
        coral: "#FF5A5F",
        coralDark: "#E14448",
        stamp: "#F5A623",
        stampRed: "#E63946",
        forest: "#2FA84F",
        teal: "#06B6D4",
        line: "#E8DFC9",
        // Category colors — one distinct hue per itinerary category tag.
        catNature: "#2FA84F",
        catCity: "#3B82F6",
        catWater: "#06B6D4",
        catSplurge: "#D6336C",
        catBudget: "#F5A623",
        catRoadTrip: "#FB7A3C",
        catBeaten: "#8B5CF6",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
        stamp: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        card: "2px",
      },
      boxShadow: {
        // Warm-toned, soft — a lifted card, not a generic gray drop shadow.
        paper: "0 1px 2px rgba(34, 40, 59, 0.04), 0 6px 16px -4px rgba(34, 40, 59, 0.08)",
        "paper-lg": "0 4px 8px rgba(34, 40, 59, 0.05), 0 16px 32px -8px rgba(34, 40, 59, 0.12)",
      },
    },
  },
  plugins: [],
};
export default config;

