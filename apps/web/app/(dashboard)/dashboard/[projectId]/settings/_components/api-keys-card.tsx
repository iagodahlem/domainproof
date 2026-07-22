'use client'

import { useState } from 'react'
import {
  Badge,
  Button,
  Callout,
  ConfirmBar,
  RecordCard,
  RecordField,
  cn,
} from '@domainproof/ui'
import { ApiError } from '@/lib/query/errors'
import type { ApiKeyListItem, CreateKeyResult } from '@/lib/api/dashboard'
import {
  useRotateOrRevokeApiKey,
  type RotateOrRevokeKeyInput,
} from '@/lib/query/keys'
import { useMode } from '@/lib/mode'

export interface ApiKeysCardProps {
  projectId: string
  initialKeys: ApiKeyListItem[]
}

type PendingAction = RotateOrRevokeKeyInput

const CONFIRM_COPY: Record<
  PendingAction['kind'],
  { message: string; confirmLabel: string }
> = {
  rotate: {
    message:
      "Rotating immediately revokes this key — any integration still using it stops working right away. This can't be undone.",
    confirmLabel: 'Confirm rotate',
  },
  revoke: {
    message:
      "Revoking immediately stops any integration still using this key. This can't be undone.",
    confirmLabel: 'Confirm revoke',
  },
}

function keyLabel(key: ApiKeyListItem): string {
  return key.name ?? (key.mode === 'live' ? 'Live key' : 'Test key')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Keys have no standalone page — masked value, mode pill, rotate/revoke.
 * Full key values are unrecoverable by design: every row here only ever
 * shows a masked value, and the only place a full key appears is the
 * show-once panel produced by a successful rotate.
 */
export function ApiKeysCard({ projectId, initialKeys }: ApiKeysCardProps) {
  const [keys, setKeys] = useState(initialKeys)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [errorByKey, setErrorByKey] = useState<Record<string, string>>({})
  const [revealedKey, setRevealedKey] = useState<CreateKeyResult | null>(null)

  const rotateOrRevoke = useRotateOrRevokeApiKey(projectId)
  const { mode: activeMode } = useMode()

  const busyKeyId = rotateOrRevoke.isPending
    ? (rotateOrRevoke.variables?.keyId ?? null)
    : null

  function runAction(keyId: string, kind: PendingAction['kind']) {
    setErrorByKey((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([id]) => id !== keyId)),
    )
    rotateOrRevoke.mutate(
      { keyId, kind },
      {
        onSuccess: (data) => {
          setKeys(data.apiKeys)
          if (data.kind === 'rotate') setRevealedKey(data.result)
          setPendingAction(null)
        },
        onError: (err, variables) => {
          console.error('Failed to rotate/revoke API key', err)
          setErrorByKey((prev) => ({
            ...prev,
            [variables.keyId]:
              err instanceof ApiError
                ? err.message
                : 'Something went wrong. Please try again.',
          }))
        },
      },
    )
  }

  return (
    <div className="mt-6 flex max-w-xl flex-col gap-4">
      {revealedKey ? (
        <div className="flex flex-col gap-3">
          <Callout tone="warning">
            <strong>Save this now.</strong> The full key is shown exactly once —
            copy it somewhere safe. You won&rsquo;t be able to see it again
            after you dismiss this.
          </Callout>
          <RecordCard
            title={keyLabel(revealedKey.apiKey)}
            sub="New key"
            trailing={<Badge tone="accent">One-time</Badge>}
          >
            <RecordField
              label={
                revealedKey.apiKey.mode === 'live' ? 'Live key' : 'Test key'
              }
              value={revealedKey.key}
              copyable
            />
          </RecordCard>
          <Button
            variant="default"
            className="self-start"
            onClick={() => setRevealedKey(null)}
          >
            Done
          </Button>
        </div>
      ) : null}

      <RecordCard title="API keys">
        {keys.length === 0 ? (
          <div className="px-5 py-6 text-sm text-faint-foreground">
            No API keys yet.
          </div>
        ) : (
          keys.flatMap((key) => {
            const isActiveMode = key.mode === activeMode
            const nodes = [
              <RecordField
                key={`${key.keyId}-field`}
                label={keyLabel(key)}
                value={key.maskedKey}
                className={cn(
                  isActiveMode &&
                    (key.mode === 'live'
                      ? 'bg-success-soft'
                      : 'bg-warning-soft'),
                )}
                explain={
                  <>
                    Created {formatDate(key.createdAt)} · Last used{' '}
                    {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'never'}
                  </>
                }
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={key.mode === 'live' ? 'success' : 'warning'}
                      mode
                    >
                      {key.mode === 'live' ? 'Live' : 'Test'}
                    </Badge>
                    {key.revokedAt ? (
                      <Badge tone="neutral">Revoked</Badge>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          disabled={busyKeyId === key.keyId}
                          onClick={() =>
                            setPendingAction({
                              keyId: key.keyId,
                              kind: 'revoke',
                            })
                          }
                        >
                          Revoke
                        </Button>
                        <Button
                          size="sm"
                          disabled={busyKeyId === key.keyId}
                          onClick={() =>
                            setPendingAction({
                              keyId: key.keyId,
                              kind: 'rotate',
                            })
                          }
                        >
                          Rotate
                        </Button>
                      </>
                    )}
                  </div>
                }
              />,
            ]

            if (pendingAction?.keyId === key.keyId) {
              const copy = CONFIRM_COPY[pendingAction.kind]
              nodes.push(
                <div key={`${key.keyId}-confirm`} className="px-5 pb-4">
                  <ConfirmBar
                    message={copy.message}
                    confirmLabel={copy.confirmLabel}
                    pending={busyKeyId === key.keyId}
                    onCancel={() => setPendingAction(null)}
                    onConfirm={() => runAction(key.keyId, pendingAction.kind)}
                  />
                </div>,
              )
            }

            if (errorByKey[key.keyId]) {
              nodes.push(
                <div key={`${key.keyId}-error`} className="px-5 pb-4">
                  <Callout tone="warning">{errorByKey[key.keyId]}</Callout>
                </div>,
              )
            }

            return nodes
          })
        )}
      </RecordCard>
    </div>
  )
}
