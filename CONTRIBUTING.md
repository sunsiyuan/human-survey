# Contributing

## Before You Open a PR

HumanSurvey has a deliberately narrow scope. Read [README.md](README.md) before investing time in a contribution.

**Contributions that will be merged:**
- Parser bug fixes and edge case handling
- Multilingual keyword detection (currently only detects Chinese 可多选/多选; other languages welcome)
- Security improvements (auth, input validation)
- Performance improvements
- Documentation and example improvements
- Bug fixes on any existing feature

**Contributions that will not be merged** (not because they're bad ideas, but because they're outside this project's scope):
- New question types that are UI variants (`dropdown`, `likert`, `nps`, `star_rating` — these are covered by existing semantic types)
- Visual survey builder or editor
- Survey templates or template library
- Email distribution features
- File upload, payment, or signature question types
- Analytics or reporting UI (AI agents read results via API)
- Anything that targets human survey designers rather than AI agents

If you're unsure whether your contribution fits, open an issue first.

---

## Setup
```bash
pnpm install
pnpm dev
```

## Branch conventions
- `feat/<name>` — new features
- `fix/<name>` — bug fixes
- Always PR into `main`, never push directly

## Commit messages
- `task N: short description` (during initial build)
- `feat: description` / `fix: description` (after v0.1.0)

## Testing
- Parser: `pnpm --filter @mts/parser test`
- Web/API: `pnpm build`
