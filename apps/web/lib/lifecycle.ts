export type SurveyLifecycle = {
  status?: string | null
  response_count?: number | null
  max_responses?: number | null
  expires_at?: string | null
}

export function getSurveyClosureReason(survey: SurveyLifecycle) {
  if ((survey.status ?? 'open') === 'closed') {
    return 'closed'
  }

  if (survey.expires_at && new Date(survey.expires_at) < new Date()) {
    return 'expired'
  }

  if (
    typeof survey.max_responses === 'number' &&
    typeof survey.response_count === 'number' &&
    survey.response_count >= survey.max_responses
  ) {
    return 'full'
  }

  return null
}

export function isSurveyClosed(survey: SurveyLifecycle) {
  return getSurveyClosureReason(survey) !== null
}
