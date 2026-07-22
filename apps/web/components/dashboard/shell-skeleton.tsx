/** Loading fallback for the dashboard shell route (`app/dashboard/loading.tsx`) — shown while the active project resolves. Mirrors the real shell's layout so nothing jumps once data lands. */
export function ShellSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-screen items-stretch bg-background max-[760px]:flex-col"
    >
      <div className="flex w-52 shrink-0 flex-col gap-2 border-r border-border bg-surface p-3 max-[760px]:w-full max-[760px]:flex-row max-[760px]:items-center max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:p-4">
        <div className="mb-5 h-5.5 w-28 animate-pulse rounded-sm bg-surface-3 max-[760px]:mb-0" />
        <div className="flex flex-col gap-0.5 max-[760px]:flex-row max-[760px]:gap-2">
          <div className="h-8 w-full animate-pulse rounded-md bg-surface-3 max-[760px]:w-8" />
          <div className="h-8 w-full animate-pulse rounded-md bg-surface-3 max-[760px]:w-8" />
          <div className="h-8 w-full animate-pulse rounded-md bg-surface-3 max-[760px]:w-8" />
          <div className="h-8 w-full animate-pulse rounded-md bg-surface-3 max-[760px]:w-8" />
        </div>
        <div className="flex-1 max-[760px]:hidden" />
        <div className="h-9 animate-pulse rounded-md bg-surface-3 max-[760px]:hidden" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-4 max-[640px]:px-4">
          <div className="h-4 w-20 animate-pulse rounded-sm bg-surface-3" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-surface-3" />
        </div>
        <div className="flex-1 p-6 max-[640px]:p-4">
          <div className="h-40 animate-pulse rounded-lg bg-surface-3" />
        </div>
      </div>
    </div>
  )
}
