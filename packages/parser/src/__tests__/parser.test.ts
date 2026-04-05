import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { parseSurvey } from '../index.js'

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
const sampleSurvey = readFileSync(join(fixtureDir, 'sample-survey.md'), 'utf8')

describe('parseSurvey', () => {
  const survey = parseSurvey(sampleSurvey)
  const introSection = survey.sections[0]
  const sectionA = survey.sections[1]
  const sectionB = survey.sections[2]
  const sectionC = survey.sections[3]

  it('parses title correctly', () => {
    expect(survey.title).toBe('Product Feedback Survey')
  })

  it('parses description from the instructions text', () => {
    expect(survey.description).toContain('Help us improve our product')
  })

  it('creates intro plus sections A, B, and C', () => {
    expect(survey.sections).toHaveLength(4)
    expect(introSection.title).toBeUndefined()
    expect(sectionA.title).toBe('A. Basic Information')
    expect(sectionB.title).toBe('B. Rate These Promotions')
    expect(sectionC.title).toBe('C. Preferences')
  })

  it('parses question A2 as single choice with 4 options', () => {
    const question = sectionA.questions.find((item) => item.label.startsWith('A2.'))

    expect(question?.type).toBe('single_choice')
    expect(question?.options).toHaveLength(4)
  })

  it('parses question A3 as multi choice', () => {
    const question = sectionA.questions.find((item) => item.label.startsWith('A3.'))

    expect(question?.type).toBe('multi_choice')
  })

  it('creates a matrix question with 4 rows in section B', () => {
    const question = sectionB.questions.find((item) => item.type === 'matrix')

    expect(question?.rows).toHaveLength(4)
  })

  it('parses question C3 as text', () => {
    const question = sectionC.questions.find((item) => item.label.startsWith('C3.'))

    expect(question?.type).toBe('text')
  })

  it('marks options with Other text input correctly', () => {
    const question = sectionB.questions.find((item) => item.label.startsWith('B follow-up'))
    const option = question?.options?.find((item) => item.label.startsWith('Other:'))

    expect(option?.hasTextInput).toBe(true)
  })

  it('throws a clear error on empty markdown', () => {
    expect(() => parseSurvey('   \n\t')).toThrowError('Markdown input cannot be empty.')
  })

  it('supports minimal markdown with a title and one question', () => {
    const minimal = parseSurvey(`# Tiny Survey\n\n**Q1. Pick one?**\n\n- ☐ Yes\n- ☐ No`)

    expect(minimal.title).toBe('Tiny Survey')
    expect(minimal.sections).toHaveLength(1)
    expect(minimal.sections[0].questions).toHaveLength(1)
    expect(minimal.sections[0].questions[0]).toMatchObject({
      label: 'Q1. Pick one?',
      type: 'single_choice',
    })
  })
})
