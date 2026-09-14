import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="stamp-mark flex h-16 w-16 items-center justify-center border-stampRed text-stampRed">
        <Compass size={26} />
      </span>
      <p className="mt-5 font-stamp text-xs uppercase tracking-widest text-ink/45">404</p>
      <h1 className="mt-1 font-display text-4xl tracking-tightest text-ink">Off the map</h1>
      <p className="mt-3 max-w-sm font-body text-sm text-ink/55">
        Whatever you were looking for isn&apos;t here — it may have moved, or never existed.
      </p>
      <Link href="/" className="btn-pill btn-pill-primary mt-6">
        Back to NextStamp
      </Link>
    </div>
  );
}
