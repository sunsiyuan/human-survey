# humansurvey-mcp

MCP server for [HumanSurvey](https://www.humansurvey.co) — the agent interface to
self-reported attribution: which channel, and which creator, your users first heard about
you from.

The channels that matter most are the ones analytics cannot see. TikTok in-app, Instagram,
podcasts, Slack groups, word of mouth, ChatGPT — none of them send a referrer. Asking the
person is the only signal that survives all of them, so HumanSurvey puts a two-question form
in a flow you own and your agent reads the answers back as structured data.

## Setup

```json
{
  "mcpServers": {
    "humansurvey": {
      "command": "npx",
      "args": ["-y", "humansurvey-mcp"],
      "env": { "HUMANSURVEY_API_KEY": "hs_sk_..." }
    }
  }
}
```

Get a key by signing in at [humansurvey.co/signin](https://www.humansurvey.co/signin) and
copying one from `/account`.

> **Version note:** the `1.x` line is what matches the current API. Anything below `1.0.0` is
> the pre-pivot build, whose tools call `/api/surveys` routes that no longer exist; those
> versions are deprecated on npm, but a pinned version or a stale lockfile still resolves one.
> Pin `^1` if you pin at all.

That is the whole human part — paste it here, and everything after is your agent's job.

If you would rather not open a browser, ask your agent to use the `login` tool. It mails a
six-digit code, you read it out, and the key is stored at `~/.humansurvey/credentials`
(mode 0600) where the server picks it up automatically. The key is never printed into the
conversation. That is deliberate, and it is the reason `login` exists in this shape: the
version this replaces printed a key and asked you to save it, so the only copy lived in a
transcript — and transcripts end.

## Then say what you run

> "Set up attribution for my checkout page. My channels are Google, ChatGPT, LinkedIn,
> TikTok and word of mouth, and for TikTok ask which of these three accounts:
> @jade.work0, @diego.conversa, @nico.translate."

Your agent reads the platform catalog, creates the form, writes the candidate lists, and
hands back a URL to embed. A month later: *"how did last month look?"*

## Tools

| Tool | What it does |
|---|---|
| `login` | Signs in with an email and a six-digit code; stores a key on this machine |
| `get_catalog` | The platforms HumanSurvey knows: slugs to use as catalog_slug, labels, and channel class |
| `list_forms` | The account's forms: status, whether configured, response count |
| `get_form` | One form's settings and the question configuration respondents are seeing |
| `create_form` | Creates a form and returns its id and respondent URL |
| `configure_form` | Sets the questions and candidates; stored as a new immutable version |
| `get_attribution` | The rollup: counts, shares with their bases, unresolved answers, follow-up coverage, revenue |
| `list_unresolved` | The answers people typed instead of picking, grouped and counted |
| `remap` | Records that a typed answer means a specific candidate — retroactively |
| `revoke_remap` | Stops a mapping applying, in past windows as well as future ones. The mapping is kept, not deleted |

Deliberately absent: raw response exports and the identity lookup (a backend job on a
schedule, not a conversation's), the conversion-event ingest (that comes from your payment
webhook), and anything that deletes a form or a response.

## What the rollup will and will not tell you

Shares are always reported as `2 of 7 — 29%`, never as a bare percentage. The base differs
per question — it is the number of completed responses that answered *that* question — and
unresolved answers stay inside the base rather than being quietly dropped from it. A
percentage without its base is a number a reader will misread, and the usual misreading
inflates every channel by hiding the people who did not remember.

`share_corrected`, `position_effect` and `calibration` come back as null rather than
computed. Candidate order is randomized per respondent by default, which already makes the
raw shares unbiased, so the position correction would only serve someone who pins the order
instead.

## Environment

| Variable | Purpose |
|---|---|
| `HUMANSURVEY_API_KEY` | Your key. Falls back to `~/.humansurvey/credentials`. |
| `HUMANSURVEY_API_URL` | Override the API base. Defaults to `https://www.humansurvey.co`. |

## Notes

The package stays named `humansurvey-mcp`, and the registry entry stays
`io.github.sunsiyuan/human-survey`, even though the product no longer calls itself a survey
tool: the package name sits inside every existing user's MCP config, and `mcpName` is the
link proving npm and registry ownership are the same party.

`1.0.0` is a clean break from `0.x`. The old tools — `create_survey`, `get_results`,
`list_surveys`, `close_survey`, `create_key` — are gone along with the API they spoke to.
See [the changelog](https://www.humansurvey.co/changelog).

## Links

- API docs: <https://www.humansurvey.co/docs>
- Agent-readable overview: <https://www.humansurvey.co/llms.txt>
- Source: <https://github.com/sunsiyuan/human-survey>

## License

MIT
