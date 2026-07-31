import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Docs — HumanSurvey',
  description:
    'Authentication, form config, the respondent write path, embed, cursor reads, remapping, conversion events and the rollup for HumanSurvey — the attribution API for agents.',
  alternates: {
    canonical: '/docs',
    // public/docs.md is the same reference in markdown, and an agent doing content
    // negotiation gets it instead of this page. It is a static file and cannot share the
    // strings below, so it has to be edited in the same change — a twin that describes a
    // different API is worse than no twin, because the wrong one is the one only machines
    // read.
    types: { 'text/markdown': '/docs.md' },
  },
}

const techArticleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'HumanSurvey attribution API reference',
  description:
    'Authentication, JSON form config, the respondent write path, embed contract, cursor reads, retroactive remapping, conversion events and the rollup for HumanSurvey.',
  datePublished: '2026-04-06',
  dateModified: '2026-07-30',
  // app/layout.tsx publishes the Organization and the SoftwareApplication once, site-wide.
  // Restating them inline here put a second company and a second product in the graph that a
  // consumer then had to decide were the same ones — and that could disagree with the
  // originals after any edit. Reference the @ids instead.
  author: { '@id': 'https://www.humansurvey.co/#org' },
  publisher: { '@id': 'https://www.humansurvey.co/#org' },
  mainEntityOfPage: 'https://www.humansurvey.co/docs',
  about: { '@id': 'https://www.humansurvey.co/#app' },
}

const authSnippet = `# 1. mail yourself a six-digit code
curl -X POST https://www.humansurvey.co/api/auth/code \\
  -H "Content-Type: application/json" \\
  -d '{"email": "you@example.com"}'
# → 202 { "sent": true, "expires_in_seconds": 600 }

# 2. exchange the code for a key
curl -X POST https://www.humansurvey.co/api/auth/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "you@example.com",
    "code": "482915",
    "grant": "api_key",
    "name": "growth-agent"
  }'
# → 201 { "id": "abc123efgh45", "key": "hs_sk_..." }   ← the only time the key is readable`

const keyManagementSnippet = `# List every key on the account. "current" flags the one you are calling with.
curl https://www.humansurvey.co/api/keys \\
  -H "Authorization: Bearer hs_sk_..."

# Mint another key using an existing one — no email round trip
curl -X POST https://www.humansurvey.co/api/keys \\
  -H "Authorization: Bearer hs_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"name": "growth-agent (rotated 2026-07)"}'

# Revoke any key on the account, including one you are not holding
curl -X DELETE https://www.humansurvey.co/api/keys/<key-id> \\
  -H "Authorization: Bearer hs_sk_..."`

const configSnippet = `{
  "nodes": [
    {
      "id": "channel",
      "prompt": "Where did you first hear about us?",
      "order": "rotate",
      "allow_free_text": true,
      "candidates": [
        { "id": "tiktok",  "catalog_slug": "tiktok", "expands": "creator" },
        { "id": "chatgpt", "catalog_slug": "chatgpt" },
        { "id": "reddit",  "catalog_slug": "reddit" },
        { "id": "friend",  "catalog_slug": "friend" },
        { "id": "dunno", "label": "I don't remember",
          "pinned": "end", "dont_remember": true }
      ]
    },
    {
      "id": "creator",
      "prompt": "Which account was it?",
      "candidates": [
        { "id": "oecuid_8f21", "label": "Jade", "handle": "@jade.work0",
          "icon_url": "https://cdn.example.com/avatars/jade.jpg",
          "aliases": ["the one who does the office skits"] },
        { "id": "oecuid_1c07", "label": "Tom", "handle": "@transyncai_tom" },
        { "id": "creator_dunno", "label": "I don't remember who",
          "pinned": "end", "dont_remember": true }
      ]
    }
  ]
}`

const createFormSnippet = `# 1. create the placement
curl -X POST https://www.humansurvey.co/api/attribution/forms \\
  -H "Authorization: Bearer hs_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"name": "checkout", "allowed_origins": ["https://app.example.com"]}'
# → 201 { "id": "abc123efgh45",
#          "form_url": "https://www.humansurvey.co/s/abc123efgh45",
#          "warnings": ["this form has no config yet; PUT ... with {nodes} before embedding it"] }

# 2. give it a config — PUT snapshots {nodes} and returns the version
curl -X PUT https://www.humansurvey.co/api/attribution/forms/abc123efgh45 \\
  -H "Authorization: Bearer hs_sk_..." \\
  -H "Content-Type: application/json" \\
  -d @config.json
# → 200 { "id": "abc123efgh45", "version": 7, "created": true, "warnings": [] }

# 3. settings are a different verb — PATCH refuses config keys outright
curl -X PATCH https://www.humansurvey.co/api/attribution/forms/abc123efgh45 \\
  -H "Authorization: Bearer hs_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"theme": {"accent": "#4f46e5", "radius": 12, "dark_mode": "auto"}}'`

const respondentWriteSnippet = `POST /api/attribution/forms/{id}/responses          # public
{
  "render_id": "V1StGXR8_Z5j",      // client-minted, before first paint
  "config_version": 7,              // the snapshot that was rendered
  "node_id": "channel",             // must be the root node
  "answer": { "candidate_id": "tiktok" },
  "selected_via_search": false,
  "external_id": "usr_8812",        // your own user id — the join key
  "host_origin": "https://app.example.com",
  "metadata": { "plan": "pro" }
}
→ 201 { "response_id": "xyz789abcd01", "patch_token": "…", "next_node": { … } }

PATCH /api/attribution/forms/{id}/responses         # public, needs patch_token
{
  "response_id": "xyz789abcd01",
  "patch_token": "…",
  "node_id": "creator",
  "answer": { "candidate_id": "oecuid_8f21" }
}
→ 200 { "response_id": "xyz789abcd01", "completed": true }`

