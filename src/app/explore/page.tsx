import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { getVisaStatusForUser } from "@/lib/visa";
import ItineraryCard from "@/components/ItineraryCard";
import Filters from "@/components/Filters";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const user = await getCurrentUser();
  const all = await prisma.itinerary.findMany({ orderBy: { createdAt: "asc" } });
  const regions = Array.from(new Set(all.map((i) => i.region))).sort();

  const categoryFilter = searchParams.category?.split(",").filter(Boolean) ?? [];
  const regionFilter = searchParams.region ?? "";
  const costFilter = searchParams.cost ?? "";
  const visaFilter = searchParams.visa ?? "";
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  let filtered = all.filter((it) => {
    if (categoryFilter.length > 0) {
      const cats = it.category.split(",");
      if (!categoryFilter.some((c) => cats.includes(c))) return false;
    }
    if (regionFilter && it.region !== regionFilter) return false;
    if (costFilter && it.costTier !== costFilter) return false;
    return true;
  });

  if (visaFilter) {
    const withEase = await Promise.all(
      filtered.map(async (it) => {
        const countries = it.countries.split(",").filter(Boolean);
        const statuses = await Promise.all(
          countries.map((c) => getVisaStatusForUser(user, c))
        );
        const easy = statuses.every((s) =>
          ["resident", "visa-free", "visa-on-arrival"].includes(s.status)
        );
        return { it, easy };
      })
    );
    filtered = withEase
      .filter((x) => (visaFilter === "easy" ? x.easy : !x.easy))
      .map((x) => x.it);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-10">
      <div className="text-center sm:text-left">
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/45">Library</p>
        <h1 className="mt-2 font-display text-5xl tracking-tightest text-ink sm:text-6xl">Explore itineraries</h1>
      </div>

      <Filters regions={regions} />

      <p className="font-body text-sm text-ink/55">
        {filtered.length} itinerar{filtered.length === 1 ? "y" : "ies"}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {pageItems.map((it) => (
          <ItineraryCard
            key={it.id}
            id={it.id}
            title={it.title}
            region={it.region}
            countries={it.countries}
            category={it.category}
            durationDaysMin={it.durationDaysMin}
            durationDaysMax={it.durationDaysMax}
            costTier={it.costTier}
            bestTimeMonths={it.bestTimeMonths}
          />
        ))}
      </div>

      {pageItems.length === 0 && (
        <p className="font-body text-sm text-ink/55">
          Nothing matches those filters yet — try loosening one.
        </p>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-5 pt-4 font-body text-sm text-ink/70">
          <PageLink searchParams={searchParams} page={page - 1} disabled={page <= 1}>
            ← Prev
          </PageLink>
          <span>
            Page {page} of {totalPages}
          </span>
          <PageLink searchParams={searchParams} page={page + 1} disabled={page >= totalPages}>
            Next →
          </PageLink>
        </div>
      )}
    </div>
  );
}

function PageLink({
  searchParams,
  page,
  disabled,
  children,
}: {
  searchParams: { [key: string]: string | undefined };
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="text-ink/30">{children}</span>;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") params.set(key, value);
  }
  params.set("page", String(page));
  return (
    <Link href={`/explore?${params.toString()}`} className="text-ink underline hover:text-inkLight">
      {children}
    </Link>
  );
}
