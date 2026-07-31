# HumanSurvey — find out where your signups actually come from

Canonical: https://www.humansurvey.co

TikTok in-app, Instagram, podcasts, Slack groups, word of mouth, ChatGPT: none of them send a referrer, so your analytics files them all under Direct. Ask the person instead, inside your own signup or payment flow — and ask a second question in place, so the answer is **Jade, @jade.work0** and not **TikTok**.

Six ambassador accounts collapse into one string, and every conclusion drawn from that string is noise. Granularity is the entire point: which account, which show, which event.

> This page is the markdown twin of the homepage. The page itself demonstrates — a live picker, and the sentence you say to your agent — and this carries the argument in full, including the parts the page states in one line. Nothing here is a summary of the page; where the page was cut, the text was moved here verbatim.

---

## Why asking is the only instrument that reaches these channels

Direct is not a channel. It is the bucket for every visit that arrived without a referrer your analytics could read, and typing the domain from memory is only one way to land in it. A link opened inside an app's own browser, a link carrying `rel="noreferrer"`, a redirector that drops the header, a URL pasted into a chat, an email, a PDF or a slide, a QR code, a mobile app handing the URL to the operating system — none of these are misconfigurations you can correct, and no analytics vendor can correct them either. The information was destroyed before the request reached you.

Even when a referrer survives, current browsers default to `strict-origin-when-cross-origin`, which sends the origin and nothing more. You learn reddit.com and not which thread, tiktok.com and not which account.

## Why the question is asked with logos, and why the list is long

Brand names carry logos, and a logo is recognized rather than read — which is what makes a twelve-row list affordable where eight rows of "social media" and "online ad" would not be. Logos, then avatars: recognition all the way down, no reading comprehension at any step, and no taxonomy for anyone to translate their memory into.

That is also why the list is long. **A channel you leave off does not cost you one data point** — its people pick something else, so you lose that channel *and* book a false entry against another one.

Order is randomized per respondent for the same reason: options shown first get picked more, and an attribution tool that sorts by spend would keep confirming last month's budget.

There is no "Other" option. One more click is one more nudge toward picking something wrong; typing your own answer is a row like any other.

## Two placements, and a number neither one gives alone

One embed each, in flows you already own — an iframe and a `postMessage` listener, sized to the host page and themed to match it.

**Your payment or upgrade flow.** The answer arrives already joined to revenue. The person just paid, so you know what they are worth without installing any conversion tracking. Motivation peaks right after a commitment, and the confirmation screen is dead space anyway. "This channel produced a quarter of last month's new revenue" is the sentence a budget holder acts on.

**Your signup flow.** The only way to see the people a channel sends who never pay. Ask at payment alone and you can never learn that a channel delivers volume that does not convert — which is exactly the judgment that kills a bad line item. Ask early in the flow, too: memory decays, and asking later means asking only the people who stayed.

**Together.** A channel that is 30% of your signups and 12% of your payers is being flattered by the signup number. Divide a channel's share of the paying population by its share of the signup population: above 1 it converts better than your average, below 1 worse. Multiply that ratio by your overall signup-to-paid rate and you have **that channel's own conversion rate** — for a channel that sends no referrer and appears nowhere in your analytics. Two forms, one question each. Nobody else produces this, because nobody else asks twice.

The ratio on its own is an index against your average, not a rate. Reading it as one is a mistake this site published before it caught it; see /changelog.

## The shares are honest

Every share ships with the base it was computed over, and the people who skipped or did not remember stay inside that base instead of quietly disappearing from it. A percentage without its denominator gets misread, and the usual misreading flatters every channel at once.

## "I would just add a text field"

Sometimes you should. If a person is going to read the answers, and there are few enough answers for a person to read, this is overhead and a text field is the cheaper start.

What a text field cannot do is come back. Answers arrive as "the office skits girl" and "that AI guy" and nothing groups them; here one mapping resolves a verbatim string onto a real creator and applies backwards across every past month, so something you work out in month three still reaches months one and two. A field also shows one fixed order to everybody, which makes its shares an artifact of the layout. And it drops its skips out of its own denominator, and it joins to nothing.

## Reach for it when

