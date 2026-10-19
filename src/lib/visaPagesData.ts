import { unstable_cache } from "next/cache";
import { getPublicRules } from "./siteData";

/** All rules, cached for an hour: the visa pages need the whole set to link to each other, and it only changes when data is loaded. */
export const getCachedRules = unstable_cache(getPublicRules, ["visa-pages-rules"], { revalidate: 3600 });
