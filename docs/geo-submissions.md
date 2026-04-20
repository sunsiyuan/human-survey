# GEO submission pack

Ready-to-paste copy for external directories and launch channels. Each entry below is self-contained — open the target URL, paste the copy, submit. These drive backlinks (Google/Bing) and in-context mentions (LLMs), which together are the main non-content GEO lever after the site itself is in good shape.

Order suggestion: (1) awesome-mcp-servers, (2) PulseMCP, (3) Product Hunt, (4) Show HN. The first two are always-on and compound; PH + HN are time-bounded launches.

---

## 1. awesome-mcp-servers (GitHub)

**Where:** https://github.com/punkpeye/awesome-mcp-servers — fork, edit README, open PR.

**Section:** Under a "Feedback / Surveys" or "Collaboration" bucket depending on current structure. If no fitting section exists, propose one in the PR description.

**Entry (paste as a new list item):**

```markdown
- [HumanSurvey](https://github.com/sunsiyuan/human-survey) - Feedback collection infrastructure for AI agents. Agents create surveys from JSON schema, humans respond at a hosted URL, agents retrieve structured results via MCP tools (`create_survey`, `get_results`, `create_key`). Use for community feedback, post-launch surveys, event retros. TypeScript · MIT.
```

**PR description:**

```markdown
Adds HumanSurvey to the list.

HumanSurvey is feedback-collection infrastructure purpose-built for AI agents: an agent sends a JSON schema, gets back a shareable respondent URL, and later pulls aggregated structured results. The MCP package is `humansurvey-mcp` on npm.

Typical use cases: community managers running post-AMA feedback, indie makers surveying early users after a launch, event organizers collecting session ratings. Unlike Typeform or Google Forms, the consumer of the response data is an agent, not a human operator reading a dashboard.

- Site: https://www.humansurvey.co
- Repo: https://github.com/sunsiyuan/human-survey
- npm: https://www.npmjs.com/package/humansurvey-mcp
- Docs: https://www.humansurvey.co/docs
```

---

## 2. PulseMCP

**Where:** https://www.pulsemcp.com/submit (or whatever their current submission URL is — check the footer).

**Fields to fill:**

- **Name:** HumanSurvey
- **Package name:** `humansurvey-mcp`
- **Repository:** https://github.com/sunsiyuan/human-survey
- **Category:** Collaboration / Feedback
- **Short description (≤160 chars):** `Feedback collection for AI agents — agents create surveys, humans respond, agents read structured JSON results.`
- **Long description:**

```
HumanSurvey is feedback-collection infrastructure for AI agents. An agent sends a JSON schema describing what it wants to learn; HumanSurvey hosts a minimal respondent form at /s/{id}; when answers accumulate, the agent pulls structured JSON results back.

Typical workflows:
- Community / brand managers running post-AMA or post-drop feedback from Discord / Slack / Telegram members
- Indie makers surveying early users after a product launch
- Event organizers collecting per-session ratings and retro input

MCP tools:
- create_key — self-provision an API key (no human setup)
- create_survey — generate a survey from a JSON schema
- get_results — retrieve aggregated + raw response JSON
- list_surveys, close_survey

Distribution is the agent's or user's job — HumanSurvey returns a share link, it does not email-blast on your behalf. Narrow scope is deliberate.
```

---

## 3. Product Hunt launch

**Where:** https://www.producthunt.com/posts/new

**Timing:** Tuesday–Thursday, 00:01 PST to maximize the 24-hour voting window.

**Name:** `HumanSurvey`

**Tagline (≤60 chars):** `Let your AI run the feedback loop end to end`

**Description:**

```
HumanSurvey is feedback collection built for the AI-native era. Tell Claude (or any MCP-compatible agent) what you want to learn from your community, customers, or event attendees. It designs the survey, hands you a share link, and reports back once responses land.

Works with: Claude Code, Claude Desktop, Cursor, Cline, any MCP client, and plain REST for custom agents.

Open source, MIT. https://github.com/sunsiyuan/human-survey
```

**First comment (pin this):**

```
Hi Product Hunt! Maker here.

I built HumanSurvey because I kept watching community managers and indie makers do the same ritual — open Typeform, rebuild a rating form from scratch, share the link, chase responses in Discord, then paste everything into a spreadsheet to spot themes. Meanwhile the AI agent in their workflow is already capable of designing, running, and synthesizing that whole loop.

HumanSurvey is the missing piece: a small JSON-schema-driven survey API with an MCP server, so the agent can do all three steps. The hosted form is intentionally minimal — the whole point is that the AI consumes the structured results, not a human reading a dashboard.

What it is NOT: a Typeform replacement for PMs who like fancy form builders. Use Typeform if a human is going to read the responses. Use HumanSurvey if an agent is.

Happy to answer questions. The worked community-feedback walkthrough is at https://www.humansurvey.co/use-cases/community-feedback if you want the full loop end-to-end.
```

