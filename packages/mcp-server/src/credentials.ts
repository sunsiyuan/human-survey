import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Where the API key lives.
 *
 * HUMANSURVEY_API_KEY is canonical, because the primary path is a human copying a key out
 * of the dashboard and pasting it into their MCP config — where it lands on disk by
 * construction and survives every restart.
 *
 * The file below is for the other path: someone who would rather not open a browser and
 * uses the `login` tool instead. It exists because of a specific failure in the version
 * this replaces, which minted a key, assigned it to `process.env` inside the running
 * process, and printed it with "save this somewhere — it cannot be retrieved again". The
 * key then lived in exactly one place, a conversation transcript, and conversations end.
 * People lost their keys, and with them the only proof of ownership of everything the key
 * had created.
 *
 * 0600 because it is a bearer credential. Written with mode on create AND chmod'd after,
 * since an existing file keeps its old mode through a write.
 */

const DIR = join(homedir(), '.humansurvey')
const FILE = join(DIR, 'credentials')

export function resolveApiKey(): string | null {
  const fromEnv = process.env.HUMANSURVEY_API_KEY?.trim()

  if (fromEnv) {
    return fromEnv
  }

  try {
    const stored = readFileSync(FILE, 'utf8').trim()
    return stored.length > 0 ? stored : null
  } catch {
    return null
  }
}

export function storeApiKey(key: string): string {
  mkdirSync(DIR, { recursive: true, mode: 0o700 })
  writeFileSync(FILE, `${key}\n`, { mode: 0o600 })
  chmodSync(FILE, 0o600)

  return FILE
}

export const CREDENTIALS_PATH = FILE
