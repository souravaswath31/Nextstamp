export default function Loading() {
  return (
    <div className="animate-pulse space-y-10">
      <div className="space-y-3 text-center sm:text-left">
        <div className="mx-auto h-3 w-24 rounded-full bg-paperDark sm:mx-0" />
        <div className="mx-auto h-14 w-56 rounded-card bg-paperDark sm:mx-0" />
      </div>
      <div className="h-14 rounded-panel bg-paperDark" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-panel bg-paper shadow-paper" />
        ))}
      </div>
    </div>
  );
}
