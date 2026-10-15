/**
 * The public base URL, read from one place so moving to a real domain is an env
 * change and not a code search. Used for canonical URLs, Open Graph, JSON-LD,
 * the sitemap and robots.txt.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextstamp-app.vercel.app").replace(/\/+$/, "");