const answerShapeSnippet = `// exactly one key, on both POST and PATCH
{ "candidate_id": "tiktok" }              // a row in the rendered list
{ "raw": "the office skits girl" }        // free text, stored verbatim
{ "dont_remember": true }                 // the pinned escape hatch
{ "skipped": true }                       // §3.8 — skipping is allowed`

const cursorPollSnippet = `// Re-entry: read only what has completed since the last cursor
const r = await fetch(\`\${api}/api/attribution/forms/\${id}/responses?since_seq=\${cursor}\`,
  { headers: { Authorization: \`Bearer \${key}\` } }).then(r => r.json())

act(r.responses)             // only the delta; aggregates live in the rollup
saveCursor(r.next_cursor)    // echoes your cursor when the page is empty

// Nothing here ever says "finished". An attribution form is perpetual.
//   has_more        — a row past this page exists right now (read with LIMIT+1, not guessed)
//   open_responses  — someone is mid-answer, so more is expected shortly
scheduleNextCheck(r.next_check_hint_seconds)   // 0 | 120 | 3600`

const identityReadSnippet = `# One person, for joining our answer into your own user table
curl "https://www.humansurvey.co/api/attribution/forms/abc123efgh45/responses?external_id=usr_8812" \\
  -H "Authorization: Bearer hs_sk_..."
# → { "external_id": "usr_8812", "count": 2, "canonical_response_id": "xyz789abcd01",
#     "has_retakes": true, "truncated": false, "responses": [ … ] }`

const rollupSnippet = `curl "https://www.humansurvey.co/api/attribution/rollup\\
?form_id=abc123efgh45&by=candidate&metric=revenue&from=2026-07-01&to=2026-08-01" \\
  -H "Authorization: Bearer hs_sk_..."`

// The figures have to survive the rules stated underneath them, or the example teaches the
// error the product exists to prevent. In particular `per_node.creator` is the count that
// ANSWERED the creator node, so it is picks minus the abandoners: 412 - 38 = 374. It read 412
// here, which silently claimed the 38 abandoned picks answered a question they never saw.
const rollupShapeSnippet = `// ILLUSTRATIVE — invented figures, shown for shape
{
  "form_id": "abc123efgh45",
  "by": "candidate",
  "metric": "revenue",
  "window": { "from": "…", "to": "…",
              "basis": "response.completed_at", "bounds": "[from, to)" },
  "denominator": { "completed_responses": 1330, "per_node": { "channel": 1330, "creator": 374 } },
  "rows": [
    { "node_id": "channel", "candidate_id": "tiktok", "label": "TikTok",
      "label_from_node_id": null, "responses": 412, "share": 0.31,
      "share_corrected": null, "revenue_cents": 1840000, "paying_responses": 96,
      "resolved_by_remap": 7 }
  ],
  "unresolved": { "raw": 63, "dont_remember": 128, "skipped": 91, "per_node": { … } },
  "followup_unresolved": [ { "node_id": "channel", "candidate_id": "tiktok",
                             "follow_node_id": "creator", "picks": 412,
                             "unresolved": 91, "rate": 0.22 } ],
  "followup_abandoned":  [ { …, "abandoned": 38, "rate": 0.09 } ],
  "revenue": { "total_cents": 3910000, "paying_responses": 204, "event": "paid",
               "currencies": ["USD"], "basis": "first response per (form_id, external_id); …" },
  "position_effect": null,
  "calibration": null,
  "notes": [ … ]
}`

const remapSnippet = `# what free text is waiting, most frequent first
curl "https://www.humansurvey.co/api/attribution/forms/abc123efgh45/unresolved?limit=50" \\
  -H "Authorization: Bearer hs_sk_..."

# map it — retroactive, no backfill, every past window included
curl -X POST https://www.humansurvey.co/api/attribution/forms/abc123efgh45/remaps \\
  -H "Authorization: Bearer hs_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "node_id": "creator",
    "raw": "the office skits girl",
    "candidate_id": "oecuid_8f21"
  }'
# → 201 { "remap": {...}, "resolved_responses": 12,
#          "candidate_label": "Jade", "warnings": [] }

# undo it — soft, and equally retroactive
curl -X DELETE https://www.humansurvey.co/api/attribution/forms/abc123efgh45/remaps/<remap-id> \\
  -H "Authorization: Bearer hs_sk_..."
# → 200 { "remap": {...}, "revoked": true, "resolved_responses": 12, "notes": [ … ] }`

const eventsSnippet = `curl -X POST https://www.humansurvey.co/api/attribution/events \\
  -H "Authorization: Bearer hs_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "form_id": "abc123efgh45",
    "events": [
      { "external_id": "usr_8812", "event": "paid", "value_cents": 4900,
        "currency": "USD", "occurred_at": "2026-07-14T09:12:00Z",
        "idempotency_key": "stripe_in_1P9x" },
      { "external_id": "usr_9130", "event": "signup",
        "occurred_at": "2026-07-14T10:01:00Z" }
    ]
  }'
# → 201 { "accepted": 2, "duplicates": 0, "rejected": 0, "results": [ … ],
#          "join_check": { "checked": 2, "matched": 1, "unmatched": 1,
#                          "examples": ["usr_9130"] }, "notes": [ … ] }`

const embedIframeSnippet = `<iframe id="hs-form"
        src="https://www.humansurvey.co/s/abc123?embed=1&external_id=usr_8812&plan=pro"
        style="width:100%; border:0;"></iframe>
<script>
  window.addEventListener('message', e => {
    if (e.origin !== 'https://www.humansurvey.co') return
    if (e.data?.source !== 'humansurvey') return
    const f = document.getElementById('hs-form')
    if (e.data.type === 'resize') f.style.height = e.data.height + 'px'

    if (e.data.type === 'submitted') {
      // The channel answer is durable. The follow-up may still be on screen —
      // hiding the iframe here cuts the respondent off mid-flow.
      track('hdyhau_channel', e.data.answers)
    }

    if (e.data.type === 'completed') {
      // Now it is safe to route the user or collapse the frame.
    }
  })
</script>`

