import type { Config } from "tailwindcss";

// Design direction: Apple.com-style — one typeface carrying all the weight
// (huge, tight-tracked, bold sans for headlines; the same face at normal
// weight for body), generous whitespace, large soft-rounded surfaces, and
// neutral near-white/near-black canvases with a single vivid brand accent
// (coral) reserved for calls to action. Color still carries real product
// information (category tags, visa status) — it's just no longer also
// doing the job of decorating the background.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FBFBFD",
        paperDark: "#F5F5F7",
        ink: "#1D1D1F",
        inkLight: "#3A3A3C",
        charcoal: "#1D1D1F",
        coral: "#FF5A5F",
        coralDark: "#E14448",
        stamp: "#F5A623",
        stampRed: "#E63946",
        forest: "#2FA84F",
        teal: "#06B6D4",
        line: "#E5E5EA",
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
        display: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        body: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        stamp: ["var(--font-mono)", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.045em",
      },
      borderRadius: {
        card: "1rem",
        panel: "1.5rem",
        hero: "2rem",
      },
      boxShadow: {
        // Neutral, soft, diffuse — separation by elevation, not by border.
        paper: "0 1px 2px rgba(0, 0, 0, 0.03), 0 8px 24px -8px rgba(0, 0, 0, 0.08)",
        "paper-lg": "0 4px 12px rgba(0, 0, 0, 0.04), 0 24px 48px -12px rgba(0, 0, 0, 0.12)",
      },
    },
  },
  plugins: [],
};
export default config;

