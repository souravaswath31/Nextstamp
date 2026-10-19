// The one place the contact route is decided. Set NEXT_PUBLIC_SUPPORT_EMAIL to a monitored address
// before launch; until then pages fall back to the project's GitHub page rather than inventing one.
export const SUPPORT_EMAIL: string | null = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || null;
export const GITHUB_URL = "https://github.com/souravaswath31/Nextstamp";
