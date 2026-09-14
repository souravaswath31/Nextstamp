export default function Loading() {
  return (
    <div className="animate-pulse space-y-10">
      <div className="h-4 w-24 rounded-full bg-paperDark" />
      <div className="h-64 rounded-hero bg-paperDark" />
      <div className="space-y-3 text-center sm:text-left">
        <div className="mx-auto h-3 w-24 rounded-full bg-paperDark sm:mx-0" />
        <div className="mx-auto h-12 w-64 rounded-card bg-paperDark sm:mx-0" />
        <div className="mx-auto h-5 w-full max-w-md rounded-card bg-paperDark sm:mx-0" />
      </div>
      <div className="h-40 rounded-panel bg-paperDark" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-panel bg-paper shadow-paper" />
        ))}
      </div>
    </div>
  );
}
