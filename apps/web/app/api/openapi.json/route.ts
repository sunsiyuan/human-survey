import { NextResponse } from 'next/server'

const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'HumanSurvey API',
    version: '0.5.0',
    description:
      'Feedback collection infrastructure for AI agents. An agent working on a long-horizon task creates a survey from JSON schema, shares the respondent URL with a group of people, and retrieves structured results when ready.',
  },
  servers: [{ url: 'https://www.humansurvey.co' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description: 'Pass your API key as a Bearer token: Authorization: Bearer hs_sk_...',
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
            description: 'Detailed validation errors (only present on 400 schema validation failures)',
          },
        },
        example: { error: 'schema is required' },
      },
    },
  },
  paths: {
    '/api/keys': {
      post: {
        operationId: 'createApiKey',
        summary: 'Create an API key',
        description:
          'Create a new API key. No authentication required — call this first to get credentials. Save the returned key; it cannot be retrieved again.',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Human-readable label for this key (e.g. "my-agent")' },
                  email: { type: 'string', format: 'email', description: 'Contact email of the human owner. Used for billing and usage notifications in the future.' },
                  wallet_address: { type: 'string', description: 'Wallet address in CAIP-10 format (e.g. "eip155:8453:0xabc..." for Base, "solana:...:ABC..." for Solana). Will be used for agent-native payments via x402 protocol in the future.' },
                },
              },
              example: { name: 'my-agent', email: 'you@example.com', wallet_address: 'eip155:8453:0xabc...' },
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
                  name: 'my-agent',
                  email: 'you@example.com',
                  wallet_address: 'eip155:8453:0xabc...',
                  created_at: '2026-04-07T10:00:00.000Z',
                },
              },
            },
          },
        },
      },
      get: {
        operationId: 'getApiKeyMetadata',
        summary: 'Get current API key metadata',
        description: 'Returns metadata for the authenticated API key. The key value itself is not returned.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'API key metadata',
            content: {
              'application/json': {
                example: {
                  id: 'abc123efgh45',
                  name: 'my-agent',
                  created_at: '2026-04-07T10:00:00.000Z',
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
    },
    '/api/keys/{id}': {
      delete: {
        operationId: 'revokeApiKey',
        summary: 'Revoke an API key',
        description: 'Permanently revoke the authenticated API key. All surveys created with this key remain accessible but the key can no longer be used to create new ones.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Key ID from the createApiKey response' }],
        responses: {
          '204': { description: 'API key revoked' },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/surveys': {
      post: {
        operationId: 'createSurvey',
        summary: 'Create a survey',
        description:
          'Create a survey from a JSON schema object. Returns a respondent URL to share with humans and the survey ID to retrieve results later. Surveys accept responses immediately after creation.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['schema'],
                properties: {
                  schema: {
                    type: 'object',
                    description: 'Survey definition. Must include title and at least one section with one question.',
                    required: ['title', 'sections'],
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' },
                      sections: {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['questions'],
                          properties: {
                            title: { type: 'string' },
                            questions: {
                              type: 'array',
                              items: {
                                type: 'object',
                                required: ['type', 'label'],
                                properties: {
                                  type: { type: 'string', enum: ['single_choice', 'multi_choice', 'text', 'scale', 'matrix'] },
                                  label: { type: 'string' },
                                  required: { type: 'boolean', default: false },
                                  options: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' } } }, description: 'Required for single_choice and multi_choice' },
                                  min: { type: 'integer', description: 'Required for scale' },
                                  max: { type: 'integer', description: 'Required for scale. Range must be ≤ 11 points.' },
                                  minLabel: { type: 'string' },
                                  maxLabel: { type: 'string' },
                                  rows: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' } } }, description: 'Required for matrix' },
                                  columns: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, options: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' } } } } } }, description: 'Required for matrix' },
                                  showIf: {
                                    type: 'object',
                                    description: 'Conditional display rule',
                                    properties: {
                                      questionId: { type: 'string', description: 'ID of an earlier question (e.g. "q_0")' },
                                      operator: { type: 'string', enum: ['eq', 'neq', 'contains', 'answered'] },
                                      value: { type: 'string' },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  max_responses: { type: 'integer', description: 'Close the survey automatically after this many responses' },
                  expires_at: { type: 'string', format: 'date-time', description: 'Close the survey automatically at this UTC time' },
                  notify_at_responses: { type: 'integer', description: 'Optional. Fire the webhook once when this many responses arrive — survey stays open. Wakes the agent on "enough signal" without waiting for full closure. Must be ≤ max_responses if both are set.' },
                  webhook_url: { type: 'string', format: 'uri', description: 'Optional URL to POST to when the survey hits a notable event. Branch on the "event" field. Closure: { event_id, event: "survey_closed", survey_id, status: "closed", closed_reason: "manual" | "max_responses" | "expired", response_count, closed_at } — fires on manual close, max_responses reached, or expires_at passed (lazy, within seconds of any next interaction). Threshold (if notify_at_responses is set): { event_id, event: "threshold_reached", survey_id, status: "open", response_count, threshold, fired_at }. Use event_id to dedupe; delivery is at-least-once per event type.' },
                },
              },
              example: {
                schema: {
                  title: 'Post-Event Feedback',
                  sections: [{
                    questions: [
                      { type: 'scale', label: 'How would you rate the event overall?', required: true, min: 1, max: 5, minLabel: 'Poor', maxLabel: 'Excellent' },
                      { type: 'multi_choice', label: 'Which sessions did you attend?', options: [{ label: 'Keynote' }, { label: 'Workshops' }, { label: 'Panels' }, { label: 'Networking' }] },
                      { type: 'text', label: "What's one thing we should improve?" },
                      { type: 'single_choice', label: 'Would you attend a future event?', required: true, options: [{ label: 'Definitely' }, { label: 'Maybe' }, { label: 'Unlikely' }] },
                    ],
                  }],
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Survey created. Share survey_url with respondents; use the survey ID extracted from it to call getResults.',
            content: {
              'application/json': {
                example: {
                  survey_url: 'https://www.humansurvey.co/s/abc123efgh45',
                  question_count: 3,
                },
              },
            },
          },
          '400': {
            description: 'Invalid schema',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                examples: {
                  missing_schema: { value: { error: 'schema is required' } },
                  validation_error: { value: { error: 'Invalid schema', errors: ['sections[0].questions[0].options is required for type \'single_choice\''] } },
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
        operationId: 'listSurveys',
        summary: 'List surveys',
        description: 'List all surveys created by the current API key, ordered newest first. Use this to find a survey ID you need for getResults or closeSurvey.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Survey list',
            content: {
              'application/json': {
                example: {
                  id: 'abc123efgh45',
                  title: 'Post-Event Feedback',
                  status: 'open',
                  response_count: 12,
                  max_responses: null,
                  expires_at: null,
                  created_at: '2026-04-07T10:00:00.000Z',
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
    },
    '/api/surveys/{id}': {
      get: {
        operationId: 'getSurvey',
        summary: 'Fetch survey metadata and schema',
        description: 'Public endpoint — no authentication required. Returns survey metadata, the full schema, response count, and lifecycle state. Use status to check if a survey is still open before sharing the URL.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Survey metadata and schema',
            content: {
              'application/json': {
                example: {
                  id: 'abc123efgh45',
                  title: 'Post-Event Feedback',
                  description: 'Help us improve future events.',
                  schema: {
                    title: 'Post-Event Feedback',
                    sections: [{
                      id: 'section_0',
                      questions: [
                        { id: 'q_0', type: 'scale', label: 'How would you rate the event overall?', required: true, min: 1, max: 5, minLabel: 'Poor', maxLabel: 'Excellent' },
                        { id: 'q_1', type: 'single_choice', label: 'Would you attend a future event?', required: true, options: [{ id: 'opt_0', label: 'Definitely' }, { id: 'opt_1', label: 'Maybe' }, { id: 'opt_2', label: 'Unlikely' }] },
                      ],
                    }],
                  },
                  response_count: 12,
                  status: 'open',
                  max_responses: null,
                  expires_at: null,
                },
              },
            },
          },
          '404': {
            description: 'Survey not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Survey not found' } } },
          },
        },
      },
      patch: {
        operationId: 'updateSurvey',
        summary: 'Update survey lifecycle fields',
        description: 'Close a survey, update its response cap, or change its expiry. You can only update surveys created by your API key.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['open', 'closed'], description: 'Set to "closed" to stop accepting responses' },
                  max_responses: { type: ['integer', 'null'], description: 'Null removes the cap' },
                  expires_at: { type: ['string', 'null'], format: 'date-time', description: 'Null removes the expiry' },
                },
              },
              example: { status: 'closed' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated lifecycle fields',
            content: {
              'application/json': {
                example: {
                  id: 'abc123efgh45',
                  status: 'closed',
                  max_responses: null,
                  expires_at: null,
                },
              },
            },
          },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '403': {
            description: 'Survey belongs to a different API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'You do not have access to this survey' } } },
          },
          '404': {
            description: 'Survey not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/surveys/{id}/responses': {
      post: {
        operationId: 'submitResponse',
        summary: 'Submit a survey response',
        description:
          'Public endpoint — no authentication required. Submit answers for a survey. Answer keys are question IDs (q_0, q_1, ...) from the survey schema. Values: option ID string for single_choice, array of option ID strings for multi_choice, number for scale, string for text.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['answers'],
                properties: {
                  answers: {
                    type: 'object',
                    description: 'Map of question ID to answer value. single_choice: "opt_0", multi_choice: ["opt_0", "opt_2"], scale: 4, text: "free text"',
                    additionalProperties: {
                      oneOf: [
                        { type: 'string' },
                        { type: 'array', items: { type: 'string' } },
                        { type: 'number' },
                      ],
                    },
                  },
                },
              },
              example: {
                answers: {
                  q_0: 'opt_1',
                  q_1: 4,
                  q_2: 'The deploy script failed silently on step 3',
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Response submitted',
            content: { 'application/json': { example: { id: 'xyz789abcd01' } } },
          },
          '400': {
            description: 'Answers missing or malformed',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Answers are required' } } },
          },
          '404': {
            description: 'Survey not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '410': {
            description: 'Survey is no longer accepting responses',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                examples: {
                  closed: { value: { error: 'This survey is closed' } },
                  expired: { value: { error: 'This survey has expired' } },
                  full: { value: { error: 'This survey is full' } },
                },
              },
            },
          },
        },
      },
      get: {
        operationId: 'getResults',
        summary: 'Get aggregated survey results',
        description:
          'Returns pre-aggregated results per question (choice tallies, scale stats, text responses) plus raw responses. ' +
          'For long-running surveys, pass since_response_id (the next_cursor from a prior call) to fetch only new raw responses; aggregates always reflect the full survey. ' +
          'Use is_final + completion_reason to detect terminal state, and next_check_hint_seconds as an advisory poll cadence.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          {
            name: 'since_response_id',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Optional. Pass the next_cursor returned from a prior call to filter raw[] to responses received since then. Aggregates ignore this — they always reflect the full survey.',
          },
        ],
        responses: {
          '200': {
            description: 'Aggregated results, raw responses (optionally cursor-filtered), and lifecycle hints',
            content: {
              'application/json': {
                example: {
                  count: 12,
                  is_final: false,
                  completion_reason: null,
                  next_check_hint_seconds: 600,
                  next_cursor: 'xyz789abcd01',
                  questions: [
                    {
                      id: 'q_0',
                      type: 'scale',
                      label: 'How would you rate the event overall?',
                      min: 1,
                      max: 5,
                      stats: { count: 12, mean: 4.2, median: 4, distribution: { '1': 0, '2': 1, '3': 1, '4': 5, '5': 5 } },
                    },
                    {
                      id: 'q_1',
                      type: 'single_choice',
                      label: 'Would you attend a future event?',
                      options: [{ id: 'opt_0', label: 'Definitely' }, { id: 'opt_1', label: 'Maybe' }, { id: 'opt_2', label: 'Unlikely' }],
                      tally: { opt_0: 8, opt_1: 3, opt_2: 1 },
                    },
                    {
                      id: 'q_2',
                      type: 'text',
                      label: "What's one thing we should improve?",
                      responses: [
                        { value: 'More networking time between sessions', created_at: '2026-04-07T14:00:00.000Z' },
                      ],
                    },
                  ],
                  raw: [
                    { id: 'xyz789abcd01', answers: { q_0: 5, q_1: 'opt_0', q_2: 'More networking time between sessions' }, created_at: '2026-04-07T14:00:00.000Z' },
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Missing or invalid API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '403': {
            description: 'Survey belongs to a different API key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Survey not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
  },
} as const

export async function GET() {
  return NextResponse.json(openApiDocument)
}
