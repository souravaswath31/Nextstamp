export type TripDay = {
  dayNumber: number;
  title: string;
  activities: string[];
  driveTime?: string | null;
  lodgingSuggestion?: string | null;
  coffeeWifiSpot?: string | null;
};

export type TripStatus = "idea" | "planning" | "booked" | "completed";

export const TRIP_STATUSES: TripStatus[] = ["idea", "planning", "booked", "completed"];

export const CATEGORY_LABELS: Record<string, string> = {
  nature: "Nature",
  city: "City",
  water: "Water / Island",
  splurge: "Splurge",
  budget: "Budget-conscious",
  "road-trip": "Road Trip",
  "off-the-beaten-path": "Off the beaten path",
};

// One distinct color per category — background + text Tailwind classes,
// paired so each chip reads clearly against the light canvas.
export const CATEGORY_COLOR_CLASSES: Record<string, string> = {
  nature: "bg-catNature/15 text-catNature",
  city: "bg-catCity/15 text-catCity",
  water: "bg-catWater/15 text-catWater",
  splurge: "bg-catSplurge/15 text-catSplurge",
  budget: "bg-catBudget/15 text-catBudget",
  "road-trip": "bg-catRoadTrip/15 text-catRoadTrip",
  "off-the-beaten-path": "bg-catBeaten/15 text-catBeaten",
};

// Same colors as top-border classes for card accents. Kept as literal,
// explicit strings (not built via string replace) so Tailwind's static
// scanner can actually find and generate them.
export const CATEGORY_BORDER_CLASSES: Record<string, string> = {
  nature: "border-t-catNature",
  city: "border-t-catCity",
  water: "border-t-catWater",
  splurge: "border-t-catSplurge",
  budget: "border-t-catBudget",
  "road-trip": "border-t-catRoadTrip",
  "off-the-beaten-path": "border-t-catBeaten",
};

// Filled (active) state for the same categories — used by filter toggles.
export const CATEGORY_FILLED_CLASSES: Record<string, string> = {
  nature: "bg-catNature border-catNature text-white",
  city: "bg-catCity border-catCity text-white",
  water: "bg-catWater border-catWater text-white",
  splurge: "bg-catSplurge border-catSplurge text-white",
  budget: "bg-catBudget border-catBudget text-white",
  "road-trip": "bg-catRoadTrip border-catRoadTrip text-white",
  "off-the-beaten-path": "bg-catBeaten border-catBeaten text-white",
};

// Shared visa-status color system — one source of truth used by both the
// VisaBadge stamp and the profile page's cascade-explorer cards, so the
// same status always reads the same color everywhere in the app.
export const VISA_STATUS_CLASSES: Record<string, string> = {
  resident: "bg-ink/10 text-ink border-ink",
  "visa-free": "bg-forest/10 text-forest border-forest",
  "visa-on-arrival": "bg-teal/10 text-teal border-teal",
  "e-visa": "bg-stamp/10 text-stamp border-stamp",
  "advance-visa-required": "bg-stampRed/10 text-stampRed border-stampRed",
  unknown: "bg-charcoal/5 text-charcoal/50 border-charcoal/30",
};

export const VISA_STATUS_BORDER_CLASSES: Record<string, string> = {
  resident: "border-l-ink bg-ink/5",
  "visa-free": "border-l-forest bg-forest/5",
  "visa-on-arrival": "border-l-teal bg-teal/5",
  "e-visa": "border-l-stamp bg-stamp/5",
  "advance-visa-required": "border-l-stampRed bg-stampRed/5",
  unknown: "border-l-charcoal/30 bg-charcoal/5",
};

export const VISA_STATUS_TEXT_CLASSES: Record<string, string> = {
  resident: "text-ink",
  "visa-free": "text-forest",
  "visa-on-arrival": "text-teal",
  "e-visa": "text-stamp",
  "advance-visa-required": "text-stampRed",
  unknown: "text-charcoal/50",
};



