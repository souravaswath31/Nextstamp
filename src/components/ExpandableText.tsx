"use client";

import { useState } from "react";
import { splitSummary } from "@/lib/shorten";

/** A paragraph that shows its lead and keeps the full wording behind "Show details". */
export default function ExpandableText({
  text,
  max = 240,
  className,
  suffix,
}: {
  text: string;
  max?: number;
  className?: string;
  /** Short text always shown after the lead or the full text, e.g. " Max stay: 30 days." */
  suffix?: string;
}) {
  const { short, rest } = splitSummary(text, max);
  const [open, setOpen] = useState(false);
  return (
    <p className={className}>
      {short}
      {rest && open ? ` ${rest}` : ""}
      {suffix ?? ""}
      {rest && (
        <>
          {" "}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="font-semibold text-coral underline-offset-2 hover:underline"
          >
            {open ? "Show less" : "Show details"}
          </button>
        </>
      )}
    </p>
  );
}
