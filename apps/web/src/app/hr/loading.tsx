export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 bg-slate-200 rounded w-40" />
          <div className="h-4 bg-slate-100 rounded w-64" />
        </div>
        <div className="h-9 bg-slate-200 rounded w-32" />
      </div>
      {/* Cards skeleton */}
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card h-24 bg-slate-100" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="card h-72 bg-slate-100" />
      <div className="grid grid-cols-2 gap-4">
        <div className="card h-48 bg-slate-100" />
        <div className="card h-48 bg-slate-100" />
      </div>
    </div>
  );
}
