export default function Loading() {
  return (
    <div className="animate-pulse space-y-14">
      <div className="space-y-4 text-center sm:text-left">
        <div className="h-4 w-20 rounded-full bg-paperDark" />
        <div className="mx-auto h-4 w-40 rounded-full bg-paperDark sm:mx-0" />
        <div className="mx-auto h-14 w-full max-w-xl rounded-card bg-paperDark sm:mx-0" />
        <div className="mx-auto h-5 w-full max-w-md rounded-card bg-paperDark sm:mx-0" />
      </div>
      <div className="h-32 rounded-panel bg-paperDark" />
      <div className="h-48 rounded-panel bg-paperDark" />
      <div className="space-y-4">
        <div className="h-8 w-40 rounded-card bg-paperDark" />
        <div className="h-64 rounded-panel bg-paperDark" />
      </div>
    </div>
  );
}
