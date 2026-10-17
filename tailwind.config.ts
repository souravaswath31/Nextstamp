import type { Config } from "tailwindcss";

// The whole UI is dark (project owner's call). Surface and text colours are CSS variables
// defined once in globals.css, so a component says `bg-paper text-ink` and the palette lives
// in one place; `/60`-style opacity utilities still work through <alpha-value>.
//
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
        paper: "rgb(var(--c-paper) / <alpha-value>)",
        paperDark: "rgb(var(--c-paperDark) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        inkLight: "rgb(var(--c-inkLight) / <alpha-value>)",
        charcoal: "rgb(var(--c-ink) / <alpha-value>)",
        coral: "#FF5A5F",
        coralDark: "#E14448",
        stamp: "#F5A623",
        stampRed: "#E63946",
        forest: "#2FA84F",
        teal: "#06B6D4",
        line: "rgb(var(--c-line) / <alpha-value>)",
        // Marketing pages go dark (project owner's call, Phase A). The app
        // stays light. A cool near-black with a faint blue cast, so the coral
        // accent reads as warm against it rather than as a screen glow.
        night: "rgb(var(--c-night) / <alpha-value>)",
        nightRaised: "rgb(var(--c-paper) / <alpha-value>)",
        nightLift: "rgb(var(--c-paperDark) / <alpha-value>)",
        bone: "rgb(var(--c-ink) / <alpha-value>)",
        // Category colors — one distinct hue per itinerary category tag.
        catNature: "rgb(var(--c-catNature) / <alpha-value>)",
        catCity: "rgb(var(--c-catCity) / <alpha-value>)",
        catWater: "#06B6D4",
        catSplurge: "rgb(var(--c-catSplurge) / <alpha-value>)",
        catBudget: "#F5A623",
        catRoadTrip: "#FB7A3C",
        catBeaten: "rgb(var(--c-catBeaten) / <alpha-value>)",
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
        paper: "0 0 0 1px rgba(255, 255, 255, 0.06), 0 8px 24px -8px rgba(0, 0, 0, 0.5)",
        "paper-lg": "0 0 0 1px rgba(255, 255, 255, 0.08), 0 24px 48px -12px rgba(0, 0, 0, 0.6)",
      },
    },
  },
  plugins: [],
};
export default config;

