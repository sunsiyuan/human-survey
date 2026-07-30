'use client'

import { useCallback, useMemo, useRef, useState } from 'react'

import { CandidatePicker, type PickAnswer, type PickMeta } from './CandidatePicker'
import { useEmbedBridge } from './useEmbedBridge'
import { orderCandidates } from '@/lib/attribution/order'
import type { AskNode } from '@/lib/attribution/schema'

/**
 * The whole respondent-facing flow.
 *
 * One node at a time, revealed in place (§3): picking a candidate that expands appends
 * the follow-up below the question that produced it, rather than replacing the screen.
 * The first question stays visible with its answer intact, so nothing about this reads
 * as "page 2 of ?" — which is the cost §3 spends most of its argument avoiding, since
 * completion rate multiplies everything the product is worth.
 *
 * Submission is progressive (§5.4): the first pick POSTs and is durable immediately, the
 * follow-up PATCHes. A respondent who abandons the second question has still told us
 * their channel.
 */

type Step = {
  node: AskNode
  /** Frozen at the moment the step appears; re-deriving on render would reshuffle it. */
  ordered: ReturnType<typeof orderCandidates>
  answered: boolean
}

type Props = {
  formId: string
  configVersion: number
  /**
   * Minted by the server component that renders this page, NOT here.
   *
   * It is the permutation seed (§6.1), so it decides the order of the very first paint —
   * which means generating it in a `useState` initializer produces one value during SSR
   * and a different one during hydration, the two renders disagree about the order, and
   * React throws the server HTML away and re-renders the whole tree. The data stayed
   * correct (the server replays whatever seed the request carried) but the respondent
   * saw the list reshuffle, and every byte of SSR was wasted.
   */
  renderId: string
  rootNode: AskNode
  embedded: boolean
  externalId: string | null
  hostOrigin: string | null
  metadata: Record<string, string>
}

type Phase = 'answering' | 'saving' | 'done' | 'error'

export function AttributionForm({
  formId,
  configVersion,
  renderId,
  rootNode,
  embedded,
  externalId,
  hostOrigin,
  metadata,
}: Props) {
  const order = useCallback(
    (node: AskNode) => orderCandidates(node.candidates, node.order, renderId),
    [renderId],
  )

  const [steps, setSteps] = useState<Step[]>(() => [
    { node: rootNode, ordered: order(rootNode), answered: false },
  ])
  const [phase, setPhase] = useState<Phase>('answering')
  const [error, setError] = useState<string | null>(null)

  const response = useRef<{ id: string; token: string } | null>(null)
  const { rootRef, post } = useEmbedBridge({ formId, embedded })

  // Best-effort host origin. Inside an iframe the referrer is the embedding page, which
  // is the only way to learn it without a handshake — the frame cannot read the parent's
  // location. Advisory by nature: the server treats it as billing hygiene, not a
  // security boundary, because a non-browser caller can put anything here.
  const resolvedHostOrigin = useMemo(() => {
    if (hostOrigin) {
      return hostOrigin
    }

    if (typeof document === 'undefined' || !document.referrer) {
      return null
    }

    try {
      return new URL(document.referrer).origin
    } catch {
      return null
    }
  }, [hostOrigin])

  const send = useCallback(
    async (node: AskNode, answer: PickAnswer, meta: PickMeta) => {
      setPhase('saving')
      setError(null)

      const existing = response.current
      const url = `/api/attribution/forms/${encodeURIComponent(formId)}/responses`

      const body = existing
        ? {
            response_id: existing.id,
            patch_token: existing.token,
            node_id: node.id,
            answer,
            selected_via_search: meta.selected_via_search,
          }
        : {
            render_id: renderId,
            config_version: configVersion,
            node_id: node.id,
            answer,
            selected_via_search: meta.selected_via_search,
            external_id: externalId,
            host_origin: resolvedHostOrigin,
            metadata,
          }

      let payload: {
        response_id?: string
        patch_token?: string
        next_node?: AskNode
        error?: string
        errors?: string[]
      }

      try {
        const res = await fetch(url, {
          method: existing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        payload = await res.json().catch(() => ({}))

        if (!res.ok) {
          // The respondent cannot act on a field-level validation list, so show the
          // summary and keep the form usable rather than dead-ending them.
          setError(payload.error ?? 'Something went wrong saving that.')
          setPhase('error')
          return
        }
      } catch {
        setError('Could not reach the server. Check your connection and try again.')
        setPhase('error')
        return
      }

      if (!existing && payload.response_id && payload.patch_token) {
        response.current = { id: payload.response_id, token: payload.patch_token }
        // Durable, so the host can stop worrying about this respondent — but NOT done.
        // A host that hides the frame here cuts off the follow-up (§5.4).
        post({ type: 'submitted', responseId: payload.response_id, answers: { [node.id]: answer } })
      }

      setSteps((current) =>
        current.map((step) => (step.node.id === node.id ? { ...step, answered: true } : step)),
      )

      if (payload.next_node) {
        const next = payload.next_node
        setSteps((current) => [...current, { node: next, ordered: order(next), answered: false }])
        setPhase('answering')
        return
      }

      setPhase('done')
      post({
        type: 'completed',
        responseId: response.current?.id ?? payload.response_id ?? '',
        answers: { [node.id]: answer },
      })
    },
    [configVersion, externalId, formId, metadata, order, post, renderId, resolvedHostOrigin],
  )

  const active = steps.findLast((step) => !step.answered) ?? null

  // Derived from state, not from the response ref. Reading a ref during render is
  // exactly the pattern React's rules forbid, and this condition genuinely is a
  // function of what has been answered: once any step is saved there is nothing left
  // worth skipping, and an abandoned follow-up is already measured as coverage (§5.4).
  const nothingSaved = steps.every((step) => !step.answered)

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-xl px-5 py-6">
      {steps.map((step, index) => (
        // The prompt is rendered by the picker, which owns the label→listbox
        // association. Repeating it here printed the question twice.
        <section key={step.node.id} className={index > 0 ? 'mt-7' : undefined}>
          <CandidatePicker
            node={step.node}
            ordered={step.ordered}
            onPick={(answer, meta) => void send(step.node, answer, meta)}
            // Every step but the newest is locked. The answer stays on screen because
            // the expansion is supposed to read as more of the same question, not as a
            // new screen — but a second edit would have to re-PATCH a node the server
            // has already closed.
            disabled={phase === 'saving' || phase === 'done' || step.answered}
            autoFocusSearch={index > 0 && step === active}
          />
        </section>
      ))}

      {phase === 'done' ? (
        <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">Thanks — that helps.</p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {/*
        §3.8: skipping is allowed, and it is the integrator's chrome rather than the
        picker's, because the picker is pure presentation. Offered only before anything
        is saved — once a channel is recorded there is nothing left worth skipping, and
        an abandoned follow-up is already measured as coverage (§5.4).
      */}
      {phase === 'answering' && active && nothingSaved ? (
        <button
          type="button"
          onClick={() => void send(active.node, { skipped: true }, { selected_via_search: false })}
          className="mt-6 text-xs text-slate-500 underline decoration-dotted underline-offset-4 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
        >
          Skip this question
        </button>
      ) : null}
    </div>
  )
}
