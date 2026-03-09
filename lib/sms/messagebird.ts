const apiKey = process.env.MESSAGEBIRD_API_KEY
const channelId = process.env.MESSAGEBIRD_CHANNEL_ID
const workspaceId = process.env.MESSAGEBIRD_WORKSPACE_ID

export async function sendViaMessageBird(
  to: string,
  body: string,
  _statusCallbackUrl: string
): Promise<{ sid: string; status: string; from?: string }> {
  if (!apiKey) {
    throw new Error('MESSAGEBIRD_API_KEY not configured.')
  }
  if (!workspaceId) {
    throw new Error('MESSAGEBIRD_WORKSPACE_ID not configured.')
  }
  if (!channelId) {
    throw new Error('MESSAGEBIRD_CHANNEL_ID not configured.')
  }

  const url = `https://api.bird.com/workspaces/${workspaceId}/channels/${channelId}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `AccessKey ${apiKey}`,
    },
    body: JSON.stringify({
      receiver: {
        contacts: [{ identifierValue: to }],
      },
      body: {
        type: 'text',
        text: { text: body },
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.errors?.[0]?.description || err.message || `Bird API error ${res.status}`
    const error: any = new Error(msg)
    error.code = err.errors?.[0]?.code || res.status
    throw error
  }

  const data = await res.json()

  return {
    sid: data.id || data.messageId || `bird_${Date.now()}`,
    status: 'accepted',
    from: data.sender?.connector?.identifierValue || undefined,
  }
}
