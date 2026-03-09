import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID

function getTwilioClient() {
  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.')
  }
  return twilio(accountSid, authToken)
}

export async function sendViaTwilio(
  to: string,
  body: string,
  statusCallbackUrl: string
): Promise<{ sid: string; status: string; from?: string }> {
  const client = getTwilioClient()

  if (!messagingServiceSid) {
    throw new Error('TWILIO_MESSAGING_SERVICE_SID not configured.')
  }

  const message = await client.messages.create({
    messagingServiceSid,
    to,
    body,
    statusCallback: statusCallbackUrl,
  })

  return {
    sid: message.sid,
    status: message.status || 'queued',
    from: message.from || undefined,
  }
}