- The exposure happens somewhere your tracking cannot reach — TikTok in-app, a podcast, a Discord, an AI assistant, one person telling another
- A large share of your signups land as Direct / (not set), and someone is about to make a budget decision on the rest
- Spend is going to named creators, shows or communities, and nobody can say which of them converted
- You need channel numbers you can put next to revenue, not next to sessions
- The same channel needs measuring in two places, because the ratio between the two shares — times your overall signup-to-paid rate — is the only conversion rate you will get for it
- Free text has piled up — "the office skits girl" — and wants resolving to real people, retroactively and across past months

## What it is not

- **Not analytics.** It sees no sessions, no pageviews, no paths, and it does not deduplicate against your traffic. One answer per person, given by that person.
- **Not a form builder.** One question, with one follow-up where you want it. NPS, CSAT, post-event feedback and open-ended research are the wrong tool — that capability was removed, not hidden behind a plan.
- **Not multi-touch attribution.** First touch only. Last touch is near-constant — people search your brand name — and buys no media decision worth the completion rate it costs.
- **Not a dashboard.** You sign in once to get a key, and that is the whole of the signed-in area. There is no results screen to browse — the aggregates are an API resource and your agent is the reader.
- **It cannot tell you what a person did.** Only what they say they remember. Skipping is allowed, "I don't remember" is always on screen, and both come back as their own buckets rather than being folded into a channel to make the chart look decisive.
- **Not the source of record for a channel with its own console.** Google and LinkedIn already count their own conversions, and no self-report will beat that number. They are still in the default list deliberately: a channel with ground truth is the only way to find out how much self-reporting under-reports, since its console gives you the denominator the survey's own recall is measured against. That coefficient is what makes the channels reporting nothing worth planning against — it is not computed yet, and ships as an explicit null until it is.
- **It never contacts your audience.** It returns a URL and an iframe that renders where you put it. Reaching people is your job or your agent's, because reaching them requires access to them, and that access is yours.

## The reads

- `GET /api/attribution/rollup` — every channel and every creator for any window, each share beside the base it was computed over, with the unresolved buckets in the same list. https://www.humansurvey.co/docs#rollup
- `GET /api/attribution/forms/{id}/responses?since_seq=…` — the answers themselves, one row per person, deltas only. The form never closes, so there is no terminal state to poll for. https://www.humansurvey.co/docs#async-results
- `external_id` — your own user id, passed in with the answer. Push your payment events against it and channel × heads becomes channel × revenue. https://www.humansurvey.co/docs#events

## Hand your agent a key. That is your half.

Nobody hand-writes a candidate list — your agent does, from what you tell it in a sentence. Which channels you run changes monthly, and so does which of them deserve the follow-up question, so the configuration is a thing an agent maintains rather than a thing you fill in once.

**1. Get a key.** A six-digit code to an address you control, then one call to exchange it — no browser needed, and no anonymous keys. Or tell your agent to run its `login` tool: it does the round trip and writes the key to a file on your machine instead of printing it into the conversation. Transcripts end, which is how keys get lost. https://www.humansurvey.co/signin

**2. Install the MCP server, once.**

```
claude mcp add humansurvey --env HUMANSURVEY_API_KEY=hs_sk_... -- npx -y humansurvey-mcp
```

On npm at `1.x`, ten tools, MIT. Anything below `1.0.0` is the pre-pivot build and is deprecated, so pin `^1` if you pin at all.

**3. Say what you run and where it goes.**

> "Set up attribution for my checkout page. My channels are Google, ChatGPT, LinkedIn, TikTok and word of mouth, and for TikTok ask which of these three accounts: @jade.work0, @transyncai_tom, @nico.translate."

Your agent reads the platform catalog, creates the form, writes the candidate lists and hands back a URL to embed. A month later: "how did last month look?" — and, in the same breath, the three ambassadors you just signed get their own rows, and the channels that stopped earning their follow-up lose it.

## More

- About, and the page to quote from: https://www.humansurvey.co/about (markdown: /about.md)
- Docs — every endpoint, the config schema, the embed contract: https://www.humansurvey.co/docs (markdown: /docs.md)
- FAQ: https://www.humansurvey.co/faq (markdown: /faq.md)
- Use cases, four walkthroughs: https://www.humansurvey.co/use-cases (markdown: /use-cases.md)
- Changelog: https://www.humansurvey.co/changelog (markdown: /changelog.md)
- Agent-readable overview: https://www.humansurvey.co/llms.txt · full index: /llms-full.txt
- OpenAPI 3: https://www.humansurvey.co/api/openapi.json
