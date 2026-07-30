import {
  neon,
  neonConfig,
  Pool,
  type NeonQueryFunction,
  type NeonQueryPromise,
} from '@neondatabase/serverless'

let client: NeonQueryFunction<false, false> | null = null

function databaseUrl() {
  const url = process.env.DATABASE_URL

  if (!url) {
    throw new Error(
      'No database connection string was provided to `neon()`. Perhaps an environment variable has not been set?',
    )
  }

  return url
}

function getClient() {
  if (client) {
    return client
  }

  client = neon(databaseUrl())
  return client
}

export const sql = new Proxy((() => {}) as unknown as NeonQueryFunction<false, false>, {
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

/**
 * Run several statements as one atomic unit over the HTTP driver.
 *
 * Use this whenever more than one row has to change together. Before the
 * attribution pivot this codebase performed zero multi-statement transactions —
 * every multi-step flow was a series of independent round-trips — which is fine for
 * an append-only survey table and is not fine for a schema where completing a
 * response has to insert an answer row and stamp the completion in the same breath.
 *
 * The tagged templates are NOT awaited before being passed in. `sql\`...\`` builds a
 * query object and only executes when awaited or handed to `transaction`, so:
 *
 *     await tx([
 *       sql`INSERT INTO attribution_answers ...`,
 *       sql`UPDATE attribution_responses SET completed_at = now() WHERE id = ${id}`,
 *     ])
 *
 * Awaiting one of them first silently turns it into a separate, already-committed
 * statement — the transaction still "succeeds" while having done half its work
 * outside the transaction.
 */
export function tx(queries: NeonQueryPromise<false, false, unknown>[]) {
  return getClient().transaction(queries as never)
}

/**
 * Interactive transaction, for the cases `tx()` cannot express: when a later
 * statement depends on an earlier statement's result and cannot be folded into a
 * single SQL statement with CTEs.
 *
 * This opens a real pooled connection over a WebSocket rather than going through the
 * stateless HTTP endpoint, so it is meaningfully more expensive. Reach for `tx()`
 * first; reach for a single CTE statement before that.
 *
 * The callback receives a `pg`-compatible client. It runs inside BEGIN/COMMIT and is
 * rolled back if it throws.
 */
export async function withTransaction<T>(
  fn: (client: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
  }) => Promise<T>,
): Promise<T> {
  // Node 22+ and the Vercel Node runtime both expose a global WebSocket, so this is
  // usually already satisfied. Set it explicitly anyway: when it is missing, the
  // driver's failure is an opaque connection error rather than a clear one.
  if (!neonConfig.webSocketConstructor && typeof globalThis.WebSocket !== 'undefined') {
    neonConfig.webSocketConstructor = globalThis.WebSocket as never
  }

  const pool = new Pool({ connectionString: databaseUrl() })

  try {
    const connection = await pool.connect()

    try {
      await connection.query('BEGIN')
      const result = await fn(connection as never)
      await connection.query('COMMIT')
      return result
    } catch (error) {
      await connection.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      connection.release()
    }
  } finally {
    await pool.end()
  }
}

export function parseJsonValue<T>(value: unknown): T {
  if (typeof value === 'string') {
    return JSON.parse(value) as T
  }

  return value as T
}
