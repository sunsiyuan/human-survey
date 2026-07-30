/**
 * Transactional email. One message type today: the six-digit login code.
 *
 * Talks to Resend over plain fetch rather than pulling in their SDK — one endpoint,
 * one request shape, and the app already has no runtime dependency beyond the
 * database driver and nanoid. Not worth a package.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export class EmailError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'EmailError'
    this.status = status
  }
}

type SendArgs = {
  to: string
  subject: string
  text: string
  html: string
}

async function send({ to, subject, text, html }: SendArgs) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    throw new EmailError('RESEND_API_KEY and EMAIL_FROM must be set', 500)
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    // Both parts on purpose. A code-only email that is HTML-only lands in more spam
    // filters, and a text part is what a terminal-based mail client shows the person
    // who is signing in from an agent session in the first place.
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new EmailError(`Resend rejected the message (${response.status}): ${detail}`, 502)
  }
}

/**
 * The login code email.
 *
 * The code is in the subject line as well as the body. That is not redundancy — it
 * means the recipient can read it straight from a notification or an inbox list
 * without opening anything, which is the difference between a five-second sign-in and
 * a thirty-second one. It matters more here than for a typical product because one of
 * the two flows has a person reading the code out to an agent.
 */
export async function sendLoginCode(to: string, code: string) {
  const text = [
    `${code} is your HumanSurvey sign-in code.`,
    '',
    'It expires in 10 minutes and can only be used once.',
    '',
    'If you did not ask to sign in, you can ignore this — nobody can do anything',
    'with your account without this code.',
  ].join('\n')

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:32px;background:#f8fafc;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a">
    <div style="max-width:420px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px">
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5">Your HumanSurvey sign-in code:</p>
      <p style="margin:0 0 24px;font-size:34px;font-weight:600;letter-spacing:0.16em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${code}</p>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#475569">Expires in 10 minutes. Single use.</p>
      <p style="margin:0;font-size:14px;line-height:1.5;color:#475569">If you didn't ask to sign in, you can ignore this email.</p>
    </div>
  </body>
</html>`

  await send({
    to,
    subject: `${code} is your HumanSurvey code`,
    text,
    html,
  })
}
