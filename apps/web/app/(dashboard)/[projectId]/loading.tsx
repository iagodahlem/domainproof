import { OverviewSkeleton } from './_components/overview-skeleton'

/**
 * The Overview page's own section skeleton — never the whole shell. Shell
 * chrome (sidebar, topbar) is rendered synchronously by `[projectId]/layout.tsx`
 * and stays mounted across navigations; this boundary only ever stands in
 * for the content area passed as this layout's `children`, so replacing it
 * with a full page mockup (the old `ShellSkeleton`) doubled up on real
 * chrome that was already on screen — the "I see a skeleton loading inside
 * the page I'm hitting" bug.
 */
export default function OverviewLoading() {
  return <OverviewSkeleton />
}