const embedAnswersSnippet = `// e.data.answers on submitted / completed — the one node just answered
{ "channel": { "candidate_id": "tiktok" } }
{ "creator": { "raw": "the office skits girl" } }
{ "channel": { "dont_remember": true } }`

const apiRoutes = [
  ['POST /api/auth/code', 'Public', 'Mail a six-digit sign-in code. 202 either way — it never says whether the address has an account.'],
  ['POST /api/auth/verify', 'Public', 'Exchange the code for an API key (grant: "api_key") or a browser session cookie (the default).'],
  ['POST /api/keys', 'Bearer key', 'Mint another key on the same account. No longer public — anonymous key creation is gone.'],
  ['GET /api/keys', 'Bearer key', 'List every key on the account, with current flagging the caller. Key values are never returned.'],
  ['DELETE /api/keys/{id}', 'Bearer key', 'Revoke any key on the account, including one you are not holding. Soft delete.'],
  ['POST /api/attribution/forms', 'Bearer key', 'Create a placement. name is required; config is a separate call.'],
  ['GET /api/attribution/forms', 'Bearer key', 'List the account’s forms, newest first, each with its form_url.'],
  ['GET /api/attribution/forms/{id}', 'Bearer key', 'The form plus the config snapshot it currently points at.'],
  ['PUT /api/attribution/forms/{id}', 'Bearer key', 'Send {nodes}. Validates, snapshots, returns the version. Identical content dedupes.'],
  ['PATCH /api/attribution/forms/{id}', 'Bearer key', 'Settings only: name, status, allowed_origins, theme, per_response_webhook_url.'],
  ['POST /api/attribution/forms/{id}/responses', 'Public', 'The first selection. Returns response_id, patch_token and next_node if one opens.'],
  ['PATCH /api/attribution/forms/{id}/responses', 'Public', 'The follow-up. Requires the patch_token from the POST.'],
  ['GET /api/attribution/forms/{id}/responses', 'Bearer key', 'Cursor read (?since_seq) or one identity (?external_id). Send one or the other, never both.'],
  ['GET /api/attribution/forms/{id}/unresolved', 'Bearer key', 'Free text awaiting a mapping, grouped and ordered by occurrence count.'],
  ['GET /api/attribution/forms/{id}/remaps', 'Bearer key', 'Mappings on this form, with the count of responses each one resolves today.'],
  ['POST /api/attribution/forms/{id}/remaps', 'Bearer key', 'Map free text to a candidate. Applies to every past window at read time.'],
  ['DELETE /api/attribution/forms/{id}/remaps/{remapId}', 'Bearer key', 'Revoke a mapping. Soft and idempotent — a second call returns revoked: false.'],
  ['GET /api/attribution/rollup', 'Bearer key', 'Aggregates for one form_id. Required, and never a union across forms.'],
  ['POST /api/attribution/events', 'Bearer key', 'Push conversion events keyed on external_id. Batched, idempotent, up to 500 per call.'],
  ['GET /api/attribution/catalog', 'Public', 'The product-owned platform catalog: slugs, labels, marks, monograms, aliases.'],
]

const limits = [
  ['nodes per form', '12'],
  ['candidates per node', '500 (12 render; search carries the rest)'],
  ['aliases per candidate', '24'],
  ['label, prompt, handle, icon_url', '120 characters'],
  ['any id', '128 characters'],
  ['free-text answer', '500 characters — rejected, never truncated'],
  ['allowed_origins', '20 entries'],
  ['response page limit', '1–500, default 100'],
  ['events per batch', '500'],
]

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-[1.25rem] border border-[var(--panel-border)] bg-slate-950 p-4 text-[13px] leading-6 text-[var(--accent-fg)] sm:p-5 sm:text-sm sm:leading-7">
      <code>{code}</code>
    </pre>
  )
}

function Section({
  id,
  title,
  children,
}: Readonly<{
  id: string
  title: string
  children: React.ReactNode
}>) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--surface)] p-5 shadow-[0_28px_90px_-68px_rgba(14,23,38,0.38)] backdrop-blur sm:p-7">
      <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-2xl">{title}</h2>
      <div className="mt-4 space-y-5 text-slate-700">{children}</div>
    </section>
  )
}

