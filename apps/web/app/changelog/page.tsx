import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Changelog — HumanSurvey',
  description:
    'What has shipped in HumanSurvey, dated by release — the 2026-07-30 attribution pivot, the MCP rebuild, and every breaking change before them.',
  alternates: {
    canonical: '/changelog',
    // public/changelog.md carries the same entries for agents doing content negotiation.
    // A new entry has to be added in both places; the twin is a static file and cannot read
    // the array below.
    types: { 'text/markdown': '/changelog.md' },
  },
}

type Entry = {
  date: string
  version?: string
  title: string
  items: string[]
}

/**
 * Entries are a record of what shipped on a date, so they are not edited when the thing
 * they describe is later removed — a changelog that rewrites itself cannot be used to work
 * out what a six-month-old integration was built against.
 *
 * What that leaves is the reader who follows an old entry to a URL or a tool that has since
 * been deleted and lands on a 404 with no explanation. So a removal gets its own trailing
 * item, prefixed "Since removed", naming what is gone and where the replacement is. Added,
 * never substituted: the original bullets above it stay verbatim.
 */
const entries: Entry[] = [
  {
    date: '2026-07-31',
    title: 'humansurvey-mcp 1.1.0, and a window bug that produced wrong numbers',
    items: [
      'Fixed — the rollup and the free-text listing each had their own timestamp parser, and they disagreed. A `from` or `to` written as a zoneless date-time ("2026-07-01T00:00:00") was read as UTC by the rollup and as the server host\u2019s local time by the listing, so the same pair of parameters selected different responses on either endpoint. Under a UTC+8 host that moved a month boundary onto the previous calendar day. Plain dates ("2026-07-01") always agreed, which is why this went unnoticed: only a caller who wrote the midnight out in full was affected. One parser now, with tests that assert absolute instants under four timezones.',
      'Added — a revoke_remap tool. The remap tool has been telling agents to "revoke it with that id" since 1.0.0 while no tool could; the HTTP route existed the whole time. Nothing is deleted when you revoke: the mapping is marked revoked and kept, so a report produced while it was live can still be explained.',
      'Fixed — the free-text listing printed that a text was already mapped without printing the mapping id, which is the id revoke_remap needs. It was always on the wire.',
      'Fixed — the MCP formatters now print the API\u2019s notes verbatim instead of two hand-copied paraphrases of them. They print on an empty result too, where they matter most: the likeliest reason a window is empty is that it is not the window you meant.',
      'Fixed — per-candidate revenue is shown. It was returned by the API, discarded by the formatter, and still used to order the rows when you asked for revenue, so the ordering could not be explained from the numbers on screen.',
      'Fixed — a rollup grouped by question labelled each row "(unlabelled)", the same string used for a mapping target no configuration has a name for. It now says "all resolved answers", and only at that grouping.',
      'Fixed — no outbound request had a timeout, so an unresponsive API hung the tool call rather than failing it. Thirty seconds, and a timeout during sign-in says the six-digit code may already be spent instead of implying a free retry.',
      'The MCP registry entry, which is a separate publish from npm, is current again for the first time since May.',
    ],
  },
  {
    date: '2026-07-31',
    title: 'A published number was wrong, and is corrected',
    items: [
      'Corrected — four public surfaces said that a channel\u2019s share of the paying population against its share of the signup population IS that channel\u2019s signup-to-paid conversion rate. It is not. The ratio is conversion(channel) divided by conversion(overall): an index against your own average, not a rate. Multiply it by your overall signup-to-paid rate to get the channel\u2019s own. Fixed on /faq, llms.txt, llms-full.txt, the README, three use-case pages and the homepage.',
      'Corrected — the AI-assistants page opened with an unsourced figure for how much assistant traffic lands in Direct. Cut rather than sourced: a hedge does not travel with a quoted sentence, and the argument does not need the number.',
      'Corrected — a worked example narrated one account as two thirds of a channel while the payload printed 0.531 directly above it. The larger figure came from dropping the respondents who could not name an account, which is the precise error this product exists to prevent. The page now shows the correct figure and names the mistake.',
      'Every fabricated example payload on the site now carries an ILLUSTRATIVE label inside the code block rather than in surrounding prose, because a quoted block leaves the prose behind.',
      'Recorded here rather than fixed quietly. A product whose argument is that most attribution numbers are confidently wrong cannot publish one and then act as though it never did.',
    ],
  },
  {
    date: '2026-07-30',
    version: 'mcp 1.0.0',
    title: 'MCP server rebuilt for attribution — nine tools, and the pre-pivot five are gone',
    items: [
      'packages/mcp-server is 1.0.0 and speaks /api/attribution/*. Nine tools, verified end to end against the live API: login, get_catalog, list_forms, get_form, create_form, configure_form, get_attribution, list_unresolved, remap. That is the read-write loop the configuration actually needs — which channels expand, and which creators are on the list, are monthly decisions about where the money went, not a thing anyone fills in once.',
      'Removed — create_key, create_survey, get_results, list_surveys and close_survey, along with the /api/surveys endpoints they called. close_survey has no successor by design: an attribution form is a perpetual stream, so there is nothing to close.',
      'login replaces create_key and is a different shape on purpose. Called with an email it triggers the six-digit code and returns nothing usable, because the code has to come out of the person’s inbox. Called with the email and the code it stores the key at ~/.humansurvey/credentials and prints only the path. The version this replaces printed the key and asked the human to keep it safe, so the only copy lived in a transcript — and transcripts end, which is how keys got lost.',
      'Not published yet. npm still serves humansurvey-mcp 0.6.0, the pre-pivot build, so npx -y humansurvey-mcp fetches a server whose every tool fails against the current deployment. Publishing is a separate step from building. This supersedes the "no MCP tools ship against the attribution API yet" line in the entry below, which was written earlier the same day; /faq carries the current state of the publish and is the one place kept up to date, so nothing else has to guess.',
    ],
  },
  {
    date: '2026-07-30',
    title: 'Attribution pivot — the survey API is removed and replaced by /api/attribution/* (breaking)',
    items: [
      'The product narrows to one question — how did you hear about us — asked at a granularity that is actually actionable, down to the creator or the piece of content. Everything below follows from that, and most of it is breaking.',
      'Breaking — POST/GET /api/surveys, GET/PATCH /api/surveys/{id}, POST/GET /api/surveys/{id}/responses and POST /api/demo/parse are deleted, not deprecated. The replacement surface is POST/GET /api/attribution/forms, GET/PUT/PATCH /api/attribution/forms/{id}, POST/PATCH /api/attribution/forms/{id}/responses (public, respondent-facing), GET /api/attribution/forms/{id}/responses (cursor reads, plus ?external_id= for one identity), GET /api/attribution/forms/{id}/unresolved, GET/POST /api/attribution/forms/{id}/remaps, DELETE .../remaps/{id}, GET /api/attribution/rollup, POST /api/attribution/events, and GET /api/attribution/catalog (public). The survey noun is gone from the creator API; the respondent URL is still /s/{id}.',
      'Breaking — the Markdown survey syntax, the LLM endpoint that parsed it, and the five question types (single_choice, multi_choice, text, scale, matrix) are gone, as is showIf as a general conditional-logic engine. A form is one single-select question with an optional follow-up; the only conditional behavior left is a candidate declaring expands, which reveals a second candidate set in place. Multi-select is not coming back — "select all that apply" means "select everything", which is no attribution signal at all. The /docs#markdown-syntax and /docs#conditional-logic anchors still resolve, but now to a one-line note saying the capability was removed and what replaced it — fragments are client-side, so no redirect could have protected an inbound link to them.',
      'Breaking — the open / closed / expired / full lifecycle is gone. An attribution form is a perpetual stream: no max_responses, no expires_at, no close_survey, and no survey_closed or threshold_reached webhook, since there is no terminal event left to fire on. What remains is status "active" | "paused" via PATCH /api/attribution/forms/{id}, and bounded windows moved to the read side (from / to on the rollup). Cursor reads survive, now gated on completion — a response becomes visible once the follow-up lands or an abandonment sweep closes it, so every row is emitted exactly once and is final when emitted.',
      'Breaking — the optionId::text fill-in encoding is replaced by a first-class raw answer. Free text is stored verbatim and never normalized at write time, which is what makes it retroactively remappable: POST /api/attribution/forms/{id}/remaps points a raw string at a candidate id, and the rollup recomputes every past window that contained it. Answers are now one of candidate_id, raw, dont_remember, or skipped.',
      'Breaking — the embed submitted postMessage payload changed shape and its id field is renamed: { source: "humansurvey", type: "submitted", formId, responseId, answers }, where formId replaces surveyId. A fifth event joins the contract — mounting, loaded, resize, submitted, completed — because the first answer is now durable before the form is finished. A host that hides the iframe on submitted cuts the respondent off mid-follow-up; route on completed instead.',
      'Breaking — POST /api/keys requires authentication. Anonymous key creation is gone: a key is issued only against a verified six-digit email code (POST /api/auth/code, then POST /api/auth/verify) or an existing key. The frictionless first run it bought was never the real bottleneck — time-to-first-successful-call was — and every key it minted was ownerless from birth, which is why a lost key had no recovery path.',
      'Accounts own data; keys are credentials. Previously the API key was the identity, so losing one lost the data and rotating one lost access to everything the old key had created. Key rotation now orphans nothing: GET /api/keys lists every key on the account with the calling one flagged current, and DELETE /api/keys/{id} revokes a key without touching what it created. Account, keys and billing are the only things behind the login — configuration and results stay API-only.',
      'The database was reset rather than migrated. Old rows were structurally unconvertible in any case: product-minted positional question ids where the new schema needs caller-defined stable ones, and no recorded render order to reconstruct positions from. Nothing was lost — the export taken beforehand showed thirteen API keys, every one a smoke test or a demo run by the owner, and no third-party user at all. Migrations also stop being applied by hand: scripts/migrate.sh runs them through a ledger, and the pre-pivot 001–009 are kept under supabase/migrations/_archive/.',
      'humansurvey-mcp 1.0.0 replaces the whole tool surface. The five old tools — create_key, create_survey, get_results, list_surveys, close_survey — are gone with the API they called; nine attribution tools take their place: login, get_catalog, list_forms, get_form, create_form, configure_form, get_attribution, list_unresolved, remap. npm and the MCP registry publish separately from this deploy, so 0.6.0 may still be what you install for a while; it calls the removed endpoints and will fail. /faq carries the current publish state.',
      'New — theme tokens on a form: accent, radius, font, and dark_mode ("light" | "dark" | "auto"), set at create time or with PATCH. Embedded in a payment flow that belongs to someone else, a form that looks foreign costs completion rate directly. This is a bounded parameter set, not the theme editor that stays out of scope — the FAQ answer that said "Not today" is amended in this release.',
      'New — every response carries external_id, whatever id the host already uses for that person, so POST /api/attribution/events can join revenue to channel and the rollup can report channel × revenue instead of channel × heads. Candidate order is per-respondent randomized by default, which makes the raw share unbiased by construction; where a caller pins the order instead, the correction is not computed yet: share_corrected, position_effect and calibration all ship as explicit nulls with a note, because the estimator needs volume to return anything else and the default randomized order does not need it.',
    ],
  },
  {
    date: '2026-05-22',
    title: 'Embed hardening — response tagging, early mount signal, working key revocation',
    items: [
      'Response tagging — custom (non-reserved) query params on the survey URL, e.g. ?source=pricing&tier=lite, are captured and stored with the response as a metadata object. They surface on every raw[] entry of GET /api/surveys/{id}/responses and as a per-tag breakdown in get_results, so hosts can segment responses by source without a separate analytics event. Sanitized server-side: string keys/values only, at most 20 keys. Migration 008 adds responses.metadata.',
      'Embed mounting signal — the iframe now posts { type: "mounting", surveyId } the instant its HTML is parsed, before the bundle downloads or hydrates. Hosts can show a skeleton during the ~3s cold load instead of a blank spinner; loaded still fires once the form is interactive. The postMessage contract is now four events: mounting, loaded, resize, submitted.',
      'API key revocation fixed — DELETE /api/keys/{id} previously returned 500 for any key that had created a survey (a hard delete violated the surveys.api_key_id foreign key). It now soft-deletes via a revoked_at stamp, and requireAuth rejects revoked keys. Migration 009 adds api_keys.revoked_at.',
      'Embedded surveys no longer log a cross-origin console error in host pages — the Start button skips autofocus when embedded.',
      'Docs — new Embed subsections (Response tagging, Answer payload — the answers payload is now documented per question type), a Key management section under Authentication, and the four-event postMessage contract. OpenAPI, llms.txt, and llms-full.txt all updated.',
      'humansurvey-mcp 0.6.0 — get_results prints a per-tag breakdown across the response set; the published npm package is restricted to dist via a files allowlist.',
    ],
  },
  {
    date: '2026-04-30',
    title: 'Async results loop — cursor reads, expired webhook, threshold notification',
    items: [
      'Cursor reads on GET /api/surveys/{id}/responses — pass since_response_id (the next_cursor from the last call) and the response filters raw to only new entries; aggregates always reflect the full survey.',
      'Response payload gains is_final, completion_reason ("closed" | "max_responses" | "expired"), next_check_hint_seconds (server-computed advisory cadence), and next_cursor.',
      'Webhook fires on all three terminal events — manual close, max_responses reached, expires_at passed — with closed_reason set accordingly. Expired closures detect lazily within seconds of any next interaction (no cron). All deliveries carry an event_id for client-side dedupe.',
      'Optional notify_at_responses field on POST /api/surveys: same webhook_url receives event: "threshold_reached" once when response_count first crosses the threshold (survey stays open). Wakes the agent on "enough signal" without waiting for closure. Requires webhook_url at create time; must be ≤ max_responses if both are set.',
      'Lifecycle stability: manual close clears expires_at so the close cause stays "closed" rather than drifting to "expired"; max-close stays "max_responses" past wall-clock expiry; reopen (PATCH status: "open") clears the completion-webhook fire-once gate so the next close cycle delivers a fresh survey_closed event.',
      'Migration 007 adds responses.seq (BIGSERIAL) so cursor reads are tie-proof across same-microsecond inserts. Migration 006 adds completion_webhook_fired_at, threshold_webhook_fired_at, notify_at_responses with idempotent backfill.',
      'humansurvey-mcp 0.5.1 — get_results accepts since_response_id; create_survey description teaches agents the threshold + cursor patterns and the webhook_url-required-for-threshold rule.',
      'OpenAPI, /docs Async results section, llms.txt, llms-full.txt all updated.',
    ],
  },
  {
    date: '2026-04-20',
    title: 'Topical cluster completion + markdown twins + Organization graph',
    items: [
      'Added two long-form use-case walkthroughs: /use-cases/product-launch (indie maker / PM) and /use-cases/events (conference / meetup organizer).',
      'Each use-case page has an Article JSON-LD node with a dated worked example (schema in → synthesis out).',
      'Shipped markdown twins at /faq.md, /use-cases.md, /use-cases/community-feedback.md, /use-cases/product-launch.md, /use-cases/events.md — served alongside each HTML page for LLM crawlers that prefer markdown.',
      'Wired content negotiation via Next.js alternates.types so well-behaved agents can request the markdown form of any canonical page.',
      'Upgraded the site-wide JSON-LD to a @graph with an Organization node (sameAs: GitHub, npm, Glama) and a SoftwareApplication node linked via publisher — stronger entity signal for search and LLM indexes.',
      'Sitemap now enumerates all HTML routes and .md twin URLs.',
    ],
  },
  {
    date: '2026-04-20',
    title: 'Landing rewrite + FAQ for external-audience personas',
    items: [
      'Retargeted the landing page to community/brand managers and indie makers — external audiences, not internal teams.',
      'Added a /faq page with 11 natural-language Q&As and schema.org FAQPage JSON-LD.',
      'Expanded /llms.txt with user-phrasing examples, comparison vs form builders, and an explicit distribution-boundary statement.',
      'Added a worked community-feedback use case walkthrough at /use-cases/community-feedback.',
    ],
  },
  {
    date: '2026-04-09',
    version: 'v0.2.0',
    title: 'create_key MCP tool — agents self-provision API keys',
    items: [
      'New create_key MCP tool lets agents provision their own HumanSurvey API key with optional owner email and CAIP-10 wallet address.',
      'No human setup required — an agent can bootstrap the full create_survey → get_results loop from a single Claude Code install.',
      'Wallet address captured up front for future x402-style agent-native billing.',
      'Since removed — create_key no longer exists and anonymous key creation with it. A key is issued only against a verified six-digit email code or an existing key, and the MCP tool that does that round trip is now login (2026-07-30, above). The owner-email and wallet_address fields are gone from POST /api/keys.',
    ],
  },
  {
    date: '2026-04-08',
    title: 'Observability, demo hardening, and packaging',
    items: [
      'Daily metrics script + GitHub Actions workflow; Telegram push notifications.',
      'Tagged demo-origin surveys with a source column to keep production metrics clean.',
      'Added Dockerfile and glama.json for Glama MCP directory listing.',
      'Renamed API key prefix from mts_sk_ to hs_sk_ (and all env vars) alongside the HumanSurvey rebrand.',
    ],
  },
  {
    date: '2026-04-07',
    title: 'humansurvey.co launch — schema-only API and agent-first UX',
    items: [
      'Rebranded from markdown-to-survey (MTS) to HumanSurvey; live at humansurvey.co.',
      'Switched to a schema-only API surface — markdown parsing moved to an LLM demo endpoint.',
      'MCP package published as humansurvey-mcp on npm.',
      'Webhooks fire on survey close; mobile layout + copy-button fixes for the demo panel.',
      'Repositioned as "feedback collection for AI agents" end-to-end in docs and product copy.',
    ],
  },
  {
    date: '2026-03',
    version: 'v0.1.0',
    title: 'MVP — markdown to survey, MCP server, results dashboard',
    items: [
      'Initial monorepo (parser + Next.js app + MCP server).',
      'Markdown-to-schema parser with single_choice, multi_choice, text, scale, and matrix question types.',
      'Public respondent page at /s/{id} with localStorage draft recovery.',
      'Results page at /r/{result_id} with live Supabase Realtime updates.',
      'MCP server shipped with create_survey and get_results tools.',
      'Since removed — /r/{result_id} and the realtime results dashboard behind it are gone and that URL is now a 404, not a redirect: there is no human-facing dashboard by design, and aggregates are read from GET /api/attribution/rollup instead (see the 2026-07-30 entries above). The markdown parser, the five question types and both tools named here went with the same release. /s/{id} is the one thing on this list still live.',
    ],
  },
]

