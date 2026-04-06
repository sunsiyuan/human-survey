# Markdown to Survey (MTS)

Convert Markdown or JSON survey definitions into interactive web surveys for AI agents.

## What is this?

Write your survey in Markdown. We turn it into a live, interactive survey with a shareable link and a real-time results dashboard. Designed to work seamlessly with AI coding assistants like Claude Code.

**Example flow:**
```
You (in Claude Code): "Create a survey from this markdown file"
Claude Code:          Calls MTS → returns a survey URL and survey ID
  → Survey:  https://mts.vercel.app/s/abc123
  → Results: GET /api/surveys/abc123/responses with your API key
```

## Features

- **Markdown-native** — Write surveys in the format you already know
- **One-command publish** — MCP server integration for Claude Code
- **Beautiful UX** — Clean, mobile-first survey experience
- **Live results** — Real-time response dashboard with charts
- **API key auth** — Creator operations are authenticated, respondent submission stays public

## Supported Markdown Syntax

```markdown
# Survey Title

**Description:** Instructions for the respondent.

## Section Name

**Q1. Your question here?**

- ☐ Option A
- ☐ Option B
- ☐ Option C

**Q2. Multi-select question?** (select all that apply)

- ☐ Choice 1
- ☐ Choice 2
- ☐ Choice 3

**Q3. Open-ended question:**

> _______________

| # | Item | Rating |
|---|------|--------|
| 1 | Item A | ☐Good ☐OK ☐Bad |
| 2 | Item B | ☐Good ☐OK ☐Bad |
```

## Quick Start

### Use with Claude Code (MCP Server)

Add to your Claude Code config (`~/.claude.json`):

```json
{
  "mcpServers": {
    "survey": {
      "command": "npx",
      "args": ["-y", "@mts/mcp-server"],
      "env": {
        "MTS_API_KEY": "mts_sk_your_key_here"
      }
    }
  }
}
```

Then in Claude Code:
```
> Create a survey from docs/my-survey.md
```

### Use the API directly

```bash
curl -X POST https://mts.vercel.app/api/keys \
  -H "Content-Type: application/json" \
  -d '{"name":"my claude agent"}'
```

Then create a survey:

```bash
curl -X POST https://mts.vercel.app/api/surveys \
  -H "Authorization: Bearer mts_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"markdown": "# My Survey\n\n**Q1. How are you?**\n\n- ☐ Great\n- ☐ OK\n- ☐ Not great"}'
```

Response:
```json
{
  "survey_url": "https://mts.vercel.app/s/abc123",
  "question_count": 1
}
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js (App Router) |
| Database | Supabase (Postgres + Realtime) |
| Parser | remark (unified ecosystem) |
| Frontend | React + Tailwind CSS + Recharts |
| MCP Server | @modelcontextprotocol/sdk |
| Deployment | Vercel |

## Project Structure

```
├── apps/web/          # Next.js app (API + frontend)
├── packages/parser/   # Markdown → Survey JSON parser
├── packages/mcp-server/ # MCP server for Claude Code
└── docs/              # Architecture docs
```

## Development

```bash
pnpm install
pnpm dev              # Start Next.js dev server
pnpm test             # Run parser tests
pnpm build            # Build all packages
```

## License

MIT
