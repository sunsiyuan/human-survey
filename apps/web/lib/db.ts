import { neon } from '@neondatabase/serverless'

export const sql = neon(process.env.DATABASE_URL!)

export function parseJsonValue<T>(value: unknown): T {
  if (typeof value === 'string') {
    return JSON.parse(value) as T
  }

  return value as T
}
