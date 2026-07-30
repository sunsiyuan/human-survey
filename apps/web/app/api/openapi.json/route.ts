import { NextResponse } from 'next/server'

/**
 * The published OpenAPI document, hand-written.
 *
 * Nothing regenerates this file, so it is a second description of the routes under
 * app/api/ that can drift from them silently. Two rules keep the drift bounded: every
 * field named here is read off the route or the lib module that produces it, and an
 * endpoint that is public says so in the first clause of its description — an agent that
 * mistakes the respondent write path for an authenticated one builds a browser client
 * that ships an API key.
 *
 * VERSION SOURCE OF TRUTH: packages/mcp-server/package.json. `info.version` here and
 * both `version` fields in server.json mirror it; the npm package version is the only
 * one a consumer can observe independently, so it wins any disagreement.
 */
const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'HumanSurvey API',
    version: '1.0.0',
    description:
      'Attribution infrastructure for the channels that have no referrer. A form asks a respondent where they first heard about you — platform first, then which creator, podcast, event or store — inside the host\'s own signup or payment flow at /s/{id}. An agent configures the candidate list over HTTP or MCP, reads the rollup and the raw response stream back, and resolves free text to candidates retroactively. There is no human-facing dashboard: the aggregates are an API resource.',
  },
  servers: [{ url: 'https://www.humansurvey.co' }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'auth', description: 'Sign-in codes and API keys. An account owns the data; a key is a credential.' },
    { name: 'forms', description: 'Placements and their immutable config snapshots.' },
    { name: 'responses', description: 'The respondent write path (public) and the creator read path (authenticated).' },
    { name: 'results', description: 'Rollup, free-text remapping, and conversion events.' },
    { name: 'catalog', description: 'The product-owned platform catalog.' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description:
          'Pass your API key as a Bearer token: Authorization: Bearer hs_sk_... Keys are issued against a verified email code (POST /api/auth/verify) or by an existing key (POST /api/keys). Anonymous key creation no longer exists — a key without an owner has no recovery path.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string', description: 'Human-readable error message' },
          errors: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Every problem found, not just the first — a caller fixing one error per round trip burns a turn per typo. Present on validation failures (400) on the configure, response, remap, rollup and events endpoints.',
          },
        },
        example: { error: 'Invalid attribution config', errors: ['nodes[0].candidates must be a non-empty array'] },
      },
      Candidate: {
        type: 'object',
        required: ['id', 'label'],
        description:
          'One option in a list. Ids are caller-defined and must survive a rename: a handle used as an id splits that creator\'s history in half the day they change it.',
        properties: {
          id: { type: 'string', maxLength: 128, description: 'Stable caller-defined key. Unique within the node.' },
          label: { type: 'string', maxLength: 120, description: 'Displayed. Use the brand name, not a taxonomy label.' },
          handle: { type: 'string', maxLength: 120, description: 'Displayed alongside the label, e.g. "@jade.work0".' },
          icon_url: { type: 'string', maxLength: 120, description: 'Logo or avatar. Filled in from the catalog when catalog_slug is set.' },
          aliases: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 24,
            description: 'Matched by the search box, never displayed. People remember descriptions, not handles.',
          },
          tile_color: {
            type: 'string',
            description:
              'Brand color for the two-letter tile drawn when no mark or avatar exists. Its presence is also the signal to draw a tile at all, so leave it off descriptive options like "A friend or colleague".',
          },
          pinned: {
            type: 'string',
            enum: ['end'],
            description: 'Layout only: excluded from rotation and rendered last. At most one per node.',
          },
          dont_remember: {
            type: 'boolean',
            enum: [true],
            description:
              'Semantics, not layout: picking this records the response as dont_remember rather than as a channel, and opens no follow-up. Requires pinned: "end". At most one per node. Without it, "I don\'t remember" is reported as a resolved channel holding a share of the responses.',
          },
          expands: { type: 'string', description: 'Id of the node to reveal in place when this option is picked.' },
          catalog_slug: {
            type: 'string',
            description:
              'A slug from GET /api/attribution/catalog. The server copies that platform\'s label, mark, monogram color and aliases into the snapshot; anything you send explicitly wins. An unknown slug is a 400, never a silent omission.',
          },
        },
      },
      AskNode: {
        type: 'object',
        required: ['id', 'prompt', 'candidates'],
        properties: {
          id: { type: 'string', maxLength: 128 },
          prompt: { type: 'string', maxLength: 120 },
          candidates: { type: 'array', items: { $ref: '#/components/schemas/Candidate' }, minItems: 1, maxItems: 500 },
          allow_free_text: {
            type: 'boolean',
            default: true,
            description: 'Whether a respondent may type an answer that is not in the list. There is no "Other" option; typing is the fallback.',
          },
          order: {
            type: 'string',
            enum: ['fixed', 'rotate'],
            default: 'rotate',
            description:
              'rotate permutes the orderable segment per respondent, seeded by render_id, so every option spends equal expected time at every position and the raw share is unbiased by construction. fixed uses your array order verbatim and accepts the position bias — that is where sorting by media spend lands.',
          },
        },
      },
      Answer: {
        type: 'object',
        description:
          'Exactly one of candidate_id, raw, dont_remember or skipped. `false` counts as absent, so spreading a full shape is safe. A candidate_id absent from the config snapshot is a 400 — free text is the path for an answer with no id.',
        properties: {
          candidate_id: { type: 'string', maxLength: 128 },
          raw: { type: 'string', maxLength: 500, description: 'Free text, stored verbatim and never trimmed: the remap key is derived from it in the database.' },
          dont_remember: { type: 'boolean', enum: [true] },
          skipped: { type: 'boolean', enum: [true] },
        },
        examples: [{ candidate_id: 'tiktok' }, { raw: 'the one who does the office skits' }, { dont_remember: true }],
      },
      FormSettings: {
        type: 'object',
        description: 'Live properties of a placement. Never the config — that is PUT /api/attribution/forms/{id}.',
        properties: {
          name: { type: 'string', maxLength: 120 },
          status: {
            type: 'string',
            enum: ['active', 'paused'],
            description:
              'Two states. An attribution form is a perpetual stream, so there is no closed, expired or full — and pausing is reversible, which is why a paused form answers 409 rather than 410.',
          },
          allowed_origins: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 20,
            description:
              'Origins only — scheme, host and port, no path, query or fragment. An empty list is enforced as allow-all and every write warns about it, because under per-response pricing any site embedding your form spends your quota.',
          },
          theme: {
            type: 'object',
            description:
              'A fixed token set: accent (hex), radius (integer px, 0–48), font, dark_mode. Unknown keys are a 400 rather than dropped. Replaces the stored theme wholesale, so {} resets it.',
            properties: {
              accent: { type: 'string' },
              radius: { type: 'integer' },
              font: { type: 'string' },
              dark_mode: { type: 'string', enum: ['light', 'dark', 'auto'] },
            },
          },
          per_response_webhook_url: {
            type: ['string', 'null'],
            format: 'uri',
            description: 'Accepted, validated and stored, but NOTHING DELIVERS TO IT YET — per-response delivery is not built. Set it if you want it recorded; do not build against it. Null clears it; omitting the field leaves it unchanged.',
          },
        },
      },
    },
  },
  paths: {
    '/api/auth/code': {
      post: {
        operationId: 'requestLoginCode',
        summary: 'Mail a six-digit sign-in code',
        description:
          'Public — no authentication; this is the front door. Throttled per address and per IP. The response body is identical whether or not the address has an account, so it cannot be used to test who is registered.',
        tags: ['auth'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
              example: { email: 'you@example.com' },
            },
          },
        },
        responses: {
          '202': {
            description: 'Code sent',
            content: { 'application/json': { example: { sent: true, expires_in_seconds: 600 } } },
          },
          '400': {
            description: 'Missing or implausible email',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'A valid email is required' } } },
          },
          '429': {
            description: 'Too many codes requested',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/auth/verify': {
      post: {
        operationId: 'verifyLoginCode',
        summary: 'Exchange a code for an API key or a browser session',
        description:
          'Public — no authentication. Two grants from one mechanism. grant: "api_key" returns a key, which is the agent path: the MCP server writes it straight to its local config so it never lands in a transcript. grant: "session" (the default) sets an httpOnly cookie for the browser account area.',
        tags: ['auth'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'code'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  code: { type: 'string', pattern: '^\\d{6}$' },
                  grant: { type: 'string', enum: ['session', 'api_key'], default: 'session' },
                  name: { type: 'string', description: 'Label for the key. api_key grant only; defaults to "default".' },
                  agent_client: { type: 'string', description: 'Which agent runtime asked, e.g. "claude-code". api_key grant only.' },
                },
              },
              example: { email: 'you@example.com', code: '481920', grant: 'api_key', name: 'my-agent' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Signed in (session grant). The session cookie is set on this response.',
            content: { 'application/json': { example: { signed_in: true } } },
          },
          '201': {
            description: 'API key created (api_key grant). The only time the key is readable — nothing stores it in the clear.',
            content: { 'application/json': { example: { id: 'abc123efgh45', key: 'hs_sk_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6' } } },
          },
          '400': {
            description: 'Malformed request, or a code that is wrong, unknown or expired. Wrong and unknown answer identically, so this cannot report whether someone is mid-sign-in.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'That code is not valid' } } },
          },
          '429': {
            description: 'Too many incorrect attempts — request a new code',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/keys': {
      post: {
        operationId: 'createApiKey',
        summary: 'Create an API key',
        description:
          'Authenticated. Mints a second key on the account the presented key belongs to — this is how rotation works, and the new key inherits the account\'s forms rather than starting empty. Bootstrapping from nothing goes through POST /api/auth/verify instead; there is no anonymous key creation. Save the returned key, it is shown once.',
        tags: ['auth'],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Human-readable label, e.g. "checkout-agent"' },
                  agent_client: { type: 'string', description: 'Which agent runtime asked, e.g. "claude-code"' },
                },
              },
              example: { name: 'checkout-agent', agent_client: 'claude-code' },
            },
          },
        },
        responses: {
          '201': {
            description: 'API key created. Store the key value — it is shown only once.',
            content: {
              'application/json': {
                example: {
                  id: 'abc123efgh45',
                  key: 'hs_sk_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6',
                  name: 'checkout-agent',
                  created_at: '2026-07-30T10:00:00.000Z',
                },
              },
            },
          },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
      get: {
        operationId: 'listApiKeys',
        summary: 'List the account\'s API keys',
        description:
          'Authenticated. Every key on the account, newest first, with `current` flagging the one presented — which is what makes "revoke the leaked key" safe to do from a list instead of a guess. Key values are never returned.',
        tags: ['auth'],
        responses: {
          '200': {
            description: 'Key list',
            content: {
              'application/json': {
                example: [
                  {
                    id: 'abc123efgh45',
                    name: 'checkout-agent',
                    agent_client: 'claude-code',
                    created_at: '2026-07-30T10:00:00.000Z',
                    last_used_at: '2026-07-30T11:20:00.000Z',
                    revoked_at: null,
                    current: true,
                  },
                ],
              },
            },
          },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/keys/{id}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Key id from createApiKey or listApiKeys.' },
      ],
      delete: {
        operationId: 'revokeApiKey',
        summary: 'Revoke an API key',
        description:
          'Authenticated. Any key on the account may revoke any other, including itself — the restriction to self-revocation existed when the key was the identity, and it made "a key leaked, kill it from somewhere safe" impossible. A soft delete: the row stays as the record of what was issued. Forms, configs and responses belong to the account and are untouched, so a replacement key reads them immediately.',
        tags: ['auth'],
        responses: {
          '204': { description: 'API key revoked' },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Unknown key, another account\'s key, or already revoked — one answer for all three, so key ids cannot be probed.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'No such key' } } },
          },
        },
      },
    },
    '/api/attribution/forms': {
      post: {
        operationId: 'createForm',
        summary: 'Create a form',
        description:
          'Authenticated. One form is one placement: a customer typically runs two — one in the payment flow, one in signup — and the pair is what yields a channel\'s conversion index — its share of the paying population over its share of the signup population, which times your overall signup-to-paid rate gives the channel\'s own rate. Creating a form does not configure it; the returned warnings say so, and an unconfigured form renders nothing.',
        tags: ['forms'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                allOf: [{ $ref: '#/components/schemas/FormSettings' }],
                required: ['name'],
              },
              example: {
                name: 'Checkout — how did you hear about us',
                allowed_origins: ['https://app.example.com'],
                theme: { accent: '#4f46e5', radius: 12, dark_mode: 'auto' },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Form created',
            content: {
              'application/json': {
                example: {
                  id: 'abc123efgh45',
                  form_url: 'https://www.humansurvey.co/s/abc123efgh45',
                  warnings: ['this form has no config yet; PUT /api/attribution/forms/abc123efgh45 with {nodes} before embedding it'],
                },
              },
            },
          },
          '400': {
            description: 'Invalid settings',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Invalid form settings', errors: ['name is required'] } } },
          },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
      get: {
        operationId: 'listForms',
        summary: 'List forms',
        description: 'Authenticated. Every form on the account. An agent cannot configure or read a form whose id it cannot find.',
        tags: ['forms'],
        responses: {
          '200': {
            description: 'Form list',
            content: {
              'application/json': {
                example: [
                  {
                    id: 'abc123efgh45',
                    name: 'Checkout — how did you hear about us',
                    status: 'active',
                    current_version: 7,
                    response_count: 1284,
                    allowed_origins: ['https://app.example.com'],
                    created_at: '2026-07-01T10:00:00.000Z',
                    form_url: 'https://www.humansurvey.co/s/abc123efgh45',
                  },
                ],
              },
            },
          },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/attribution/forms/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Form id.' }],
      get: {
        operationId: 'getForm',
        summary: 'Fetch a form and its current config snapshot',
        description:
          'Authenticated, unlike the respondent page it describes: /s/{id} renders the config server-side, so there is no public endpoint that hands out a candidate list. 404 covers "no such form" and "not your form" alike, on this and every other form route — telling them apart lets anyone walk the id space.',
        tags: ['forms'],
        responses: {
          '200': {
            description: 'Form settings plus the snapshot it currently points at (config is null until the first PUT).',
            content: {
              'application/json': {
                example: {
                  id: 'abc123efgh45',
                  name: 'Checkout — how did you hear about us',
                  status: 'active',
                  current_version: 7,
                  allowed_origins: ['https://app.example.com'],
                  theme: { accent: '#4f46e5' },
                  per_response_webhook_url: null,
                  response_count: 1284,
                  created_at: '2026-07-01T10:00:00.000Z',
                  form_url: 'https://www.humansurvey.co/s/abc123efgh45',
                  config: {
                    version: 7,
                    root_node_id: 'channel',
                    config_hash: '9f2c…',
                    created_at: '2026-07-28T09:00:00.000Z',
                    nodes: [
                      {
                        id: 'channel',
                        prompt: 'Where did you first hear about us?',
                        allow_free_text: true,
                        order: 'rotate',
                        candidates: [
                          { id: 'tiktok', label: 'TikTok', catalog_slug: 'tiktok', icon_url: '/logos/tiktok.svg', expands: 'creator' },
                          { id: 'friend', label: 'A friend or colleague' },
                          { id: 'dunno', label: "I don't remember", pinned: 'end', dont_remember: true },
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Form not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Form not found' } } },
          },
        },
      },
      put: {
        operationId: 'configureForm',
        summary: 'Configure the form — nodes and candidates',
        description:
          'Authenticated. Validates the whole graph, stores it as an immutable snapshot, and points the form at it. A config version is never updated: stored responses are joined against the version they were rendered against, so dropping or renaming a candidate must not rewrite what last quarter\'s rollup claims was shown. An identical config returns the existing version with created: false — that dedupe is load-bearing, because a fresh version every month would fragment the position-effect sample. Separate verb from PATCH on purpose: changing an accent color must not require resending the candidate list.',
        tags: ['forms'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nodes'],
                properties: {
                  nodes: { type: 'array', items: { $ref: '#/components/schemas/AskNode' }, minItems: 1, maxItems: 12 },
                  root_node_id: {
                    type: 'string',
                    description:
                      'Optional assertion. The root is derived as the one node nothing expands to; sending a value that disagrees is a 400 rather than an override.',
                  },
                },
              },
              example: {
                nodes: [
                  {
                    id: 'channel',
                    prompt: 'Where did you first hear about us?',
                    order: 'rotate',
                    candidates: [
                      { id: 'tiktok', catalog_slug: 'tiktok', expands: 'creator' },
                      { id: 'reddit', catalog_slug: 'reddit' },
                      { id: 'friend', label: 'A friend or colleague' },
                      { id: 'dunno', label: "I don't remember", pinned: 'end', dont_remember: true },
                    ],
                  },
                  {
                    id: 'creator',
                    prompt: 'Which account was it?',
                    candidates: [
                      { id: 'oecuid_8812', label: 'Jade', handle: '@jade.work0', icon_url: 'https://cdn.example.com/jade.jpg', aliases: ['office skits'] },
                      { id: 'oecuid_2277', label: 'Tom', handle: '@transyncai_tom' },
                      { id: 'creator_dunno', label: "I don't remember who", pinned: 'end', dont_remember: true },
                    ],
                  },
                ],
              },
            },
          },
        },
        responses: {
          '200': {
            description:
              'Config live. created: false means an identical snapshot already existed and was reused; current_version still moves to it.',
            content: { 'application/json': { example: { id: 'abc123efgh45', version: 8, created: true, warnings: [] } } },
          },
          '400': {
            description: 'Invalid config. Every problem is reported at once, addressed by path.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  error: 'Invalid attribution config',
                  errors: [
                    'nodes[0].candidates[3].dont_remember requires pinned: "end"',
                    'node "channel" candidate "tiktok" expands to unknown node "creators"',
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Form not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
      patch: {
        operationId: 'updateForm',
        summary: 'Update form settings',
        description:
          'Authenticated. Name, status, allowed origins, theme, webhook. Config keys sent here are refused with a 400 naming PUT rather than dropped, because a silent 200 would let a caller believe their candidate list shipped.',
        tags: ['forms'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/FormSettings' },
              example: { status: 'paused', allowed_origins: ['https://app.example.com', 'https://checkout.example.com'] },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated settings',
            content: {
              'application/json': {
                example: {
                  id: 'abc123efgh45',
                  name: 'Checkout — how did you hear about us',
                  status: 'paused',
                  current_version: 7,
                  response_count: 1284,
                  allowed_origins: ['https://app.example.com', 'https://checkout.example.com'],
                  created_at: '2026-07-01T10:00:00.000Z',
                  form_url: 'https://www.humansurvey.co/s/abc123efgh45',
                  warnings: [],
                },
              },
            },
          },
          '400': {
            description: 'Invalid settings, or config keys sent to the wrong verb',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'PATCH does not accept config; send {nodes} to PUT /api/attribution/forms/{id} instead' },
              },
            },
          },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Form not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/attribution/forms/{id}/responses': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Form id.' }],
      post: {
        operationId: 'submitResponse',
        summary: 'Submit the first answer',
        description:
          'PUBLIC — no authentication, and no API key belongs in a client that calls this: it runs in a respondent\'s browser inside someone else\'s payment flow. What stands in for auth is the form\'s origin allowlist. node_id must be the root node; a pick that expands returns next_node, and the follow-up arrives as a PATCH with the patch_token from this response. A response becomes visible to the authenticated reads only once it is complete or has been swept as abandoned.',
        tags: ['responses'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['render_id', 'node_id', 'answer'],
                properties: {
                  render_id: {
                    type: 'string',
                    maxLength: 64,
                    description:
                      'Minted by the client before first paint, and the seed of the rotate permutation. It cannot be the response id, which is minted server-side inside this POST — after the first render has already happened. The same render_id must reproduce the same order, so a reload is stable.',
                  },
                  node_id: { type: 'string', maxLength: 128, description: 'Must be the form\'s root node — POST is the first selection by definition.' },
                  answer: { $ref: '#/components/schemas/Answer' },
                  selected_via_search: {
                    type: 'boolean',
                    default: false,
                    description:
                      'True when the pick came out of a search-filtered list. Client-supplied because the server sees the list but not the keystrokes, and it can only ever suppress a recorded position, never invent one: someone who types "jad" and takes the only match would otherwise book a position-0 impression the rest of the list never competed for.',
                  },
                  config_version: {
                    type: 'integer',
                    description:
                      'The snapshot this render came from. Answers are validated against it, never against the form\'s current version — a reconfigure landing between page load and submit would otherwise read a dropped candidate as an unknown id. Omitting it falls back to the current version, which is only right for a client that predates the field.',
                  },
                  external_id: {
                    type: 'string',
                    maxLength: 256,
                    description:
                      'The host\'s own identifier for this person — the join key for POST /api/attribution/events and for ?external_id= reads. Respondent-supplied and not authenticated, so it binds an answer to an identity; it does not prove who answered. Stored verbatim, capped only.',
                  },
                  host_origin: {
                    type: 'string',
                    maxLength: 256,
                    description:
                      'The host page\'s origin, checked against the form\'s allowed_origins. Read from the body because the embed is served from our origin, so the request\'s own Origin header is ours on every page that hosts it. Respondent-asserted, therefore billing hygiene rather than a security boundary. The Origin header is the fallback for a host posting from its own JS.',
                  },
                  metadata: {
                    type: 'object',
                    additionalProperties: { type: 'string' },
                    description:
                      'Host-supplied response tags for segmenting later. /s/{id} captures these automatically from non-reserved URL query params, e.g. ?plan=pro. Sanitized server-side because anyone can reach this endpoint: strings and numbers only and numbers are stored as strings, everything else dropped along with the reserved params embed, external_id and host_origin; at most 20 keys, keys capped at 64 characters and values at 512. Returned on every response read.',
                  },
                },
              },
              example: {
                render_id: 'V1StGXR8_Z5jdHi6',
                node_id: 'channel',
                answer: { candidate_id: 'tiktok' },
                selected_via_search: false,
                config_version: 7,
                external_id: 'usr_8812',
                host_origin: 'https://app.example.com',
                metadata: { plan: 'pro', step: 'checkout' },
              },
            },
          },
        },
        responses: {
          '201': {
            description:
              'Response created. next_node is present only when the pick expands one; its absence means the response is already complete. patch_token is handed over once and never again.',
            content: {
              'application/json': {
                example: {
                  response_id: 'xyz789abcd01',
                  patch_token: 'kR3n…',
                  next_node: {
                    id: 'creator',
                    prompt: 'Which account was it?',
                    allow_free_text: true,
                    order: 'rotate',
                    candidates: [{ id: 'oecuid_8812', label: 'Jade', handle: '@jade.work0' }],
                  },
                },
              },
            },
          },
          '400': {
            description: 'Malformed payload. Every field problem is listed.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  error: 'Invalid response payload',
                  errors: ['answer.candidate_id "tikok" is not a candidate of node "channel"'],
                },
              },
            },
          },
          '403': {
            description: 'The submitting origin is not on the form\'s allowlist',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'This origin is not allowed to submit to this form' } } },
          },
          '404': {
            description: 'Form not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '409': {
            description:
              'The form is paused, or has never been configured. 409 and not 410: pausing is reversible, and 410 tells a client the resource is gone for good.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                examples: {
                  paused: { value: { error: 'This form is not accepting responses' } },
                  unconfigured: { value: { error: 'This form has not been configured yet' } },
                },
              },
            },
          },
        },
      },
      patch: {
        operationId: 'patchResponse',
        summary: 'Answer the follow-up',
        description:
          'PUBLIC — no authentication. Authorized by the patch_token from the POST, without which anyone holding a response id could overwrite someone else\'s answer. The token stays valid until the response completes, because a deeper expansion chain needs it twice. Deliberately not gated on the origin allowlist or the form\'s status: both decide whether a response may be created, and re-checking here would turn a real answer into an abandonment every time a pause landed mid-response.',
        tags: ['responses'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['response_id', 'patch_token', 'node_id', 'answer'],
                properties: {
                  response_id: { type: 'string', maxLength: 128 },
                  patch_token: { type: 'string', maxLength: 256 },
                  node_id: { type: 'string', maxLength: 128, description: 'Must be the node the response is awaiting.' },
                  answer: { $ref: '#/components/schemas/Answer' },
                  selected_via_search: { type: 'boolean', default: false },
                },
              },
              example: {
                response_id: 'xyz789abcd01',
                patch_token: 'kR3n…',
                node_id: 'creator',
                answer: { candidate_id: 'oecuid_8812' },
                selected_via_search: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Answer recorded. completed: false means another node was revealed and is returned as next_node.',
            content: { 'application/json': { example: { response_id: 'xyz789abcd01', completed: true } } },
          },
          '400': {
            description: 'Malformed payload',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '403': {
            description:
              'Unknown response id or wrong token — one answer for both, because response ids are twelve characters handed back to a browser and distinguishing the cases turns guessing one into a yes/no question this endpoint would answer for free.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Unknown response id or patch token' } } },
          },
          '409': {
            description: 'Already complete (including swept as abandoned), or awaiting a different node.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                examples: {
                  complete: { value: { error: 'This response is already complete' } },
                  other_node: { value: { error: 'This response is awaiting node "creator"' } },
                },
              },
            },
          },
        },
      },
      get: {
        operationId: 'readResponses',
        summary: 'Read raw responses — cursor page or one identity',
        description:
          'Authenticated. Two reads share the verb and are chosen by the query string; sending both parameters is a 400, because they order differently and a cursor fed back from the wrong one is a cursor into the other read. Only completed responses are visible, so a lookup that returns nothing can mean "still answering" rather than "never answered". Free text is resolved against the live remap table on every read, and the verbatim raw plus the pre-remap candidate_id ship alongside the resolved value so a mapping can be audited.',
        tags: ['responses'],
        parameters: [
          {
            name: 'since_seq',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description:
              'Exclusive cursor — pass the previous page\'s next_cursor. Absent means from the beginning of the stream. This is completed_seq, stamped when a response becomes final, never insert order: a cursor over insert order would hand an agent the channel answer and never the creator answer. Sent as a decimal string because it is an int8 and a JS number rounds past 2^53.',
          },
          {
            name: 'external_id',
            in: 'query',
            required: false,
            schema: { type: 'string', maxLength: 256 },
            description:
              'One identity\'s responses, canonical first. Retakes are allowed, so this can return several; the canonical one is the first response for the identity and the only one revenue is booked against.',
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 100, maximum: 500 },
          },
        ],
        responses: {
          '200': {
            description:
              'A cursor page, or an identity lookup. has_more is read with limit + 1 rather than guessed from the page size; open_responses comes out of the same snapshot as the page, so "drained" cannot be reported about a stream that grew in between. There is no terminal flag — an attribution form is perpetual, so no field may claim one.',
            content: {
              'application/json': {
                examples: {
                  cursor_page: {
                    value: {
                      responses: [
                        {
                          id: 'xyz789abcd01',
                          external_id: 'usr_8812',
                          config_version: 7,
                          completion: 'finished',
                          completed_at: '2026-07-30T11:02:00.000Z',
                          cursor: '4831',
                          awaiting_node_id: null,
                          answers: [
                            {
                              node_id: 'channel',
                              kind: 'candidate',
                              raw: null,
                              candidate_id: 'tiktok',
                              resolved_candidate_id: 'tiktok',
                              resolved_via: 'answer',
                              resolved_label: 'TikTok',
                              position: 2,
                              selected_via_search: false,
                            },
                            {
                              node_id: 'creator',
                              kind: 'raw',
                              raw: 'the one who does the office skits',
                              candidate_id: null,
                              resolved_candidate_id: 'oecuid_8812',
                              resolved_via: 'remap',
                              resolved_label: 'Jade',
                              position: null,
                              selected_via_search: false,
                            },
                          ],
                          positions: { channel: { tiktok: 2, reddit: 0, friend: 1 } },
                          metadata: { plan: 'pro' },
                          created_at: '2026-07-30T11:01:30.000Z',
                        },
                      ],
                      count: 1,
                      next_cursor: '4831',
                      has_more: false,
                      open_responses: true,
                      next_check_hint_seconds: 120,
                    },
                  },
                  identity_lookup: {
                    value: {
                      external_id: 'usr_8812',
                      responses: [{ id: 'xyz789abcd01', canonical: true, answers: [] }],
                      count: 1,
                      canonical_response_id: 'xyz789abcd01',
                      has_retakes: false,
                      truncated: false,
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Malformed query',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'Invalid query parameters', errors: ['since_seq and external_id are two different reads; send one or the other'] },
              },
            },
          },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Form not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/attribution/forms/{id}/unresolved': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Form id.' }],
      get: {
        operationId: 'listUnresolved',
        summary: 'Free text awaiting a mapping',
        description:
          'Authenticated. Grouped by (node_id, raw_normalized) — the exact key the remap table uses, so what you read here can be posted back unchanged — and ordered by occurrence count descending, because the twelve-occurrence entry is where the recoverable signal is. Entries a live remap already covers are excluded unless include_mapped=1. Only completed responses are counted, matching the rollup.',
        tags: ['results'],
        parameters: [
          { name: 'node_id', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'from', in: 'query', required: false, schema: { type: 'string', format: 'date-time' }, description: 'Inclusive lower bound on the response\'s completed_at.' },
          { name: 'to', in: 'query', required: false, schema: { type: 'string', format: 'date-time' }, description: 'Exclusive upper bound, matching the rollup so the two reconcile.' },
          { name: 'include_mapped', in: 'query', required: false, schema: { type: 'boolean' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 100, maximum: 500 } },
          { name: 'offset', in: 'query', required: false, schema: { type: 'integer', maximum: 100000 } },
        ],
        responses: {
          '200': {
            description:
              'Grouped free text. totals are computed before the filter and the limit, so the denominator cannot drift from the rows beside it, and a truncated page says so.',
            content: {
              'application/json': {
                example: {
                  form_id: 'abc123efgh45',
                  window: { from: null, to: null },
                  totals: { raw_responses: 63, mapped_responses: 12, unmapped_responses: 51, texts: 44, unmapped_texts: 39 },
                  returned: 2,
                  truncated: false,
                  entries: [
                    {
                      node_id: 'creator',
                      raw_normalized: 'the one who does the office skits',
                      occurrences: 12,
                      variants: ['The one who does the office skits', 'the one who does the office skits'],
                      variant_count: 2,
                      first_seen: '2026-07-04T08:00:00.000Z',
                      last_seen: '2026-07-29T19:00:00.000Z',
                      mapped: false,
                      remap_id: null,
                      mapped_candidate_id: null,
                      mapped_candidate_label: null,
                    },
                  ],
                  notes: [],
                },
              },
            },
          },
          '400': {
            description: 'Malformed query',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Form not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/attribution/forms/{id}/remaps': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Form id.' }],
      get: {
        operationId: 'listRemaps',
        summary: 'List free-text mappings',
        description:
          'Authenticated. Live mappings by default; revoked ones are behind include_revoked=1 rather than hidden, because "why did this number change last month" is answerable only from the revoked rows.',
        tags: ['results'],
        parameters: [
          { name: 'include_revoked', in: 'query', required: false, schema: { type: 'boolean' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 100, maximum: 500 } },
          { name: 'offset', in: 'query', required: false, schema: { type: 'integer', maximum: 100000 } },
        ],
        responses: {
          '200': {
            description: 'Mappings, each with the number of completed responses it resolves right now.',
            content: {
              'application/json': {
                example: {
                  form_id: 'abc123efgh45',
                  returned: 1,
                  truncated: false,
                  remaps: [
                    {
                      id: 'Kq7mZ2pR4tLa',
                      node_id: 'creator',
                      raw_normalized: 'the one who does the office skits',
                      candidate_id: 'oecuid_8812',
                      note: 'signed as an ambassador in June',
                      created_at: '2026-07-30T09:00:00.000Z',
                      revoked_at: null,
                      candidate_label: 'Jade',
                      candidate_label_version: 7,
                      resolved_responses: 12,
                    },
                  ],
                  notes: [],
                },
              },
            },
          },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Form not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
      post: {
        operationId: 'createRemap',
        summary: 'Map free text to a candidate, retroactively',
        description:
          'Authenticated. The rollup and the raw reads join this table at read time, so one row here moves every completed response carrying that text in every window that contains it — past rollups included, with no backfill. That is why the response reports resolved_responses: "I mapped it and nothing changed" has to be visible now rather than discovered in next month\'s numbers. The target is deliberately not a foreign key, because a candidate may have been dropped from the current config while history still needs the mapping; an id present in no version is a warning, not an error.',
        tags: ['results'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['node_id', 'candidate_id'],
                description: 'Exactly one of raw_normalized or raw is required.',
                properties: {
                  node_id: { type: 'string', maxLength: 128 },
                  candidate_id: { type: 'string', maxLength: 128 },
                  raw_normalized: { type: 'string', maxLength: 500, description: 'The key as GET .../unresolved reports it.' },
                  raw: { type: 'string', maxLength: 500, description: 'A verbatim sample, normalized by the database the same way the stored key was.' },
                  note: { type: 'string', maxLength: 500 },
                },
              },
              example: {
                node_id: 'creator',
                raw: 'The one who does the office skits',
                candidate_id: 'oecuid_8812',
                note: 'signed as an ambassador in June',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Mapping created. warnings is non-empty when it resolves nothing, or when the candidate or node appears in no config version.',
            content: {
              'application/json': {
                example: {
                  remap: {
                    id: 'Kq7mZ2pR4tLa',
                    node_id: 'creator',
                    raw_normalized: 'the one who does the office skits',
                    candidate_id: 'oecuid_8812',
                    note: 'signed as an ambassador in June',
                    created_at: '2026-07-30T09:00:00.000Z',
                    revoked_at: null,
                  },
                  resolved_responses: 12,
                  candidate_label: 'Jade',
                  candidate_label_version: 7,
                  warnings: [],
                },
              },
            },
          },
          '400': {
            description: 'Malformed payload',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Form not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '409': {
            description:
              'A live mapping for this text already exists, named so you know what to revoke. Two live mappings of one string would double-count in the read-time join, which is why this is a refusal and not a merge.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'a live remap for this text already exists on node "creator" (Kq7mZ2pR4tLa → "oecuid_8812"); revoke it first' },
              },
            },
          },
        },
      },
    },
    '/api/attribution/forms/{id}/remaps/{remapId}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Form id.' },
        { name: 'remapId', in: 'path', required: true, schema: { type: 'string' }, description: 'Remap id.' },
      ],
      delete: {
        operationId: 'revokeRemap',
        summary: 'Revoke a mapping',
        description:
          'Authenticated. A soft delete: revoked_at is stamped and the row stays, because it is the record that a number was once reported differently. Idempotent — revoking an already-revoked mapping answers 200 with revoked: false and the original timestamp, rather than moving the date forward or erroring on a retry. resolved_responses is how many completed responses this returned to the unresolved list, in past windows as well as future ones.',
        tags: ['results'],
        responses: {
          '200': {
            description: 'Mapping revoked, or already was.',
            content: {
              'application/json': {
                example: {
                  remap: {
                    id: 'Kq7mZ2pR4tLa',
                    node_id: 'creator',
                    raw_normalized: 'the one who does the office skits',
                    candidate_id: 'oecuid_8812',
                    note: null,
                    created_at: '2026-07-30T09:00:00.000Z',
                    revoked_at: '2026-07-30T12:00:00.000Z',
                  },
                  revoked: true,
                  resolved_responses: 12,
                  notes: [],
                },
              },
            },
          },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'No such form, not your form, or no such mapping on it — one answer for all three.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/attribution/rollup': {
      get: {
        operationId: 'getRollup',
        summary: 'Aggregate attribution — channel × heads and channel × revenue',
        description:
          'Authenticated, and the read an agent acts on: there is no human-facing dashboard. Computed at read time against the current remap table, so a mapping created today fixes two months of history. form_id is required and there is no union across forms — candidate populations differ per form, so a union would divide one form\'s selections by another form\'s respondents.',
        tags: ['results'],
        parameters: [
          { name: 'form_id', in: 'query', required: true, schema: { type: 'string', maxLength: 128 } },
          {
            name: 'by',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['candidate', 'node'], default: 'candidate' },
            description: 'candidate is one row per node × candidate; node rolls the candidates of each node together.',
          },
          {
            name: 'metric',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['responses', 'revenue'], default: 'responses' },
            description: 'Sort order only — both numbers ship either way.',
          },
          {
            name: 'from',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'date-time' },
            description: 'Inclusive lower bound on the response\'s completed_at. A zoneless value is read as UTC.',
          },
          {
            name: 'to',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'date-time' },
            description: 'Exclusive upper bound. The window is half-open, [from, to), so from === to is rejected rather than answered with a page of zeroes.',
          },
        ],
        responses: {
          '200': {
            description:
              'The rollup. Every number that can be wrong ships beside the thing that says how wrong it might be. `share` is responses / denominator.per_node[node_id], and that denominator ships in the payload: it is every completed response that ANSWERED that node, so the resolved rows sum to less than 1 and the remainder is the unresolved block for the same node. `share_corrected` is null in v1 — under the default rotate order the raw share is already unbiased by construction, and the position-effect estimator needs volume to return anything but null — as are `position_effect` and `calibration`, returned as explicit nulls so their absence is visible rather than mysterious. Revenue is booked once per response, against the first response per (form_id, external_id); per-row revenue_cents and paying_responses exist only on the root node\'s rows and are null elsewhere, because one response\'s money repeated on every node it answered multiplies revenue by the number of questions asked. followup_unresolved is the candidate-coverage read-out — picks whose follow-up ended in no candidate — while followup_abandoned counts only the respondents who never came back; neither is derivable from the other. `notes` states the counting rules in prose beside the numbers they govern.',
            content: {
              'application/json': {
                example: {
                  form_id: 'abc123efgh45',
                  by: 'candidate',
                  metric: 'responses',
                  window: { from: '2026-07-01T00:00:00.000Z', to: '2026-08-01T00:00:00.000Z', basis: 'response.completed_at', bounds: '[from, to)' },
                  denominator: { completed_responses: 1284, per_node: { channel: 1284, creator: 502 } },
                  rows: [
                    {
                      node_id: 'channel',
                      candidate_id: 'tiktok',
                      label: 'TikTok',
                      label_from_node_id: null,
                      responses: 412,
                      share: 0.320872,
                      share_corrected: null,
                      revenue_cents: 1840000,
                      paying_responses: 96,
                      resolved_by_remap: 0,
                    },
                    {
                      node_id: 'creator',
                      candidate_id: 'oecuid_8812',
                      label: 'Jade',
                      label_from_node_id: null,
                      responses: 121,
                      share: 0.241036,
                      share_corrected: null,
                      revenue_cents: null,
                      paying_responses: null,
                      resolved_by_remap: 12,
                    },
                  ],
                  unresolved: {
                    raw: 63,
                    dont_remember: 128,
                    skipped: 91,
                    per_node: { channel: { raw: 24, dont_remember: 96, skipped: 61 }, creator: { raw: 39, dont_remember: 32, skipped: 30 } },
                  },
                  followup_unresolved: [
                    { node_id: 'channel', candidate_id: 'tiktok', follow_node_id: 'creator', picks: 412, unresolved: 91, rate: 0.220874 },
                  ],
                  followup_abandoned: [
                    { node_id: 'channel', candidate_id: 'tiktok', follow_node_id: 'creator', picks: 412, abandoned: 38, rate: 0.092233 },
                  ],
                  revenue: {
                    total_cents: 4120000,
                    paying_responses: 214,
                    event: 'paid',
                    currencies: ['usd'],
                    basis: 'first response per (form_id, external_id); all their paid events, regardless of occurred_at',
                  },
                  position_effect: null,
                  calibration: null,
                  notes: ['share_corrected is not computed in v1 — see design doc §6.2.'],
                },
              },
            },
          },
          '400': {
            description: 'Malformed query',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'Invalid rollup query', errors: ['form_id is required; the rollup is never a union across forms (see §7)'] },
              },
            },
          },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Form not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/attribution/events': {
      post: {
        operationId: 'pushEvents',
        summary: 'Push conversion events',
        description:
          'Authenticated. The inbound half of the external_id join: you push what happened to a person, we already know which channel they named, and the rollup becomes channel × revenue instead of channel × heads. Caller-pushed on purpose — a direct Stripe or AppsFlyer integration is an unbounded maintenance surface, and this schema is shaped the way one would want it so adding it later is additive. A batch is the primary shape; one bad element is rejected at its own index rather than failing the batch. An event for someone who never answered the form is stored and reported in join_check, not rejected: it usually arrives before the answer, and join_check is what makes an id-format mismatch visible at push time instead of as a rollup where revenue is zero and every row looks correct.',
        tags: ['results'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    type: 'object',
                    required: ['form_id', 'external_id', 'event', 'occurred_at'],
                    properties: {
                      form_id: { type: 'string', maxLength: 128 },
                      external_id: { type: 'string', maxLength: 256, description: 'Trimmed exactly as the write path trims it, so the join key is byte-identical.' },
                      event: { type: 'string', enum: ['signup', 'activated', 'paid', 'churned'] },
                      value_cents: {
                        type: 'integer',
                        description:
                          'Minor units, within ±(2^53 − 1) — a JSON number past that would store an amount you never sent. Requires currency. Negatives are allowed: a refund is a negative paid event, which is the only way to move a total back down. Summed as revenue only for event=paid.',
                      },
                      currency: { type: 'string', maxLength: 12, description: 'Upper-cased. The rollup groups on it and warns when it finds more than one; it does not convert.' },
                      occurred_at: { type: 'string', format: 'date-time', description: 'Stored as sent, and NOT what the rollup windows on — the window is the response\'s completed_at, so a payment in March belongs to the channel recorded in January.' },
                      idempotency_key: {
                        type: 'string',
                        maxLength: 200,
                        description:
                          'Unique per form. Without it a retried request stores the event twice and doubles that person\'s revenue. A replay comes back as status: duplicate, with a warning when the replayed payload disagrees with what is stored.',
                      },
                    },
                  },
                  {
                    type: 'object',
                    required: ['events'],
                    properties: {
                      form_id: { type: 'string', description: 'Inherited by every element that omits one — a backfill that repeats the id 500 times has 500 chances to get one wrong.' },
                      events: { type: 'array', maxItems: 500 },
                    },
                  },
                  { type: 'array', maxItems: 500 },
                ],
              },
              example: {
                form_id: 'abc123efgh45',
                events: [
                  { external_id: 'usr_8812', event: 'paid', value_cents: 4900, currency: 'USD', occurred_at: '2026-07-30T11:02:00Z', idempotency_key: 'stripe_ch_3Ab…' },
                  { external_id: 'usr_9001', event: 'signup', occurred_at: '2026-07-30T09:14:00Z' },
                ],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'At least one event was created. Some elements may still be rejected — read results.',
            content: {
              'application/json': {
                example: {
                  accepted: 1,
                  duplicates: 1,
                  rejected: 0,
                  results: [
                    { index: 0, status: 'created', id: 'Yb3nQ8xW1sVd', form_id: 'abc123efgh45', external_id: 'usr_8812', event: 'paid', idempotency_key: 'stripe_ch_3Ab…' },
                    { index: 1, status: 'duplicate', id: 'Ht5rJ0kM6zCf', form_id: 'abc123efgh45', external_id: 'usr_9001', event: 'signup', idempotency_key: 'signup_usr_9001', existing: null, warnings: [] },
                  ],
                  join_check: { checked: 2, matched: 1, unmatched: 1, examples: ['usr_9001'] },
                  notes: [],
                },
              },
            },
          },
          '200': {
            description: 'Nothing new, but at least one element was a clean replay of a stored event.',
            content: { 'application/json': { example: { accepted: 0, duplicates: 1, rejected: 0, results: [], join_check: { checked: 1, matched: 1, unmatched: 0, examples: [] }, notes: [] } } },
          },
          '400': {
            description: 'Nothing was written: a malformed envelope, or every element rejected. The per-element results ride along, because they are what says which field to fix.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  error: 'No event was accepted',
                  accepted: 0,
                  duplicates: 0,
                  rejected: 1,
                  results: [{ index: 0, status: 'rejected', errors: ['value_cents requires currency: money with no unit cannot be summed, and the schema refuses it'] }],
                },
              },
            },
          },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Nothing was written and every rejected element named a form this key cannot see.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Form not found' } } },
          },
        },
      },
    },
    '/api/attribution/catalog': {
      get: {
        operationId: 'getCatalog',
        summary: 'The platform catalog',
        description:
          'PUBLIC — no authentication, deliberately: configuration is agent-driven and an agent cannot name a catalog_slug it has never seen, so requiring a key would put a credential between the caller and the vocabulary. Nothing here is secret. Every entry ships a mark today, so icon_url is non-null throughout — but that is the state of the catalog rather than a guarantee, and `monogram` is what to render for any entry whose icon_url is ever null. Read the field; do not assume either way. expands_by_default is advisory — which channels earn a follow-up is a monthly judgment about where the money went, and configureForm never applies the flag on your behalf. Cached; the catalog is a checked-in module and only changes on deploy.',
        tags: ['catalog'],
        security: [],
        responses: {
          '200': {
            description: 'Platforms and the default channel set.',
            content: {
              'application/json': {
                example: {
                  platforms: [
                    {
                      slug: 'tiktok',
                      label: 'TikTok',
                      class: 'creator',
                      brand_color: '#000000',
                      icon_url: '/logos/tiktok.svg',
                      monogram: 'TI',
                      aliases: ['douyin', 'short video'],
                      expands_by_default: true,
                    },
                    {
                      slug: 'chatgpt',
                      label: 'ChatGPT',
                      class: 'ai_assistant',
                      brand_color: '#10A37F',
                      icon_url: null,
                      monogram: 'CH',
                      aliases: ['openai', 'gpt', 'chat gpt'],
                      expands_by_default: false,
                    },
                  ],
                  default_channel_slugs: ['google', 'chatgpt', 'linkedin', 'x', 'tiktok', 'youtube', 'instagram', 'reddit', 'friend', 'coworker-internal', 'press', 'event'],
                },
              },
            },
          },
        },
      },
    },
  },
} as const

export async function GET() {
  return NextResponse.json(openApiDocument)
}
