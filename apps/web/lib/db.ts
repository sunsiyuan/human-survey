import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

let client: NeonQueryFunction<false, false> | null = null

function getClient() {
  if (client) {
    return client
  }

  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error(
      'No database connection string was provided to `neon()`. Perhaps an environment variable has not been set?',
    )
  }

  client = neon(databaseUrl)
  return client
}

export const sql = new Proxy({} as NeonQueryFunction<false, false>, {
  apply(_target, thisArg, argArray) {
    return Reflect.apply(getClient(), thisArg, argArray)
  },
  get(_target, property) {
    const target = getClient()
    const value = Reflect.get(target, property)

    if (typeof value === 'function') {
      return value.bind(target)
    }

    return value
  },
})

export function parseJsonValue<T>(value: unknown): T {
  if (typeof value === 'string') {
    return JSON.parse(value) as T
  }

  return value as T
}
