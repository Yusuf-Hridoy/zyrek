import { RateLimitError } from './providers'
import { extractJson } from './openaiCompat'

export async function anthropicJson(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<unknown> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.4,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const err = await res.json()
      if (err?.error?.message) message = err.error.message
    } catch {
      // keep the status-based message
    }
    if (res.status === 401) {
      throw new Error('Your Claude API key looks invalid. Check it and try again.')
    }
    if (res.status === 429) {
      throw new RateLimitError('anthropic', 'Claude')
    }
    if (res.status === 404) {
      throw new Error(
        `Model "${model}" was not found on Claude — the provider may have retired it. Update the model id in src/lib/providers.ts.`,
      )
    }
    throw new Error(message)
  }

  const data = await res.json()
  const text: string | undefined = data?.content?.find(
    (b: { type: string }) => b.type === 'text',
  )?.text
  if (!text) {
    throw new Error('The model returned an empty response. Try again.')
  }
  return extractJson(text)
}
