/** Loading fallback for the dashboard shell route (`app/(dashboard)/[projectId]/loading.tsx`) — shown while the active project resolves. Mirrors the real shell's layout so nothing jumps once data lands. */
export function ShellSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-screen items-stretch bg-background max-[760px]:flex-col"
    >
      <div className="flex w-52 shrink-0 flex-col border-r border-border bg-surface max-[760px]:w-full max-[760px]:grid max-[760px]:grid-cols-[1fr_auto_1fr] max-[760px]:items-center max-[760px]:gap-4 max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:p-4">
        <div className="border-b border-border px-5 py-4 max-[760px]:hidden">
          <div className="h-5.5 w-28 animate-pulse rounded-sm bg-surface-3" />
        </div>
        <div className="border-b border-border px-5 py-4 max-[760px]:hidden">
          <div className="h-9 w-full animate-pulse rounded-md bg-surface-3" />
        </div>

        <div className="hidden items-center gap-2 max-[760px]:flex max-[760px]:justify-self-start">
          <div className="h-5.5 w-5.5 shrink-0 animate-pulse rounded-sm bg-surface-3" />
          <div className="h-7 w-9 animate-pulse rounded-md bg-surface-3" />
        </div>

        <div className="flex flex-col gap-0.5 p-3 max-[760px]:flex-row max-[760px]:justify-self-center max-[760px]:gap-2 max-[760px]:p-0">
          <div className="h-8 w-full animate-pulse rounded-md bg-surface-3 max-[760px]:w-8" />
          <div className="h-8 w-full animate-pulse rounded-md bg-surface-3 max-[760px]:w-8" />
          <div className="h-8 w-full animate-pulse rounded-md bg-surface-3 max-[760px]:w-8" />
          <div className="h-8 w-full animate-pulse rounded-md bg-surface-3 max-[760px]:w-8" />
        </div>

        <div className="flex-1 max-[760px]:hidden" />

        <div className="border-t border-border p-3 max-[760px]:justify-self-end max-[760px]:border-t-0 max-[760px]:p-0">
          <div className="h-8 w-32 animate-pulse rounded-full bg-surface-3 max-[760px]:w-8" />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-4 max-[640px]:px-4">
          <div className="h-4 w-20 animate-pulse rounded-sm bg-surface-3" />
        </div>
        <div className="flex-1 p-6 max-[640px]:p-4">
          <div className="h-40 animate-pulse rounded-lg bg-surface-3" />
        </div>
      </div>
    </div>
  )
}
