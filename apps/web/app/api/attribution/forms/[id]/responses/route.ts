import { NextResponse } from 'next/server'

import { ReadQueryError, readResponses } from '@/lib/attribution/reads'
import { ResponseError, patchResponse, submitResponse } from '@/lib/attribution/responses'
import { requireAuth } from '@/lib/auth'

/**
 * The respondent-facing write endpoint — POST and PATCH. (GET is the creator-facing read
 * and is authenticated; its own comment is below.)
 *
 * Public and unauthenticated on both write verbs,
 * because it is called from inside an embedded form in someone else's payment flow —
 * there is no credential a respondent's browser could hold that would not immediately
 * be a credential every respondent holds.
 *
 * What stands in for auth is per-verb (docs/design/attribution-pivot.md §5.4): POST is
 * gated on the form's origin allowlist, PATCH on the one-time token POST minted. Both
 * live in lib/attribution/responses.ts; this file is only the HTTP boundary.
 *
 * The allowlist reads the host page's origin out of the POST body, not off this request
 * — the embed is served from our own origin, so its `Origin` header is ours on every
 * page that hosts it. See assertOriginAllowed for what that control is and is not.
 *
 * The `id` path segment is passed through unchecked ON PURPOSE. It is as respondent-
 * supplied as anything in the body — /forms/%00/responses decodes to a NUL — and it is
 * validated in responses.ts alongside every other id, so that the rejection and the
 * "no such form" answer stay one decision instead of two that can drift apart.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * The creator-facing read. Authenticated, unlike the two verbs below it — this is the one
 * place in this file where a credential exists, because the caller is the form's owner
 * rather than a respondent's browser.
 *
 * Two reads share the verb, dispatched on the query string (lib/attribution/reads.ts):
 *
 *   ?since_seq=…&limit=…   the agent's delta read over completed_seq (§11.2)
 *   ?external_id=…         one identity's response(s), canonical first (§9)
 *
 * A bare GET is the cursor read from the beginning of the stream, so a first call needs
 * no cursor.
 *
 * 404 covers both "no such form" and "not your form", exactly as requireOwnedForm does.
 * Splitting them would let anyone holding a key walk the id space and learn which form ids
 * are real — and this endpoint would tell them how many responses each one has.
 */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) {
    return auth
  }

  const { id: formId } = await context.params

  try {
    const payload = await readResponses(
      auth.accountId,
      formId,
      new URL(request.url).searchParams,
    )

    if (!payload) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof ReadQueryError) {
      return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 })
    }

    // Unlike the respondent-facing verbs below, the caller here holds a key for this
    // account, so a driver message is theirs to see and is the fastest route to a fix.
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { id: formId } = await context.params
  const body = await request.json().catch(() => null)

  try {
    const result = await submitResponse(formId, body, {
      origin: request.headers.get('origin'),
      selfOrigin: new URL(request.url).origin,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: formId } = await context.params
  const body = await request.json().catch(() => null)

  try {
    return NextResponse.json(await patchResponse(formId, body))
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * Validation failures carry a structured list and must not degrade into a 500 — a
 * respondent whose submission is rejected has no second chance to send it, so the
 * caller's client code has to be able to see which field was wrong.
 *
 * Everything else gets a fixed string. The caller here is an anonymous browser on
 * somebody else's page, and an unexpected error at this depth is a driver or trigger
 * message: constraint names, the immutability trigger's text, the connection string's
 * host. None of it is actionable for a respondent and all of it describes the schema to
 * whoever asked for it. It goes to the log instead, where the operator can read it.
 */
function errorResponse(error: unknown) {
  if (error instanceof ResponseError) {
    return NextResponse.json(
      error.errors && error.errors.length > 0
        ? { error: error.message, errors: error.errors }
        : { error: error.message },
      { status: error.status },
    )
  }

  console.error('attribution response write failed', error)

  return NextResponse.json({ error: 'Internal error' }, { status: 500 })
}
