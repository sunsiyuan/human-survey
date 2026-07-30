import { NextResponse } from 'next/server'

import { configErrorResponse, configureForm, getForm, updateForm } from '@/lib/attribution/config'
import { requireAuth } from '@/lib/auth'

/**
 * A single form: read it, reconfigure it (PUT), or change its settings (PATCH).
 *
 * PUT and PATCH are separate verbs on purpose. A config is an immutable snapshot that
 * stored responses are joined against (§5.5); a form's settings — name, status,
 * origins, theme, webhook — are live properties meant to be edited. One endpoint doing
 * both would mean a caller changing the accent color also had to resend the candidate
 * list, and a caller who got that wrong would rewrite what history says was rendered.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) {
    return auth
  }

  const { id } = await context.params

  try {
    const form = await getForm(auth.accountId, id)

    if (!form) {
      // Same answer for "no such form" and "not your form" — see requireOwnedForm.
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    return NextResponse.json({ ...form, form_url: `${new URL(request.url).origin}/s/${form.id}` })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) {
    return auth
  }

  const { id } = await context.params
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  try {
    const { version, created, warnings } = await configureForm(auth.accountId, id, body)

    // 200 on both paths, including the dedupe. A 201/200 split would read as "created"
    // vs "not created" and tempt a caller to treat the second as a failure, when it is
    // the deliberate outcome that keeps the position-effect sample intact (§5.5).
    return NextResponse.json({ id, version, created, warnings })
  } catch (error) {
    const response = configErrorResponse(error)

    if (response) {
      return response
    }

    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) {
    return auth
  }

  const { id } = await context.params
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  // Config keys sent here would otherwise be dropped without complaint, and a caller
  // who reached for the wrong verb would see a 200 and believe their candidate list
  // shipped. Naming the right verb costs one branch and saves a silent data gap.
  if (body && typeof body === 'object' && ('nodes' in body || 'root_node_id' in body)) {
    return NextResponse.json(
      {
        error: 'PATCH does not accept config; send {nodes} to PUT /api/attribution/forms/{id} instead',
      },
      { status: 400 },
    )
  }

  try {
    const { form, warnings } = await updateForm(auth.accountId, id, body)

    return NextResponse.json({
      ...form,
      form_url: `${new URL(request.url).origin}/s/${form.id}`,
      warnings,
    })
  } catch (error) {
    const response = configErrorResponse(error)

    if (response) {
      return response
    }

    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
