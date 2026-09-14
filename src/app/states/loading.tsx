export default function Loading() {
  return (
    <div className="animate-pulse space-y-10">
      <div className="space-y-3 text-center sm:text-left">
        <div className="mx-auto h-3 w-32 rounded-full bg-paperDark sm:mx-0" />
        <div className="mx-auto h-12 w-72 rounded-card bg-paperDark sm:mx-0" />
      </div>
      <div className="h-14 rounded-panel bg-paperDark" />
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-panel bg-paper shadow-paper">
            <div className="h-48 bg-paperDark sm:h-64" />
            <div className="space-y-2 p-5">
              <div className="h-5 w-2/3 rounded-card bg-paperDark" />
              <div className="h-4 w-full rounded-card bg-paperDark" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
