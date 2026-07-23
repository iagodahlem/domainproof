export default function VerifyTokenLoading() {
  return (
    <main
      aria-hidden="true"
      className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12 max-[640px]:px-4 max-[640px]:py-8"
    >
      <div className="h-8 w-2/3 animate-pulse rounded-sm bg-surface-3" />
      <div className="h-40 animate-pulse rounded-lg bg-surface-3" />
      <div className="h-56 animate-pulse rounded-lg bg-surface-3" />
      <div className="h-32 animate-pulse rounded-lg bg-surface-3" />
    </main>
  )
}
