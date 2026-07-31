'use client'

import { useState } from 'react'

import { CandidatePicker, type PickAnswer } from '@/components/attribution/CandidatePicker'
import { orderCandidates } from '@/lib/attribution/order'
import type { AskNode, Candidate } from '@/lib/attribution/schema'
import {
  DEFAULT_CHANNEL_SLUGS,
  getPlatform,
  markUrl,
  tileColor,
} from '@/lib/catalog/platforms'

/**
 * The homepage proof: the real respondent picker, on the real catalog, usable.
 *
 * It imports components/attribution/CandidatePicker rather than reproducing it, because
 * the claim being made is §3.2's — "recognition all the way down, no reading
 * comprehension at any step" — and the only way to demonstrate that is to let someone
 * scan a row of logos and notice afterwards that they never read a line. A screenshot
 * cannot do that, and a hand-built lookalike would drift from the thing it depicts the
 * first time the picker changes.
 *
 * Nothing here talks to the API. There is no form id to POST to, no account, and nothing
 * persisted; `onPick` sets local state. That is stated on the card, because a visitor who
 * suspects they just sent us a data point will not click twice.
 */

const CREATOR_NODE_ID = 'creator'

/**
 * Fabricated, and the same three names the docs and the MCP README use, so a reader
 * moving between the three pages sees one example rather than three.
 *
 * They carry no `icon_url`: a real caller supplies avatars (§4 — resolving people is the
 * caller's job, not ours), and inventing three faces for a marketing page would be the
 * one thing on this card that is not the real component doing its real job. The monogram
 * tile is the honest fallback and is the path most caller-supplied candidates take, since
 * avatars are the caller's to provide.
 */
const CREATORS: Candidate[] = [
  {
    id: 'oecuid_8f21',
    label: 'Jade',
    handle: '@jade.work0',
    // Aliases are matched and never displayed (§3.4). Try "office" in the box.
    aliases: ['the one who does the office skits', 'office girl'],
  },
  { id: 'oecuid_1c07', label: 'Diego', handle: '@diego.conversa', aliases: ['the accent guy'] },
  { id: 'oecuid_4b93', label: 'Nico', handle: '@nico.translate', aliases: ['translation'] },
  { id: 'creator_dunno', label: "I don't remember who", pinned: 'end', dont_remember: true },
]

/**
 * Built from the product-owned catalog the same way `configure` builds it — label, mark
 * and aliases copied off the platform, slug kept for provenance. A slug that leaves the
 * catalog drops its row instead of throwing: this card is illustrative, so a missing
 * channel costs a logo here, where in a real config it is a validation error the caller
 * has to see.
 */
const CHANNELS: Candidate[] = DEFAULT_CHANNEL_SLUGS.flatMap((slug) => {
  const platform = getPlatform(slug)

  if (!platform) {
    return []
  }

  return [
    {
      id: slug,
      catalog_slug: slug,
      label: platform.label,
      icon_url: markUrl(platform) ?? undefined,
      tile_color: tileColor(platform) ?? undefined,
      aliases: platform.aliases ? [...platform.aliases] : undefined,
      // Only TikTok, deliberately. §10.4: the follow-up is the respondent's one extra
      // click and only spend-heavy channels earn it, so a visitor who picks Google
      // finishing in one step is the product behaving correctly, not the demo running
      // out of content — the readout says so rather than leaving it to be guessed.
      expands: slug === 'tiktok' ? CREATOR_NODE_ID : undefined,
    },
  ]
})

const CHANNEL_NODE: AskNode = {
  id: 'channel',
  prompt: 'Where did you first hear about us?',
  candidates: [
    ...CHANNELS,
    { id: 'dunno', label: "I don't remember", pinned: 'end', dont_remember: true },
  ],
  allow_free_text: true,
  order: 'rotate',
}

const CREATOR_NODE: AskNode = {
  id: CREATOR_NODE_ID,
  prompt: 'Which account was it?',
  candidates: CREATORS,
  allow_free_text: true,
  order: 'rotate',
}

