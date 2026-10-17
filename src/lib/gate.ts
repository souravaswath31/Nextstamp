import { redirect } from "next/navigation";
import type { FeatureKey } from "./entitlement";

/**
 * For server actions on a paid feature: send a user without access to the pricing
 * page, which explains what they were trying to do. Redirecting (rather than
 * throwing) means a stray click lands somewhere useful, not on an error screen.
 * `fullAccess` is always true while payment is unconfigured.
 */
export function requireFullAccess(user: { fullAccess: boolean }, feature: FeatureKey): void {
  if (!user.fullAccess) redirect(`/pricing?unlock=${feature}`);
}
