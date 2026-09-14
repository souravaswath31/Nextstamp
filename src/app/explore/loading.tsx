export default function Loading() {
  return (
    <div className="animate-pulse space-y-10">
      <div className="space-y-3 text-center sm:text-left">
        <div className="mx-auto h-3 w-20 rounded-full bg-paperDark sm:mx-0" />
        <div className="mx-auto h-12 w-80 rounded-card bg-paperDark sm:mx-0" />
      </div>
      <div className="h-32 rounded-panel bg-paperDark" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-panel bg-paper p-5 shadow-paper">
            <div className="h-11 w-11 rounded-2xl bg-paperDark" />
            <div className="h-5 w-3/4 rounded-card bg-paperDark" />
            <div className="h-4 w-1/2 rounded-card bg-paperDark" />
          </div>
        ))}
      </div>
    </div>
  );
}