/**
 * One fixed seed for both nodes.
 *
 * `orderCandidates` is pure, so a constant seed produces the same permutation on the
 * server render and again at hydration. A per-visit seed would not: this exact component
 * once threw away its server HTML and reshuffled the list under the cursor because the
 * two renders disagreed about the order. Rotation is still what a real respondent gets —
 * every respondent's `render_id` differs, which is what makes the raw share unbiased —
 * but a page whose list reorders on every reload is unscreenshottable and reads as a bug.
 *
 * The value is chosen rather than arbitrary. Its permutation puts a marked row second and
 * keeps logo-bearing rows at the top of the list, so the scan the section below claims
 * happened actually can — a seed that buried TikTok at row eleven made the follow-up, the
 * one thing this card exists to demonstrate, something a visitor had to hunt for.
 */
const DEMO_RENDER_ID = 'scan'

const ORDERED_CHANNELS = orderCandidates(
  CHANNEL_NODE.candidates,
  CHANNEL_NODE.order,
  DEMO_RENDER_ID,
)
const ORDERED_CREATORS = orderCandidates(
  CREATOR_NODE.candidates,
  CREATOR_NODE.order,
  DEMO_RENDER_ID,
)

type PickerDemoProps = {
  /**
   * Mount with TikTok already chosen, so the follow-up — the thing that makes the answer a
   * creator instead of a platform — is on screen without a click. The homepage hero uses
   * this; the trade is real and was decided deliberately. Starting collapsed lets a visitor
   * feel the scan ("you did not read that list, you recognised it"), which is the argument
   * for the long catalog. Starting expanded shows the wedge, which is the argument for the
   * product. The hero has one screen and the wedge wins; the scan is still available to
   * anyone who resets.
   */
  startExpanded?: boolean
}