**Gallery assets needed:**
- Hero image (1270×760): landing page hero screenshot
- Video (≤60s): show the AMA-feedback example from the /use-cases/community-feedback page being run live in Claude Code

---

## 4. Show HN

**Where:** https://news.ycombinator.com/submit

**Timing:** Weekday morning US time (around 8–10 AM EST) for best Show HN placement.

**Title:** `Show HN: HumanSurvey – feedback collection built for AI agents, not PMs`

**URL:** `https://www.humansurvey.co`

**Text (HN shows this under the title when submitted via Ask HN / Show HN):**

```
HumanSurvey is a small open-source service that flips the usual survey assumption: instead of a human building a form in a visual editor and reading responses in a dashboard, an agent generates a JSON schema, a group of humans answers at a hosted URL, and the agent pulls structured results back.

Why I built it: community managers and indie makers already have Claude (or Cursor, etc.) in their workflow. They want to ask "what did people think of the AMA?" and have the AI actually do the loop — design the form, let them share it, synthesize the results. A hosted form with a nice dashboard is the wrong shape for that; the right shape is a schema-in / JSON-out API with just enough hosted UI for respondents.

- MCP server (`humansurvey-mcp` on npm) so Claude Code / Claude Desktop / Cursor / Cline can drive it natively.
- REST API with bearer auth for non-MCP agents.
- Intentionally narrow: no form builder UI, no analytics dashboards, no email distribution. The service returns a share link; distribution is your or your agent's job.
- Supports single_choice, multi_choice, text, scale, matrix, plus conditional `showIf` logic. Survey expiry + max-response caps + webhooks on close.

Happy to get pushback on scope choices — especially the deliberate decision not to do distribution or visual theming. Details on those calls live in the FAQ and TASKS roadmap.

Repo: https://github.com/sunsiyuan/human-survey
Worked walkthrough: https://www.humansurvey.co/use-cases/community-feedback
```

---

## 5. Twitter / X launch thread (optional amplifier)

**Thread (8 tweets):**

1. `HumanSurvey is live. Feedback collection built for the AI-native era — your agent designs the form, you share the link, the agent reads the results. https://www.humansurvey.co`
2. `The old loop: open Typeform, rebuild a rating form from scratch, chase responses, paste into a sheet, squint at 180 rows to find themes. An hour of work. Five days of calendar time.`
3. `The new loop: tell Claude "send community members a 3-question feedback form after Friday's AMA." It writes the schema, hands you /s/abc123. Next morning: "how did it land?" → synthesis grounded in real JSON.`
4. `MCP-native from day one. Works with Claude Code, Claude Desktop, Cursor, Cline, any MCP client. REST API for custom agents.`
5. `What it is NOT: a Typeform replacement for PMs who like fancy form builders. The hosted form is intentionally minimal — the whole point is an agent consumes the results, not a human in a dashboard.`
6. `Intentionally narrow: no email blast, no visual theming, no analytics UI. We return a link; distribution is your or your agent's job. Scope discipline is a feature.`
7. `Worked walkthrough for community managers: https://www.humansurvey.co/use-cases/community-feedback`
8. `Open source, MIT, active development. Feedback welcome — especially on the scope calls. https://github.com/sunsiyuan/human-survey`

---

## 6. Indie Hackers post (optional)

**Where:** https://www.indiehackers.com/post/new

**Category:** "Ship It" or "Share Your Work"

**Title:** `Built HumanSurvey: feedback collection for when your AI runs the loop`

**Body:** Condensed version of the Show HN text, written in the IH voice (more personal, less dry). Focus on the indie maker use case since that's the audience.

---

## Checklist

- [ ] awesome-mcp-servers PR opened
- [ ] PulseMCP listing submitted
- [ ] Glama listing ✅ (already done — glama.json in repo)
- [ ] Smithery listing submitted (check https://smithery.ai)
- [ ] Product Hunt scheduled (Tue–Thu, 00:01 PST)
- [ ] Show HN post submitted (weekday 8–10 AM EST)
- [ ] Twitter thread scheduled
- [ ] Indie Hackers post (optional)
- [ ] Reddit r/ClaudeAI + r/LocalLLaMA + r/MachineLearning (optional — read rules first)

## What NOT to do

- Don't submit to "general SEO" directories (DA-boosting link farms). Waste of time, can hurt.
- Don't submit the same copy to every directory — they get de-duped. Vary the lead sentence.
- Don't game the submission ordering (vote rings on PH / HN will get you banned). Launch and let it ride.
