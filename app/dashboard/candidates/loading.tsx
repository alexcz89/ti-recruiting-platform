export default function CandidatesLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
        <div className="h-4 w-96 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="h-10 w-64 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></div>
        <div className="h-10 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></div>
        <div className="h-10 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></div>
      </div>

      {/* Candidate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-2xl border glass-card p-6 space-y-4"
          >
            {/* Avatar + Name */}
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 bg-zinc-200 dark:bg-zinc-800 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              </div>
            </div>

            {/* Skills */}
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="h-6 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full"
                ></div>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
