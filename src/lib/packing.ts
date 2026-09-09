// A packing list generated from an itinerary's own category tags — no new
// per-destination research needed, so it applies instantly to all 16
// itineraries and 3 state guides (and everything added after). Packing was
// the #1 specific pain point travelers report after "planning" itself
// (Go City / Talker Research, 2024), so this earns its place.
//
// Grouped, not a flat list — "Documents & money" / "Clothing & gear" /
// "Health & comfort" — because that's how people actually check items off,
// and because a flat 25-item list is the thing that makes packing feel
// like a chore in the first place.

export type PackingSection = {
  title: string;
  items: string[];
};

const UNIVERSAL: PackingSection[] = [
  {
    title: "Documents & money",
    items: [
      "Passport (plus a photo of it saved on your phone, separate from the physical copy)",
      "Printed or saved copies of any visa/entry documents",
      "Phone charger and a universal power adapter if traveling internationally",
      "A backup payment method (a second card, not just cash)",
    ],
  },
  {
    title: "Health & comfort",
    items: [
      "Any personal medications, in original packaging, in your carry-on",
      "A small first-aid kit (bandages, pain reliever, antiseptic)",
      "Sunscreen and a reusable water bottle",
    ],
  },
];

const CATEGORY_SECTIONS: Record<string, PackingSection> = {
  nature: {
    title: "For the outdoors",
    items: [
      "Sturdy, broken-in hiking shoes or boots",
      "Moisture-wicking base layers, plus an insulated layer for cold mornings",
      "A packable waterproof rain shell",
      "A daypack for water, snacks, and layers",
      "Headlamp or flashlight",
      "Bug repellent and blister pads",
    ],
  },
  water: {
    title: "For the water",
    items: [
      "Swimwear (pack two — one is always damp)",
      "Reef-safe sunscreen — some marine parks require it",
      "A quick-dry towel",
      "Water shoes or sandals with grip",
      "A dry bag or waterproof phone pouch",
    ],
  },
  city: {
    title: "For the city",
    items: [
      "Comfortable walking shoes you've already broken in",
      "One outfit that works day-to-night, to cut down on options",
      "A light layer for cooler evenings",
      "A crossbody bag or day bag you can keep in front of you",
      "A portable power bank — city days drain phone batteries fast",
    ],
  },
  "road-trip": {
    title: "For the road",
    items: [
      "Offline maps downloaded before you lose signal",
      "A car phone mount and charger",
      "Snacks and a cooler for long stretches between towns",
      "A neck pillow and sunglasses",
      "Playlists or podcasts downloaded in advance",
    ],
  },
  splurge: {
    title: "For the nicer nights",
    items: [
      "One dressier outfit for a special dinner or event",
      "A small bag or accessory that isn't purely functional",
    ],
  },
  budget: {
    title: "For budget stays",
    items: [
      "A padlock, if any hostel stays are on the itinerary",
      "Earplugs and an eye mask for shared or noisy rooms",
      "A quick-dry travel towel (not always provided)",
    ],
  },
  "off-the-beaten-path": {
    title: "For off the beaten path",
    items: [
      "Offline maps — cell service is not a given",
      "A portable charger with real capacity, not a token one",
      "Extra of any medication you take, in case pharmacies are scarce",
      "Small-denomination local cash — card readers can be unreliable",
    ],
  },
};

export function generatePackingList(categories: string[]): PackingSection[] {
  const sections: PackingSection[] = [...UNIVERSAL];
  for (const cat of categories) {
    const section = CATEGORY_SECTIONS[cat];
    if (section && !sections.some((s) => s.title === section.title)) {
      sections.push(section);
    }
  }
  return sections;
}
