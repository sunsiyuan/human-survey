'use client'

import { useCallback, useEffect, useRef } from 'react'

/**
 * The iframe → host page protocol.
 *
 * Extracted from the pre-pivot SurveyForm/SurveyClosed pair, where the mount and
 * resize effects existed twice, verbatim, in two files. Four event types ship, not
 * three: `mounting` is fired by an inline script in the page shell before React
 * hydrates, so the host can swap a spinner for a skeleton during the cold load rather
 * than waiting seconds for `loaded`.
 *
 *   mounting   — iframe HTML parsed (posted by the server-rendered inline script)
 *   loaded     — React hydrated and the form is interactive
 *   resize     — content height changed; host should resize the iframe
 *   submitted  — the first answer is durable (progressive submission, §5.4)
 *   completed  — the follow-up landed, or the respondent finished in one step
 *
 * `submitted` and `completed` are separate because §5.4 makes the first answer durable
 * before the form is done. A host that hides the iframe on `submitted` would cut the
 * respondent off mid-flow; one that waits for `completed` to route the user gets the
 * behaviour it expects.
 */

export type EmbedEvent =
  | { type: 'loaded' }
  | { type: 'resize'; height: number }
  | { type: 'submitted'; responseId: string; answers: unknown }
  | { type: 'completed'; responseId: string; answers: unknown }

type Options = {
  formId: string
  embedded: boolean
}

export function useEmbedBridge({ formId, embedded }: Options) {
  const rootRef = useRef<HTMLDivElement>(null)
  const lastHeight = useRef(0)

  const post = useCallback(
    (event: EmbedEvent) => {
      if (!embedded) {
        return
      }

      // targetOrigin '*' because the host's origin is not knowable from inside the
      // frame, and a widget that refuses to talk to an origin it cannot name would
      // never talk to anyone. Safe here: every payload below is content the host
      // already has — they rendered the form and chose what to embed it beside.
      window.parent.postMessage({ source: 'humansurvey', formId, ...event }, '*')
    },
    [embedded, formId],
  )

  useEffect(() => {
    post({ type: 'loaded' })
  }, [post])

  useEffect(() => {
    if (!embedded) {
      return
    }

    const node = rootRef.current

    if (!node) {
      return
    }

    const observer = new ResizeObserver(() => {
      const height = node.offsetHeight

      // A zero height means the node is detached or display:none — reporting it makes
      // the host collapse the iframe and never get it back, because a collapsed frame
      // stops producing resize callbacks.
      if (height === 0) {
        return
      }

      // Dedupe. The predecessor posted on every observer callback, which was harmless
      // for a static question list and is not for a searchable picker: the list
      // re-measures on every keystroke, so an undeduped bridge reflows the host's
      // checkout page once per character the respondent types.
      if (height === lastHeight.current) {
        return
      }

      lastHeight.current = height
      post({ type: 'resize', height })
    })

    observer.observe(node)

    return () => observer.disconnect()
  }, [embedded, post])

  return { rootRef, post }
}

/**
 * The inline script that fires `mounting`, for the server component to render into the
 * embedded page shell. Kept next to the hook so the four event names live in one file.
 */
export function mountingScript(formId: string) {
  return `(function(){try{parent.postMessage({source:'humansurvey',type:'mounting',formId:${JSON.stringify(
    formId,
  )}},'*')}catch(e){}})()`
}
