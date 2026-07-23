import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import { DocsShell } from '../_components/docs-shell'
import { DocsToc } from '../_components/docs-toc'
import { createMdxComponents } from '../_components/mdx-components'
import { getAllDocs, getDocBySlug, getNavGroups } from '../_lib/content'
import { extractToc } from '../_lib/slug'

export function generateStaticParams() {
  return getAllDocs().map((doc) => ({ slug: doc.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const doc = getDocBySlug(slug)
  if (!doc) return {}
  return {
    title: `${doc.title} — DomainProof docs`,
    description: doc.description,
  }
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const doc = getDocBySlug(slug)
  if (!doc) notFound()

  const groups = getNavGroups()
  // The reference page's h3s are one per documented endpoint — a real nav
  // target, unlike a guide's h3 (the repeated "Using the SDK" subsection),
  // so only this page collects them into its TOC.
  const isReference = doc.slug === 'api-reference'

  return (
    <DocsShell
      groups={groups}
      activeSlug={doc.slug}
      toc={
        <DocsToc entries={extractToc(doc.body, { includeH3: isReference })} />
      }
    >
      <div className="mb-2 font-mono text-xs font-semibold tracking-widest text-accent uppercase">
        {doc.section}
      </div>
      <h1 className="mb-3 text-3xl leading-heading-tight font-heading text-foreground">
        {doc.title}
      </h1>
      <p className="mb-6 max-w-[66ch] leading-body text-muted-foreground">
        {doc.description}
      </p>
      <MDXRemote
        source={doc.body}
        components={createMdxComponents()}
        options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
      />
    </DocsShell>
  )
}