/**
 * Until this shipped, the only entities on /changelog were the site-wide Organization and
 * SoftwareApplication from app/layout.tsx — nothing saying the page is a list, that the list
 * is releases, or that each one has a date. A model reading it structurally learned nothing
 * the homepage had not already told it.
 *
 * Everything here is derived from `entries` rather than restated, so the graph cannot claim
 * a release the page does not render, or drift from it after the next edit.
 */
const changelogJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': 'https://www.humansurvey.co/changelog#page',
      url: 'https://www.humansurvey.co/changelog',
      name: 'HumanSurvey changelog',
      description:
        'Dated releases since the MVP, including the 2026-07-30 attribution pivot and every breaking change before it.',
      // The newest entry is the page's own date: a changelog changes when something ships.
      dateModified: entries[0].date,
      publisher: { '@id': 'https://www.humansurvey.co/#org' },
      isPartOf: { '@id': 'https://www.humansurvey.co/#site' },
      about: { '@id': 'https://www.humansurvey.co/#app' },
      mainEntity: { '@id': 'https://www.humansurvey.co/changelog#releases' },
    },
    {
      '@type': 'ItemList',
      '@id': 'https://www.humansurvey.co/changelog#releases',
      name: 'HumanSurvey releases',
      // The page renders newest first. Without this a consumer is entitled to read
      // position 1 as the oldest release, which inverts the whole list.
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: entries.length,
      itemListElement: entries.map((e, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'CreativeWork',
          name: e.title,
          datePublished: e.date,
        },
      })),
    },
  ],
}

