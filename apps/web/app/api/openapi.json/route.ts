import { NextResponse } from 'next/server'

const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Markdown to Survey API',
    version: '0.5.0',
    description:
      'Survey infrastructure for AI agents. Create surveys from Markdown or JSON schema, collect human responses, and retrieve structured results.',
  },
  servers: [{ url: 'https://ask-human.vercel.app' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
      },
    },
  },
  paths: {
    '/api/keys': {
      post: {
        summary: 'Create an API key',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'API key created' },
        },
      },
      get: {
        summary: 'List API key metadata',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'API key metadata' },
        },
      },
    },
    '/api/keys/{id}': {
      delete: {
        summary: 'Revoke the current API key',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '204': { description: 'API key revoked' },
        },
      },
    },
    '/api/surveys': {
      post: {
        summary: 'Create a survey from Markdown or JSON schema',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  markdown: { type: 'string' },
                  schema: { type: 'object' },
                  max_responses: { type: 'integer' },
                  expires_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Survey created' },
          '400': { description: 'Invalid markdown or schema' },
          '401': { description: 'Missing or invalid API key' },
        },
      },
      get: {
        summary: 'List surveys for the current API key',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Survey list' },
        },
      },
    },
    '/api/surveys/{id}': {
      get: {
        summary: 'Fetch public survey metadata and schema',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Survey schema' },
          '404': { description: 'Survey not found' },
        },
      },
      patch: {
        summary: 'Update survey lifecycle fields',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['open', 'closed'] },
                  max_responses: { type: ['integer', 'null'] },
                  expires_at: { type: ['string', 'null'], format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Survey updated' },
        },
      },
    },
    '/api/surveys/{id}/responses': {
      post: {
        summary: 'Submit a survey response',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  answers: { type: 'object' },
                },
                required: ['answers'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Response created' },
          '410': { description: 'Survey closed, expired, or full' },
        },
      },
      get: {
        summary: 'Fetch structured survey results',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Aggregated results and raw responses' },
        },
      },
    },
  },
} as const

export async function GET() {
  return NextResponse.json(openApiDocument)
}
