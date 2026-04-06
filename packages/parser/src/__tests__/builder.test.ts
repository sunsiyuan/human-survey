import { describe, expect, it } from 'vitest'

import {
  buildSurveyFromInput,
  SurveyInputValidationError,
} from '../index.js'

describe('buildSurveyFromInput', () => {
  it('assigns sequential ids for sections, questions, and options', () => {
    const survey = buildSurveyFromInput({
      title: 'Product Feedback',
      sections: [
        {
          title: 'Usage',
          questions: [
            {
              type: 'single_choice',
              label: 'What is your primary use case?',
              options: [{ label: 'Work' }, { label: 'Personal' }],
            },
            {
              type: 'scale',
              label: 'How satisfied are you overall?',
              min: 1,
              max: 5,
            },
          ],
        },
      ],
    })

    expect(survey).toMatchObject({
      title: 'Product Feedback',
      sections: [
        {
          id: 'section_0',
          title: 'Usage',
          questions: [
            {
              id: 'q_0',
              type: 'single_choice',
              options: [
                { id: 'opt_0', label: 'Work' },
                { id: 'opt_1', label: 'Personal' },
              ],
            },
            {
              id: 'q_1',
              type: 'scale',
              min: 1,
              max: 5,
            },
          ],
        },
      ],
    })
  })

  it('builds matrix questions with generated row and column ids', () => {
    const survey = buildSurveyFromInput({
      title: 'Matrix Survey',
      sections: [
        {
          questions: [
            {
              type: 'matrix',
              label: 'Rate each area',
              rows: [{ label: 'Onboarding' }, { label: 'Support' }],
              columns: [
                {
                  label: 'Rating',
                  options: [{ label: 'Good' }, { label: 'Okay' }, { label: 'Bad' }],
                },
              ],
            },
          ],
        },
      ],
    })

    expect(survey.sections[0].questions[0]).toMatchObject({
      id: 'q_0',
      type: 'matrix',
      rows: [
        { id: 'row_0', label: 'Onboarding', cells: { col_0: '' } },
        { id: 'row_1', label: 'Support', cells: { col_0: '' } },
      ],
      columns: [
        {
          id: 'col_0',
          label: 'Rating',
          options: [
            { id: 'opt_0', label: 'Good' },
            { id: 'opt_1', label: 'Okay' },
            { id: 'opt_2', label: 'Bad' },
          ],
        },
      ],
    })
  })

  it('throws field-level validation errors for invalid input', () => {
    expect(() =>
      buildSurveyFromInput({
        title: '',
        sections: [
          {
            questions: [
              { type: 'single_choice', label: 'Missing options' },
              { type: 'scale', label: 'Broken scale', min: 5, max: 3 },
              { type: 'wat', label: 'Unknown type' },
            ],
          },
        ],
      }),
    ).toThrowError(SurveyInputValidationError)

    try {
      buildSurveyFromInput({
        title: '',
        sections: [
          {
            questions: [
              { type: 'single_choice', label: 'Missing options' },
              { type: 'scale', label: 'Broken scale', min: 5, max: 3 },
              { type: 'wat', label: 'Unknown type' },
            ],
          },
        ],
      })
    } catch (error) {
      expect(error).toBeInstanceOf(SurveyInputValidationError)
      expect((error as SurveyInputValidationError).errors).toEqual([
        'title is required',
        "sections[0].questions[0].options is required for type 'single_choice'",
        'sections[0].questions[1].min must be less than max',
        "sections[0].questions[2].type 'wat' is not a valid question type",
      ])
    }
  })

  it('throws when the scale range exceeds 11 points', () => {
    expect(() =>
      buildSurveyFromInput({
        title: 'Too Wide',
        sections: [
          {
            questions: [
              { type: 'scale', label: 'Rate it', min: 1, max: 12 },
            ],
          },
        ],
      }),
    ).toThrowError(SurveyInputValidationError)
  })

  it('accepts validated showIf conditions in JSON schema input', () => {
    const survey = buildSurveyFromInput({
      title: 'Conditional Survey',
      sections: [
        {
          questions: [
            {
              type: 'single_choice',
              label: 'Have you used it before?',
              options: [{ label: 'Yes' }, { label: 'No' }],
            },
            {
              type: 'text',
              label: 'What stopped you?',
              showIf: {
                questionId: 'q_0',
                operator: 'eq',
                value: 'No',
              },
            },
          ],
        },
      ],
    })

    expect(survey.sections[0].questions[1].showIf).toMatchObject({
      questionId: 'q_0',
      operator: 'eq',
      value: 'No',
    })
  })

  it('rejects invalid showIf references', () => {
    expect(() =>
      buildSurveyFromInput({
        title: 'Broken Conditional Survey',
        sections: [
          {
            questions: [
              {
                type: 'text',
                label: 'Hidden question',
                showIf: {
                  questionId: 'q_99',
                  operator: 'answered',
                },
              },
            ],
          },
        ],
      }),
    ).toThrowError(SurveyInputValidationError)
  })
})