export default function ChangelogPage() {
  return (
    <main data-palette="growth" className="min-h-screen bg-[var(--page-gradient)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(changelogJsonLd) }}
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)] hover:text-stone-900"
          >
            ← HumanSurvey
          </Link>
          <div className="flex gap-2">
            <Link
              href="/faq"
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900"
            >
              FAQ
            </Link>
            <Link
              href="/docs"
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900"
            >
              Docs
            </Link>
          </div>
        </header>

        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Changelog
          </p>
          <h1 className="text-4xl tracking-[-0.02em] text-stone-900 sm:text-5xl">
            What&apos;s shipped.
          </h1>
          <p className="text-base leading-[1.7] text-stone-800">
            Dated releases since the MVP. Tracked publicly so humans and agents
            alike can tell the project is alive and moving.
          </p>
        </section>

        <section className="space-y-6">
          {entries.map((e) => (
            <article
              key={e.date + e.title}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-5 py-5 backdrop-blur-sm"
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <time
                  dateTime={e.date}
                  className="font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--accent)]"
                >
                  {e.date}
                </time>
                {e.version ? (
                  <span className="rounded-full border border-[var(--panel-border)] px-2 py-0.5 font-mono text-[11px] text-stone-600">
                    {e.version}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-2 text-lg font-semibold leading-6 text-stone-900">
                {e.title}
              </h2>
              <ul className="mt-3 space-y-2 text-[15px] leading-[1.7] text-stone-800">
                {e.items.map((it) => (
                  <li key={it} className="flex gap-2">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="space-y-3 border-t border-[var(--panel-border)] pt-8">
          <p className="text-sm leading-6 text-stone-600">
            For the live commit log, see the{' '}
            <a
              href="https://github.com/sunsiyuan/human-survey/commits/main"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-stone-900"
            >
              GitHub history
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  )
}