export function PickerDemo({ startExpanded = false }: PickerDemoProps) {
  // Deterministic, so the server and the client compute the same initial state. An earlier
  // version of this file seeded a random value in a useState initializer, which runs on both
  // and produced a hydration mismatch.
  const [channel, setChannel] = useState<PickAnswer | null>(
    startExpanded ? { candidate_id: 'tiktok' } : null,
  )
  const [creator, setCreator] = useState<PickAnswer | null>(null)
  /**
   * Bumped by "Start over" only, and used as the channel picker's key.
   *
   * The picker has no `value` prop — it owns its committed row internally — so clearing
   * our state is not enough to clear its checkmark; the component has to be replaced.
   * Bumping this on every pick instead of only on reset is a bug that already happened
   * here: the first question's answer visibly un-checked itself the moment the follow-up
   * appeared beneath it, which is precisely the thing §3 wants on screen while the second
   * question is being answered.
   */
  const [run, setRun] = useState(0)

  const picked =
    channel !== null && 'candidate_id' in channel
      ? CHANNELS.find((candidate) => candidate.id === channel.candidate_id)
      : undefined
  const expandsTo = picked?.expands

  function pickChannel(answer: PickAnswer) {
    setChannel(answer)
    setCreator(null)
  }

  return (
    // min-w-0 because this card is a grid item on the homepage and a candidate row's
    // label is `truncate`, i.e. nowrap: without it the card's min-content width is the
    // longest label in the catalog and it drags the page wider than a phone.
    <div className="min-w-0 rounded-[1.5rem] border border-[var(--panel-border)] bg-white/85 p-5 shadow-[0_28px_90px_-68px_rgba(14,23,38,0.38)] backdrop-blur sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
          Try it — this is the whole form
        </p>
        {channel ? (
          <button
            type="button"
            onClick={() => {
              setChannel(null)
              setCreator(null)
              setRun((current) => current + 1)
            }}
            className="shrink-0 text-[12px] text-stone-600 underline decoration-dotted underline-offset-4 transition hover:text-stone-900"
          >
            Start over
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        <CandidatePicker
          key={`channel-${run}`}
          node={CHANNEL_NODE}
          ordered={ORDERED_CHANNELS}
          onPick={pickChannel}
          // Only on the very first render. `run` increments on Start over, and the key
          // change remounts the picker — passing this unconditionally would make Start
          // over put the answer straight back.
          initialPick={startExpanded && run === 0 ? 'tiktok' : undefined}
        />
      </div>

      {expandsTo === CREATOR_NODE_ID ? (
        // Appended below the answered question rather than replacing it, exactly as the
        // respondent flow does it: the first answer stays on screen with the follow-up
        // under it, so nothing reads as "page 2 of ?".
        <div className="mt-7">
          <CandidatePicker
            // Keyed on which channel opened it, so switching from TikTok to something
            // else and back arrives blank rather than still holding the last creator.
            key={`creator-${run}-${picked?.id ?? ''}`}
            node={CREATOR_NODE}
            ordered={ORDERED_CREATORS}
            onPick={setCreator}
            // Never autofocused here. On the respondent page a follow-up takes focus
            // because the person has already engaged; on a homepage it would scroll the
            // page out from under someone who was reading the headline.
            autoFocusSearch={false}
          />
        </div>
      ) : null}

      <Readout channel={channel} creator={creator} expanded={expandsTo === CREATOR_NODE_ID} />
    </div>
  )
}

/**
 * What the host page would have received, and what the answer means.
 *
 * The payload is the real one — `answers` keyed by node id, carrying the single node just
 * answered, which is what the embed's `submitted` / `completed` messages deliver. No
 * counts, shares or revenue appear anywhere on this card: those would be invented
 * numbers, and the product's whole argument is that a number should ship with the thing
 * that says how wrong it might be.
 */
function Readout({
  channel,
  creator,
  expanded,
}: {
  channel: PickAnswer | null
  creator: PickAnswer | null
  expanded: boolean
}) {
  const lines: string[] = []

  if (channel) {
    lines.push(payload('channel', channel))
  }

  if (creator) {
    lines.push(payload(CREATOR_NODE_ID, creator))
  }

  return (
    <div className="mt-6 border-t border-[var(--panel-border)] pt-4">
      {lines.length > 0 ? (
        <pre className="overflow-x-auto rounded-xl bg-[var(--code-surface)] px-4 py-3 text-[12px] leading-6 text-[var(--accent-fg)]">
          <code>{lines.join('\n')}</code>
        </pre>
      ) : null}

      <p className="mt-3 text-[13px] leading-6 text-stone-600">
        {note(channel, creator, expanded)}
      </p>

      <p className="mt-2 text-[12px] leading-5 text-stone-600">
        Nothing on this card is sent anywhere — no account, no request, nothing stored. The
        logos, labels and aliases are the ones the API serves from{' '}
        <a
          href="/api/attribution/catalog"
          className="underline decoration-dotted underline-offset-2 hover:text-stone-800"
        >
          /api/attribution/catalog
        </a>
        .
      </p>
    </div>
  )
}

/**
 * One line of `answers`, spelled the way /docs and llms.txt spell it — keyed by node id,
 * one node per message. Formatted by hand rather than by `JSON.stringify(obj, null, 2)`
 * because the documented form is a single line with spaces inside the braces, and a
 * reader who copies this into a `postMessage` handler should be looking at the same shape
 * on both pages. An answer carries exactly one key by construction (§5.3), so taking the
 * first entry is not an assumption about well-formed input.
 */
function payload(nodeId: string, answer: PickAnswer): string {
  const [key, value] = Object.entries(answer)[0]

  return `{ "${nodeId}": { "${key}": ${JSON.stringify(value)} } }`
}

function note(channel: PickAnswer | null, creator: PickAnswer | null, expanded: boolean): string {
  if (!channel) {
    return 'Twelve channels and an escape hatch. Pick one, or type something that is not listed — there is no "Other" option, because one more click is one more nudge toward picking something wrong.'
  }

  if ('dont_remember' in channel) {
    return "Counted in its own bucket, not folded into a channel. It stays visible and never gets sorted away for a reason: with a list in front of them, people who do not remember will otherwise pick something, and noise wearing the costume of signal is worse than a smaller sample."
  }

  if ('raw' in channel) {
    return 'Free text is stored verbatim and never normalized on the way in. Later, one mapping points that string at a real candidate and every past month that contained it is recomputed — no backfill, no editing the response.'
  }

  if (expanded && creator === null) {
    return '"TikTok" was never the answer. Six ambassador accounts collapse into that one string, and every conclusion drawn from it is noise — so the second question arrives in place, with no page transition. Try typing "office".'
  }

  if (expanded) {
    return 'Two answers, one form, no page ever changed. This is the granularity the rest of the category cannot reach: not the platform, the account.'
  }

  return 'Done in one step — this channel has no follow-up configured, which is the correct answer for most of them. The respondent gets one extra click only where the money is, and which channels earn it is the knob an agent retunes each month.'
}
