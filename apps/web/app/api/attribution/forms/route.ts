import { NextResponse } from 'next/server'

import { configErrorResponse, createForm, listForms } from '@/lib/attribution/config'
import { requireAuth } from '@/lib/auth'

/**
 * Collection endpoint for attribution forms.
 *
 * One form is one placement (§3.7): a customer typically runs two, one in the payment
 * flow and one in signup, and the pair is what yields a channel's conversion index: its share of the
 * paying population over its share of the signup population. That index times your overall
 * signup-to-paid rate is the channel's own rate — the index alone is not a rate.
 * So creating several forms per account is the expected shape, not an edge case — the
 * pre-pivot one-survey-per-key arrangement had no way to express it.
 */

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) {
    return auth
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  try {
    const { id, warnings } = await createForm(auth.accountId, body)

    return NextResponse.json(
      {
        id,
        form_url: `${new URL(request.url).origin}/s/${id}`,
        // A form with no config renders nothing, and the only way to give it one is a
        // separate call. Say so here rather than let the first embed attempt be how the
        // caller finds out.
        warnings: [
          ...warnings,
          `this form has no config yet; PUT /api/attribution/forms/${id} with {nodes} before embedding it`,
        ],
      },
      { status: 201 },
    )
  } catch (error) {
    const response = configErrorResponse(error)

    if (response) {
      return response
    }

    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) {
    return auth
  }

  try {
    const origin = new URL(request.url).origin
    const forms = await listForms(auth.accountId)

    return NextResponse.json(
      forms.map((form) => ({ ...form, form_url: `${origin}/s/${form.id}` })),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
