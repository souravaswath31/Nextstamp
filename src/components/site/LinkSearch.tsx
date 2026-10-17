import type { ReactNode } from "react";
import { SECTION } from "./MarketingBits";

export type Field = { name: string; label: string; type?: "text" | "date"; placeholder?: string; required?: boolean };

const INPUT =
  "w-full rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 font-body text-sm text-white placeholder:text-white/35 focus:border-coral focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/50";

/** A plain GET form: the results are a shareable URL and work without JavaScript. */
export default function LinkSearch({
  idPrefix,
  fields,
  values,
  button,
  children,
}: {
  idPrefix: string;
  fields: Field[];
  values: Record<string, string>;
  button: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-t border-white/10 bg-nightRaised/40">
      <div className={`${SECTION} py-10`}>
        <form method="get" className="grid max-w-3xl gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.name} className="space-y-1">
              <label htmlFor={`${idPrefix}-${f.name}`} className="font-body text-sm text-white/70">
                {f.label}
              </label>
              <input
                id={`${idPrefix}-${f.name}`}
                name={f.name}
                type={f.type ?? "text"}
                required={f.required}
                maxLength={80}
                defaultValue={values[f.name] ?? ""}
                placeholder={f.placeholder}
                className={INPUT}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <button type="submit" className="btn-pill btn-pill-accent">
              {button}
            </button>
          </div>
        </form>
        {children && <div className="mt-8 max-w-3xl">{children}</div>}
      </div>
    </section>
  );
}
