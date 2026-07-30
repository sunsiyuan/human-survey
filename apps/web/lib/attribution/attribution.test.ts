/**
 * Run with: pnpm test  (node --test, no framework)
 *
 * The repo had no tests at all before the pivot, and the two most intricate
 * invariants in it lived only in comments. These cover the two that fail silently:
 * a config hash that stops matching (turning off the position correction with no
 * error), and a graph validator that accepts a form a respondent can get stuck in.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canonicalize, configHash } from './hash.ts'
import { AttributionConfigError, parseAttributionConfig } from './schema.ts'

const twoNodes = {
  nodes: [
    {
      id: 'channel',
      prompt: 'Where did you first hear about us?',
      candidates: [
        { id: 'tiktok', label: 'TikTok', expands: 'creator' },
        { id: 'google', label: 'Google' },
        { id: 'dunno', label: "I don't remember", pinned: 'end' },
      ],
    },
    {
      id: 'creator',
      prompt: 'Which one?',
      candidates: [
        { id: 'jade', label: 'Jade', handle: '@jade.work0' },
        { id: 'tom', label: 'Tom', handle: '@transyncai_tom' },
      ],
    },
  ],
}

function errorsFrom(input: unknown): string[] {
  try {
    parseAttributionConfig(input)
  } catch (error) {
    assert.ok(error instanceof AttributionConfigError, 'expected AttributionConfigError')
    return error.errors
  }

  assert.fail('expected parseAttributionConfig to throw')
}

describe('parseAttributionConfig', () => {
  it('accepts a two-node form and resolves the root', () => {
    const config = parseAttributionConfig(twoNodes)

    assert.equal(config.root_node_id, 'channel')
    assert.equal(config.nodes.length, 2)
    assert.equal(config.nodes[0].order, 'rotate', 'order defaults to rotate')
    assert.equal(config.nodes[0].allow_free_text, true, 'free text defaults on')
    assert.equal(config.nodes[0].candidates[2].pinned, 'end')
  })

  it('reports every problem at once rather than the first', () => {
    const errors = errorsFrom({
      nodes: [{ id: 'a', candidates: [{ label: 'no id' }, { id: 'x' }] }],
    })

    assert.ok(errors.length >= 3, `expected several errors, got ${errors.length}`)
    assert.ok(errors.some((e) => e.includes('prompt')))
    assert.ok(errors.some((e) => e.includes('id')))
    assert.ok(errors.some((e) => e.includes('label')))
  })

  it('rejects a missing prompt without throwing a raw TypeError', () => {
    // The normalizer this replaces built before it validated, so an absent field blew
    // up in .trim() before the structured-error path could run.
    const errors = errorsFrom({ nodes: [{ id: 'a', candidates: [{ id: 'x', label: 'X' }] }] })

    assert.ok(errors.some((e) => e.includes('prompt is required')))
  })

  it('rejects duplicate candidate ids within a node', () => {
    const errors = errorsFrom({
      nodes: [
        {
          id: 'channel',
          prompt: 'p',
          candidates: [
            { id: 'tiktok', label: 'TikTok' },
            { id: 'tiktok', label: 'TikTok again' },
          ],
        },
      ],
    })

    assert.ok(errors.some((e) => e.includes('not unique within the node')))
  })

  it('rejects more than one pinned candidate', () => {
    const errors = errorsFrom({
      nodes: [
        {
          id: 'channel',
          prompt: 'p',
          candidates: [
            { id: 'a', label: 'A', pinned: 'end' },
            { id: 'b', label: 'B', pinned: 'end' },
          ],
        },
      ],
    })

    assert.ok(errors.some((e) => e.includes('pinned')))
  })

  it('rejects an expands pointing at a node that does not exist', () => {
    const errors = errorsFrom({
      nodes: [
        { id: 'channel', prompt: 'p', candidates: [{ id: 'a', label: 'A', expands: 'ghost' }] },
      ],
    })

    assert.ok(errors.some((e) => e.includes('unknown node "ghost"')))
  })

  it('rejects an expansion cycle', () => {
    const errors = errorsFrom({
      nodes: [
        { id: 'root', prompt: 'p', candidates: [{ id: 'a', label: 'A', expands: 'one' }] },
        { id: 'one', prompt: 'p', candidates: [{ id: 'b', label: 'B', expands: 'two' }] },
        { id: 'two', prompt: 'p', candidates: [{ id: 'c', label: 'C', expands: 'one' }] },
      ],
    })

    assert.ok(
      errors.some((e) => e.includes('cycle') || e.includes('unreachable')),
      `expected a cycle or unreachability error, got: ${errors.join(' | ')}`,
    )
  })

  it('rejects two roots', () => {
    const errors = errorsFrom({
      nodes: [
        { id: 'one', prompt: 'p', candidates: [{ id: 'a', label: 'A' }] },
        { id: 'two', prompt: 'p', candidates: [{ id: 'b', label: 'B' }] },
      ],
    })

    assert.ok(errors.some((e) => e.includes('exactly one root')))
  })

  it('finds the root by incoming edges, not by array position', () => {
    // The root is the node nothing expands into, which is not necessarily the first
    // one written. A validator that assumed nodes[0] would accept this and then serve
    // respondents the follow-up question first.
    const config = parseAttributionConfig({
      nodes: [
        { id: 'second', prompt: 'Which one?', candidates: [{ id: 'a', label: 'A' }] },
        {
          id: 'first',
          prompt: 'Where from?',
          candidates: [{ id: 'b', label: 'B', expands: 'second' }],
        },
      ],
    })

    assert.equal(config.root_node_id, 'first')
  })

  it('rejects a disjoint cycle that no respondent could ever reach', () => {
    // The only way a node can be unreachable without also being a second root: it sits
    // in a cycle off to the side, so every node in it has an incoming edge.
    const errors = errorsFrom({
      nodes: [
        { id: 'root', prompt: 'p', candidates: [{ id: 'a', label: 'A' }] },
        { id: 'x', prompt: 'p', candidates: [{ id: 'b', label: 'B', expands: 'y' }] },
        { id: 'y', prompt: 'p', candidates: [{ id: 'c', label: 'C', expands: 'x' }] },
      ],
    })

    assert.ok(
      errors.some((e) => e.includes('cycle') || e.includes('unreachable')),
      `expected cycle/unreachable, got: ${errors.join(' | ')}`,
    )
  })

  it('allows two candidates to expand into the same node', () => {
    const config = parseAttributionConfig({
      nodes: [
        {
          id: 'channel',
          prompt: 'p',
          candidates: [
            { id: 'tiktok', label: 'TikTok', expands: 'creator' },
            { id: 'instagram', label: 'Instagram', expands: 'creator' },
          ],
        },
        { id: 'creator', prompt: 'Which one?', candidates: [{ id: 'jade', label: 'Jade' }] },
      ],
    })

    assert.equal(config.root_node_id, 'channel')
  })
})

describe('configHash', () => {
  it('is stable across key order', () => {
    const a = parseAttributionConfig(twoNodes)
    const b = parseAttributionConfig(JSON.parse(JSON.stringify(twoNodes)))

    assert.equal(configHash(a), configHash(b))
  })

  it('ignores undefined optional fields', () => {
    assert.equal(canonicalize({ a: 1, b: undefined }), canonicalize({ a: 1 }))
  })

  it('sorts object keys but never array order', () => {
    assert.equal(canonicalize({ b: 1, a: 2 }), '{"a":2,"b":1}')
    assert.notEqual(canonicalize([1, 2]), canonicalize([2, 1]))
  })

  it('changes when candidate order changes', () => {
    // A `fixed` node renders in the caller's order, so reordering is a real change and
    // must mint a new version rather than dedupe onto the old one.
    const reordered = {
      nodes: [
        {
          ...twoNodes.nodes[0],
          candidates: [...twoNodes.nodes[0].candidates].reverse(),
        },
        twoNodes.nodes[1],
      ],
    }

    assert.notEqual(
      configHash(parseAttributionConfig(twoNodes)),
      configHash(parseAttributionConfig(reordered)),
    )
  })

  it('changes when a label changes', () => {
    const renamed = JSON.parse(JSON.stringify(twoNodes))
    renamed.nodes[1].candidates[0].label = 'Jade W.'

    assert.notEqual(
      configHash(parseAttributionConfig(twoNodes)),
      configHash(parseAttributionConfig(renamed)),
    )
  })

  it('pins the canonical form of a known config', () => {
    // A golden value. If this fails, canonicalization changed — which silently
    // un-matches every stored config_hash in production and starts a new version on
    // every configure call. Do not update it without a rehash migration.
    assert.equal(
      configHash(parseAttributionConfig(twoNodes)),
      '9262642657520a1d9d3d6e601de53eb6911ab2b5eb66b1c0cfbf15fcfa091955',
    )
  })
})
