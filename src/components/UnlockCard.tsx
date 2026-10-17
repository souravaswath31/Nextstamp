import Link from "next/link";
import { Lock } from "lucide-react";
import { FEATURES, PRICE_LABEL, type FeatureKey } from "@/lib/entitlement";

/**
 * Shown where a paid feature would be. Only ever rendered when payment is
 * configured and the user hasn't got access, so it never advertises a purchase
 * nobody can make.
 */
export default function UnlockCard({ feature, children }: { feature: FeatureKey; children?: React.ReactNode }) {
  return (
    <div className="rounded-panel border border-coral/30 bg-paper px-5 py-5 shadow-paper">
      <p className="flex items-center gap-2 font-body text-sm font-semibold text-ink">
        <Lock size={14} className="text-coral" aria-hidden="true" /> {FEATURES[feature]} is part of full access
      </p>
      {children && <div className="mt-1 font-body text-sm text-ink/60">{children}</div>}
      <Link href={`/pricing?unlock=${feature}`} className="btn-pill btn-pill-accent mt-4 !px-5 !py-2 !text-sm">
        Unlock for {PRICE_LABEL}, once
      </Link>
    </div>
  );
}