const navItems = [
  ['#authentication', 'Authentication'],
  ['#json-schema', 'Form config'],
  ['#api-reference', 'API Reference'],
  ['#responses', 'Collecting answers'],
  ['#embed', 'Embed'],
  ['#async-results', 'Cursor reads'],
  ['#remapping', 'Free text & remapping'],
  ['#events', 'Conversion events'],
  ['#rollup', 'Rollup'],
  ['#mcp-tools', 'MCP Tools'],
  ['#markdown-syntax', 'Markdown syntax (removed)'],
  ['#conditional-logic', 'Conditional logic (removed)'],
]

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[var(--page-gradient)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleJsonLd) }}
      />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <header className="rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--surface)] p-6 shadow-[0_28px_90px_-68px_rgba(14,23,38,0.38)] sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Docs
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl leading-[1.1] tracking-[-0.02em] text-slate-950 sm:text-6xl">
            API reference: configure the form, embed it, read the rollup.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-[1.7] text-slate-800 sm:text-lg sm:leading-8">
            HumanSurvey asks one question — how did you hear about us — at a granularity that is
            actually actionable. An agent configures the candidate list over HTTP, the form is
            embedded in a host page, and the same agent reads answers back as a stream of rows or
            as an aggregate. There is no dashboard: the agent is the dashboard.
          </p>
          <div className="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap">
            <a
              href="/api/openapi.json"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 py-3 font-semibold whitespace-nowrap text-white transition hover:bg-slate-800"
            >
              OpenAPI JSON
            </a>
            <a
              href="/llms-full.txt"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-900 px-5 py-3 font-semibold whitespace-nowrap text-slate-950 transition hover:bg-slate-950 hover:text-white"
            >
              llms-full.txt
            </a>
            <a
              href="/llms.txt"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 px-5 py-3 font-semibold whitespace-nowrap text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              llms.txt
            </a>
            <Link
              href="/faq"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 px-5 py-3 font-semibold whitespace-nowrap text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              FAQ
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 px-5 py-3 font-semibold whitespace-nowrap text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Back to site
            </Link>
          </div>
        </header>

        {/* Both grid items carry min-w-0. Below lg this is a single auto-sized track, so the
            track's floor is the widest min-content of anything in it — and neither item has a
            min-content anyone would want: the aside holds a nowrap pill row summing to ~1680px,
            the column holds <pre> blocks whose longest line is ~1670px. overflow-x-auto on the
            nav and on each block only makes them scrollable; it does not shrink the intrinsic
            size they contribute, so the track grew to 1714px inside a 328px container and every
            paragraph on the page was clipped mid-sentence at 360–520px. min-w-0 drops that floor
            to zero, the track takes the container's width, and the wide children scroll
            themselves. minmax(0,1fr) already does the same job for the second column at lg. */}
        <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
          <aside className="h-fit min-w-0 rounded-[1.5rem] border border-[var(--panel-border)] bg-white/80 p-4 text-sm shadow-[0_20px_70px_-60px_rgba(14,23,38,0.36)] backdrop-blur sm:p-5 lg:sticky lg:top-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Contents</p>
            <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-3">
              {navItems.map(([href, label]) => (
                <a
                  key={href}
                  className="rounded-full border border-[var(--panel-border)] px-3 py-2 whitespace-nowrap text-slate-700 hover:border-slate-900 hover:text-slate-950 lg:block lg:rounded-none lg:border-0 lg:px-0 lg:py-0"
                  href={href}
                >
                  {label}
                </a>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 space-y-8">
            <Section id="authentication" title="Authentication">
              <p>
                An account owns the data; a key is a credential pointing at it. Keys look like{' '}
                <code>hs_sk_...</code> and go on every creator request as{' '}
                <code>Authorization: Bearer hs_sk_...</code>.
              </p>
              <p>
                There is no anonymous key creation. The first key comes from a six-digit code
                mailed to an address you control — two calls, no browser required, which is what
                lets an MCP server write the key straight to its own config instead of returning it
                into a transcript.
              </p>
              <CodeBlock code={authSnippet} />
              <p>
                <code>grant: &quot;api_key&quot;</code> returns the key. Omit <code>grant</code> —
                or send <code>grant: &quot;session&quot;</code> — and you get an{' '}
                <code>httpOnly</code> session cookie instead. That is the grant{' '}
                <Link href="/signin" className="underline underline-offset-4">
                  /signin
                </Link>{' '}
                posts, and the three key routes below accept that cookie in place of a bearer key
                so{' '}
                <Link href="/account" className="underline underline-offset-4">
                  /account
                </Link>{' '}
                can issue a first key to someone who does not have one yet. Nothing else accepts
                it: every attribution route is bearer-only.
              </p>

              <h3 className="text-lg font-semibold text-slate-950">Key management</h3>
              <CodeBlock code={keyManagementSnippet} />
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong>List</strong> — <code>GET /api/keys</code> returns every key on the
                  account (<code>id</code>, <code>name</code>, <code>agent_client</code>,{' '}
                  <code>created_at</code>, <code>last_used_at</code>, <code>revoked_at</code>,{' '}
                  <code>current</code>). Key values are hashed at rest and never returned again.{' '}
                  <code>current</code> flags the key that authenticated the request, so it is{' '}
                  <code>false</code> on every row when a session cookie did — there is no key in
                  play to flag.
                </li>
                <li>
                  <strong>Revoke</strong> — <code>DELETE /api/keys/{'{id}'}</code> works on any key
                  on the account, not just the one in the header. That is the point: a leaked key
                  can be killed from somewhere safe. Unknown id, another account&apos;s key and
                  already-revoked all answer <code>404</code>.
                </li>
                <li>
                  <strong>Rotate</strong> — mint a replacement, move the integration, revoke the
                  old one. Forms and responses belong to the account, so nothing is orphaned by
                  rotation.
                </li>
              </ul>
            </Section>

            <Section id="json-schema" title="Form config">
              <p>
                A form is one placement — typically two per account, one in the signup flow and one
                in the payment flow. Creating it and configuring it are separate calls, and{' '}
                <code>PUT</code> is the only verb that accepts config.
              </p>
              <CodeBlock code={createFormSnippet} />
              <p>
                The config is a graph of ask nodes. Both questions are the same component: the
                first receives platforms, the second receives whatever the first expanded into.
              </p>
              <CodeBlock code={configSnippet} />
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong>Candidate ids are yours</strong>, and are validated rather than minted.
                  Use a key that survives a rename — handles change, and a handle used as an id
                  splits that creator&apos;s history the day they rename.
                </li>
                <li>
                  <code>catalog_slug</code> copies <code>label</code>, <code>icon_url</code>,{' '}
                  <code>tile_color</code> and <code>aliases</code> out of the platform catalog
                  at configure time. Anything you send yourself wins. Read the vocabulary from{' '}
                  <code>GET /api/attribution/catalog</code>, which needs no key.
                </li>
                <li>
                  <code>expands</code> names the node a pick reveals, in place. Exactly one node
                  must be unexpanded — that is the root, and it is derived rather than declared
                  (send <code>root_node_id</code> and it is checked against the derived one).
                  Cycles and unreachable nodes are rejected.
                </li>
                <li>
                  <code>order</code> defaults to <code>&quot;rotate&quot;</code>: the orderable
                  segment is permuted per respondent, so no option sits at the top for everybody
                  and the raw share is unbiased by construction. <code>&quot;fixed&quot;</code>{' '}
                  uses your array order verbatim and accepts the position bias that comes with it.
                </li>
                <li>
                  <code>pinned: &quot;end&quot;</code> excludes a candidate from ordering and
                  renders it last. <code>dont_remember: true</code> records the pick as a
                  non-answer instead of a channel, and requires <code>pinned: &quot;end&quot;</code>.
                  At most one of each per node.
                </li>
                <li>
                  <code>aliases</code> are matched by the search box and never displayed. There is
                  no <em>Other</em> option — <code>allow_free_text</code> (default true) lets a
                  respondent type instead.
                </li>
              </ul>
              <p>
                <strong>Every config is an immutable snapshot.</strong> <code>PUT</code> returns a{' '}
                <code>version</code>, stored responses are joined against the version they were
                rendered with, and a reconfigure never rewrites what an older response says was
                shown. Re-posting identical content returns the existing version with{' '}
                <code>created: false</code> — which is deliberate, because a fresh version every
                month would fragment the position-effect sample.
              </p>
              <p>
                Validation reports every problem at once, as{' '}
                <code>{'{ error, errors: [...] }'}</code> with <code>400</code>, so an agent does
                not burn a turn per typo.
              </p>

              <h3 className="text-lg font-semibold text-slate-950">Settings, and the lifecycle</h3>
              <p>
                <code>PATCH</code> takes <code>name</code>, <code>status</code>,{' '}
                <code>allowed_origins</code>, <code>theme</code> and{' '}
                <code>per_response_webhook_url</code>. It rejects <code>nodes</code> and{' '}
                <code>root_node_id</code> with a <code>400</code> naming <code>PUT</code>, rather
                than accepting them and silently dropping your candidate list.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong>Status is <code>active</code> or <code>paused</code>.</strong> There is no
                  open / closed / expired / full lifecycle, no <code>max_responses</code> and no{' '}
                  <code>expires_at</code>: an attribution form is a perpetual stream, not a bounded
                  study. Pausing is reversible, so a POST to a paused form answers <code>409</code>,
                  not <code>410</code>.
                </li>
                <li>
                  <code>allowed_origins</code> is checked against the host page&apos;s origin. An
                  empty list is enforced as allow-all and every write returns a warning saying so,
                  because an unlisted origin embedding your form spends your response quota. Origins
                  only — a path, query or fragment is rejected at configure time rather than
                  silently matching nothing.
                </li>
                <li>
                  <code>theme</code> accepts four tokens and nothing else: <code>accent</code> (hex),{' '}
                  <code>radius</code> (0–48 px), <code>font</code> (a font-family list) and{' '}
                  <code>dark_mode</code> (<code>light</code> / <code>dark</code> /{' '}
                  <code>auto</code>). An unknown key is an error, not a shrug. Sending{' '}
                  <code>theme</code> replaces the stored one wholesale, so <code>{'{}'}</code> is
                  how you reset it.
                </li>
                <li>
                  <code>per_response_webhook_url</code> is accepted, validated and stored, and{' '}
                  <strong>nothing delivers to it yet</strong>. Until it does, use the cursor read
                  below — do not build on the field.
                </li>
              </ul>
              <h3 className="text-lg font-semibold text-slate-950">Limits</h3>
              <dl className="grid gap-2 sm:grid-cols-2">
                {limits.map(([what, value]) => (
                  <div key={what} className="rounded-[1rem] border border-[var(--panel-border)] bg-white p-3">
                    <dt className="text-sm font-semibold text-slate-950">{what}</dt>
                    <dd className="mt-1 text-sm text-slate-700">{value}</dd>
                  </div>
                ))}
              </dl>
            </Section>

            <Section id="api-reference" title="API Reference">
              <div className="grid gap-3 sm:grid-cols-2">
                {apiRoutes.map(([route, auth, purpose]) => (
                  <article
                    key={route}
                    className="rounded-[1.25rem] border border-[var(--panel-border)] bg-white p-4"
                  >
                    {/* A route is one unbreakable run to the line breaker — UAX #14 offers no
                        break after a slash — so `DELETE /api/attribution/forms/{id}/remaps/
                        {remapId}` measures ~317px at text-xs and sets a min-content floor wider
                        than a 286px card track. wrap-anywhere (overflow-wrap: anywhere, unlike
                        break-word) lowers the intrinsic size as well as wrapping the rendered
                        line, which is what the track sizing reads. Wrapping beats a per-card
                        horizontal scroller here: the whole card is three short lines of prose. */}
                    <p className="font-mono text-xs wrap-anywhere text-[var(--accent-strong)]">{route}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{auth}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{purpose}</p>
                  </article>
                ))}
              </div>
              <p>
                Plus <code>/s/{'{id}'}</code>, the respondent page — public, unchanged, and the only
                page a respondent ever sees.
              </p>
              <p>
                Every route that takes a form id answers <code>404</code> for both &quot;no such
                form&quot; and &quot;not your form&quot;. That is not vagueness for its own sake:
                telling them apart would let anyone holding a key walk the id space.
              </p>
              <p>
                Machine-readable OpenAPI for this surface lives at{' '}
                <a href="/api/openapi.json">/api/openapi.json</a>, also served at{' '}
                <code>/openapi.json</code>. For agents,{' '}
                <a href="/llms-full.txt">llms-full.txt</a> carries the same endpoints plus the
                caveats that change a number.
              </p>
            </Section>

            <Section id="responses" title="Collecting answers">
              <p>
                The respondent write path is public on both verbs, because it runs inside a form
                embedded in someone else&apos;s checkout — there is no credential a respondent&apos;s
                browser could hold that would not immediately be a credential every respondent
                holds. What stands in for auth is per verb: POST is gated on the origin allowlist,
                PATCH on the one-time token POST hands back.
              </p>
              <p>
                Submission is progressive. The first pick POSTs and is durable immediately; the
                follow-up PATCHes. Someone who answers the channel question and walks away has
                still told you their channel, and that response is billed and counted.
              </p>
              <CodeBlock code={respondentWriteSnippet} />
              <p>
                <code>answer</code> carries exactly one of four keys. Sending two, or none, is a{' '}
                <code>400</code> naming the count.
              </p>
              <CodeBlock code={answerShapeSnippet} />
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <code>render_id</code> is minted by the client before first paint and is the
                  rotation seed, so a reload is stable. <strong>Send no position data.</strong> The
                  server derives the impressions map and the selected index from{' '}
                  <code>(render_id, config_version, node)</code> by running the same pure
                  permutation the client rendered with — so neither number can be forged, and no
                  honest submission can be rejected for disagreeing.
                </li>
                <li>
                  <code>selected_via_search</code> stays client-supplied because the server sees the
                  list but not the keystrokes. It only ever suppresses a recorded position, never
                  invents one.
                </li>
                <li>
                  <code>external_id</code> is your own user id, the join key in both directions. It
                  is deliberately not unique — a retake is allowed — and the rollup counts the first
                  response per <code>(form_id, external_id)</code>. It is respondent-asserted and
                  not authenticated: it identifies, it does not prove.
                </li>
                <li>
                  <code>config_version</code> tells the server which snapshot was on screen. Omit it
                  and the form&apos;s current version is used, which is only right for a client that
                  predates the field — a reconfigure landing between page load and submit would then
                  reject a candidate the respondent was actually shown.
                </li>
                <li>
                  <code>host_origin</code> is the embedding page&apos;s origin. The{' '}
                  <code>Origin</code> header cannot serve here: the iframe is served from our own
                  origin, so every embed is same-origin by construction. Treat this as billing
                  hygiene, not a security boundary — anything in the browser can assert it.
                </li>
                <li>
                  <code>patch_token</code> is good until the response completes, not for exactly one
                  call, so an expansion chain deeper than two levels still works. A second PATCH
                  after completion is <code>409</code>.
                </li>
              </ul>
              <p>
                A response becomes visible to the reads below only once it is complete — or once an
                abandonment sweep closes it out, which happens lazily on the next authenticated read
                of that form. Every row is therefore emitted exactly once and is final when
                emitted, so no consumer has to upsert.
              </p>
            </Section>

            <Section id="embed" title="Embed">
              <p>
                Append <code>?embed=1</code> to the form URL to render without site chrome, on a
                transparent full-width container. Ask early in the flow — memory decays, and asking
                later means asking only the people who stayed.
              </p>
              <CodeBlock code={embedIframeSnippet} />
              <p>
                Five message types, every one carrying{' '}
                <code>source: &apos;humansurvey&apos;</code> and <code>formId</code>:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <code>{`{ type: 'mounting', formId }`}</code> — posted by an inline script the
                  instant the iframe HTML is parsed, before React hydrates. Swap a blank spinner for
                  a skeleton during the cold load.
                </li>
                <li>
                  <code>{`{ type: 'loaded', formId }`}</code> — hydrated and interactive.
                </li>
                <li>
                  <code>{`{ type: 'resize', formId, height }`}</code> — content height changed;
                  size the iframe so there is no inner scrollbar. Deduped, which matters for a
                  searchable list that re-measures on every keystroke.
                </li>
                <li>
                  <code>{`{ type: 'submitted', formId, responseId, answers }`}</code> — the first
                  answer is durable. <strong>Not</strong> the end of the flow.
                </li>
                <li>
                  <code>{`{ type: 'completed', formId, responseId, answers }`}</code> — the
                  follow-up landed, or the respondent finished in one step. This is the one to
                  route on.
                </li>
              </ul>
              <p>
                <code>submitted</code> and <code>completed</code> are separate because progressive
                submission makes the first answer durable before the form is done. A host that
                hides the iframe on <code>submitted</code> cuts the respondent off mid-question.
              </p>
              <h3 className="text-lg font-semibold text-slate-950">Answer payload</h3>
              <p>
                <code>answers</code> is keyed by node id and carries the one node that was just
                answered — the same answer object the write path takes, not a whole-form map.
              </p>
              <CodeBlock code={embedAnswersSnippet} />
              <p>
                There is no <code>::</code> fill-in encoding any more. Free text is a first-class{' '}
                <code>raw</code> answer, so nothing has to be split on a separator.
              </p>
              <h3 className="text-lg font-semibold text-slate-950">Response tagging</h3>
              <p>
                Any query param on the form URL that is not reserved is captured and stored as the
                response&apos;s <code>metadata</code>, so you can segment by whatever you already
                know (<code>?plan=pro&amp;step=checkout</code>). It surfaces on every row from the
                cursor read.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Reserved params, consumed by the page and never stored as tags:{' '}
                  <code>embed</code>, <code>external_id</code>, <code>host_origin</code>.
                </li>
                <li>
                  Sanitized on capture: string and number values only, at most 20 keys, keys
                  truncated to 64 characters and values to 512. Repeated params keep their last
                  value. Responses with no custom params carry <code>metadata: {'{}'}</code>.
                </li>
              </ul>
            </Section>

            <Section id="async-results" title="Cursor reads">
              <p>
                <code>GET /api/attribution/forms/{'{id}'}/responses</code> is the primary read path.
                A bare call reads from the beginning of the stream, so a first call needs no cursor;
                pass <code>next_cursor</code> back as <code>since_seq</code> to get only the delta.{' '}
                <code>limit</code> is 1–500, default 100, and an out-of-range value is rejected
                rather than clamped.
              </p>
              <CodeBlock code={cursorPollSnippet} />
              <p>
                <strong>There is no <code>is_final</code>, and there was never a legitimate value
                for it.</strong> An attribution form is perpetual, so no field may claim a terminal
                state. Two facts replace it, and both come out of the same snapshot as the page:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <code>has_more</code> — a row past this page exists right now. A fact, not a{' '}
                  <code>rows.length === limit</code> guess: the page is read with{' '}
                  <code>LIMIT limit + 1</code> and the extra row dropped.
                </li>
                <li>
                  <code>open_responses</code> — someone answered their first question and has not
                  yet finished or been swept, so more is expected shortly.
                </li>
                <li>
                  <code>next_check_hint_seconds</code> — advisory cadence derived from those two:{' '}
                  <code>0</code> while a page is waiting, <code>120</code> while something is in
                  flight, <code>3600</code> once drained.
                </li>
                <li>
                  <code>next_cursor</code> — this page&apos;s own last cursor, and it echoes your
                  cursor when the page is empty rather than resetting to null, which would restart
                  the stream from the beginning.
                </li>
              </ul>
              <p>
                Each row carries <code>completion</code> (<code>finished</code> or{' '}
                <code>abandoned</code>), <code>awaiting_node_id</code> (non-null is the row-level
                coverage read-out), <code>config_version</code>, <code>external_id</code>,{' '}
                <code>positions</code>, <code>metadata</code> and its own <code>cursor</code>. Each
                answer carries the verbatim <code>raw</code>, the unresolved{' '}
                <code>candidate_id</code>, the <code>resolved_candidate_id</code> after live remaps,{' '}
                <code>resolved_via</code> (<code>answer</code> / <code>remap</code>),{' '}
                <code>resolved_label</code> from the config snapshot, <code>position</code> and{' '}
                <code>selected_via_search</code>. The unresolved value ships next to the resolved
                one on purpose: a caller who only ever sees the resolved answer cannot audit a
                mapping it disagrees with.
              </p>
              <h3 className="text-lg font-semibold text-slate-950">One identity</h3>
              <p>
                <code>?external_id=</code> is the other read on the same verb — one person&apos;s
                answers, so attribution can be a property of a user record rather than a monthly
                report. Send <code>since_seq</code> or <code>external_id</code>, never both: they
                are two different reads with two different orderings, and a cursor from one is not
                a cursor into the other.
              </p>
              <CodeBlock code={identityReadSnippet} />
              <p>
                Ordered by <code>created_at</code>, and the first row is flagged{' '}
                <code>canonical</code> — the one the rollup books revenue against. Retakes are
                surfaced (<code>has_retakes</code>) rather than hidden.
              </p>
            </Section>

            <Section id="remapping" title="Free text and remapping">
              <p>
                Free text is stored verbatim and never normalized at write time, which is also why
                there is no <code>TikTok</code> bucket sitting beside a <code>tiktok</code> one:
                candidate ids are yours, so nothing is guessed on the way in.
              </p>
              <p>
                A mapping is not an edit. Nothing about a response changes; the rollup resolves each
                answer against the live remap table on every read. So one row fixes two months of
                history at once, and revoking it moves them back.
              </p>
              <CodeBlock code={remapSnippet} />
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <code>GET .../unresolved</code> groups by <code>(node_id, raw_normalized)</code>{' '}
                  and orders by occurrence count, so the twelve-occurrence entry comes before the
                  singleton. Query: <code>node_id</code>, <code>from</code>, <code>to</code>,{' '}
                  <code>include_mapped</code>, <code>limit</code>, <code>offset</code>. The window
                  filters on the response&apos;s <code>completed_at</code> and <code>to</code> is
                  exclusive, matching the rollup, so the same pair reconciles across both.
                </li>
                <li>
                  On create, send exactly one of <code>raw</code> (a verbatim sample straight out of
                  the unresolved list) or <code>raw_normalized</code>. Both take the same path —{' '}
                  <code>lower(btrim(...))</code> evaluated in Postgres, the same function that
                  generated the stored key.
                </li>
                <li>
                  <code>resolved_responses</code> on the create and revoke responses is the exact
                  number of completed responses that just moved, so &quot;I mapped it and nothing
                  changed&quot; is visible immediately instead of next month.
                </li>
                <li>
                  <code>candidate_id</code> is not validated against the current config — a
                  candidate can be dropped while history still needs the mapping — but an id present
                  in no version of the form comes back as a warning, because the likelier cause is a
                  typo.
                </li>
                <li>
                  A second live mapping of the same string is <code>409</code> naming the one
                  already in place, because two live remaps double-count in the read-time join.
                  Revocation is soft and idempotent.
                </li>
              </ul>
            </Section>

            <Section id="events" title="Conversion events">
              <p>
                <code>POST /api/attribution/events</code> is the inbound half of the{' '}
                <code>external_id</code> join: you push what happened to a person, we already know
                which channel that person named, and the rollup becomes channel × revenue instead of
                channel × heads. Caller-pushed on purpose — there is no Stripe or AppsFlyer
                integration.
              </p>
              <CodeBlock code={eventsSnippet} />
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Accepts a single event object, a bare array, or{' '}
                  <code>{'{ form_id, events: [...] }'}</code> — an envelope <code>form_id</code> is
                  pushed onto each element that omits one. Up to 500 events per call.
                </li>
                <li>
                  Fields: <code>form_id</code>, <code>external_id</code>, <code>event</code> (
                  <code>signup</code> / <code>activated</code> / <code>paid</code> /{' '}
                  <code>churned</code>), <code>occurred_at</code>, and optionally{' '}
                  <code>value_cents</code>, <code>currency</code>, <code>idempotency_key</code>.{' '}
                  <code>value_cents</code> requires <code>currency</code>.
                </li>
                <li>
                  <strong>One bad row does not fail the batch.</strong> Every element is validated
                  independently and reported at its own index as <code>created</code>,{' '}
                  <code>duplicate</code> or <code>rejected</code>, so a 400-payment backfill that
                  trips on row 217 tells you exactly what to resend.
                </li>
                <li>
                  A replayed <code>idempotency_key</code> is a success that says so, and carries a
                  warning when the replayed payload disagrees with what is stored. Reusing one key
                  for two different amounts would otherwise leave every downstream number quietly
                  equal to the first.
                </li>
                <li>
                  <code>join_check</code> reports how many <code>external_id</code>s matched a
                  response on that form, with a few unmatched examples. An event for someone who has
                  not answered is legitimate and is not rejected — but &quot;we pushed a month of
                  Stripe data and revenue is still zero&quot; is almost always an id-format
                  mismatch, and this is where it becomes visible.
                </li>
                <li>
                  Status: <code>201</code> when anything was created, <code>200</code> when nothing
                  was new but something was a clean replay, <code>400</code> when nothing was
                  written, <code>404</code> when every rejection named a form this key cannot see.
                </li>
              </ul>
            </Section>

            <Section id="rollup" title="Rollup">
              <p>
                <code>GET /api/attribution/rollup</code> is the aggregate read, computed in SQL at
                read time against the current remap table. <code>form_id</code> is required and
                there is no union across forms — candidate populations differ per form, so a union
                would divide one form&apos;s selections by another form&apos;s respondents.
              </p>
              <CodeBlock code={rollupSnippet} />
              <p>
                <code>by</code> is <code>candidate</code> (default, one row per node × candidate) or{' '}
                <code>node</code>. <code>metric</code> chooses the sort, not which columns ship.{' '}
                <code>from</code> / <code>to</code> filter on the response&apos;s{' '}
                <code>completed_at</code>, half-open as <code>[from, to)</code>; a zoneless
                timestamp is read as UTC.
              </p>
              <CodeBlock code={rollupShapeSnippet} />
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong>The denominator ships in the payload.</strong> <code>share</code> is over
                  every completed response that answered that node, so the resolved rows sum to less
                  than one and the remainder is the <code>unresolved</code> block — a reader who has
                  to infer whether 31% excludes the don&apos;t-knows will infer wrong.
                </li>
                <li>
                  Revenue is booked once per response, on the first response per{' '}
                  <code>(form_id, external_id)</code>, and appears once: totals in the top-level{' '}
                  <code>revenue</code> block, per-row <code>revenue_cents</code> only on the root
                  node&apos;s rows and <code>null</code> elsewhere. Null rather than zero, because
                  zero would be a claim.
                </li>
                <li>
                  <code>followup_unresolved</code> and <code>followup_abandoned</code> are different
                  numbers and both ship. The first is candidate coverage: of the picks that opened a
                  follow-up, the fraction that did not end in a resolved candidate. The second is
                  strictly the fraction that never came back at all. Neither is derivable from the
                  other.
                </li>
                <li>
                  <code>share_corrected</code>, <code>position_effect</code> and{' '}
                  <code>calibration</code> are <code>null</code> in v1. Returned as explicit nulls
                  so their absence is visible rather than mysterious.
                </li>
                <li>
                  Labels come from the config snapshots, never the live catalog, so a product-side
                  rename cannot rewrite what an old rollup says was shown.{' '}
                  <code>label_from_node_id</code> is set when a label had to be read off another
                  node of the same form, which only happens for a remap target.
                </li>
              </ul>
            </Section>

            <Section id="mcp-tools" title="MCP Tools">
              <p>
                <code>humansurvey-mcp</code> 1.0.0 speaks this API. Nine tools:{' '}
                <code>login</code>, <code>get_catalog</code>, <code>list_forms</code>,{' '}
                <code>get_form</code>, <code>create_form</code>, <code>configure_form</code>,{' '}
                <code>get_attribution</code>, <code>list_unresolved</code> and <code>remap</code>.
                The five survey-era tools were deleted rather than shimmed.
              </p>
              <p>
                <strong>1.x is published</strong>, so{' '}
                <code>npx -y humansurvey-mcp</code> fetches a server whose nine tools match this page. Versions below 1.0.0 are the pre-pivot build and call the removed{' '}
                <code>/api/surveys</code> endpoints and will fail — they are deprecated on npm, but a
                pinned version or a stale lockfile still resolves one. Driving the HTTP surface
                directly stays equivalent. <Link href="/faq">/faq</Link> is the one page kept current
                on which version line matches this API; this page will not be updated the moment it
                changes.
              </p>
              <p>
                The tool set is shaped as a read-write loop on a monthly cadence rather than
                configure-once-poll-forever: sign in and store a key, list forms, read the rollup,
                list unresolved free text, remap it, and reconfigure the candidate list and
                expansion policy against where the money went this month. Deliberately absent are
                raw response exports and the identity lookup (a backend job on a schedule, not a
                conversation&rsquo;s), the conversion-event ingest (that arrives from a payment
                webhook), and anything destructive.
              </p>
            </Section>

            <Section id="markdown-syntax" title="Markdown syntax — removed">
              <p>
                <strong>This capability no longer exists.</strong> The Markdown survey syntax and
                the LLM endpoint that translated it are gone, along with the five question types
                they described (<code>single_choice</code>, <code>multi_choice</code>,{' '}
                <code>text</code>, <code>scale</code>, <code>matrix</code>) and the whole{' '}
                <code>/api/surveys</code> surface. A form is now a JSON graph of ask nodes and
                candidates, configured with{' '}
                <code>PUT /api/attribution/forms/{'{id}'}</code> — see{' '}
                <a href="#json-schema">Form config</a>.
              </p>
            </Section>

            <Section id="conditional-logic" title="Conditional logic — removed">
              <p>
                <strong>This capability no longer exists.</strong> <code>showIf</code> and its{' '}
                <code>eq</code> / <code>neq</code> / <code>contains</code> / <code>answered</code>{' '}
                operators are gone, as is the <code>show if:</code> Markdown block. The one
                conditional behaviour that survives is candidate expansion: a candidate carrying{' '}
                <code>expands: &quot;&lt;node id&gt;&quot;</code> reveals that node in place when it
                is picked, which is how the follow-up question works — see{' '}
                <a href="#json-schema">Form config</a>.
              </p>
            </Section>
          </div>
        </div>
      </div>
    </main>
  )
}
