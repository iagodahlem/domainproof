export default function VerifyTokenLoading() {
  return (
    <main
      aria-hidden="true"
      className="mx-auto flex max-w-140 flex-col gap-8 px-6 pb-12 max-[480px]:gap-6 max-[480px]:px-4 max-[480px]:pb-8"
    >
      <div className="flex flex-col">
        <div className="py-6">
          <div className="h-5.5 w-32 animate-pulse rounded-sm bg-surface-3" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="h-7 w-full animate-pulse rounded-sm bg-surface-3" />
          <div className="h-4 w-2/3 animate-pulse rounded-sm bg-surface-3" />
        </div>
      </div>
      <div className="h-10 animate-pulse rounded-lg bg-surface-3" />
      <div className="h-48 animate-pulse rounded-lg bg-surface-3" />
      <div className="h-32 animate-pulse rounded-lg bg-surface-3" />
    </main>
  )
}
