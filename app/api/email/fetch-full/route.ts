import { NextRequest, NextResponse } from 'next/server'
import Imap from 'imap'
import { simpleParser } from 'mailparser'
import { query } from '@/lib/db'
import { generateEmailFromTemplate, type EmailTemplateId } from '@/lib/email-templates'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const messageId = searchParams.get('messageId')

    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
    }

    const result = await query(
      'SELECT * FROM messages WHERE id = $1',
      [parseInt(messageId)]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    const msg = result.rows[0]

    // Outbound email: reconstruct from template
    if (msg.direction === 'outbound' && msg.template_id && msg.template_data) {
      const templateData = typeof msg.template_data === 'string'
        ? JSON.parse(msg.template_data)
        : msg.template_data
      const template = await generateEmailFromTemplate(msg.template_id as EmailTemplateId, templateData)
      return NextResponse.json({
        subject: msg.subject || template.subject,
        html: template.html,
        text: template.text,
      })
    }

    // Inbound email: fetch from IMAP by uid
    if (msg.direction === 'inbound' && msg.imap_uid) {
      const imapConfig = getImapConfig()
      if (!imapConfig) {
        return NextResponse.json({
          subject: msg.subject,
          text: msg.message_body,
          html: null,
          note: 'IMAP not configured — showing preview only',
        })
      }

      try {
        const fullEmail = await fetchFromImap(imapConfig, parseInt(msg.imap_uid))
        return NextResponse.json({
          subject: fullEmail.subject || msg.subject,
          html: fullEmail.html || null,
          text: fullEmail.text || msg.message_body,
          from: fullEmail.from,
          date: fullEmail.date,
        })
      } catch (err) {
        console.error('[EMAIL FETCH] IMAP fetch error:', err)
        return NextResponse.json({
          subject: msg.subject,
          text: msg.message_body,
          html: null,
          note: 'Could not fetch full email from IMAP — showing preview only',
        })
      }
    }

    // Fallback: just return stored preview
    return NextResponse.json({
      subject: msg.subject,
      text: msg.message_body,
      html: null,
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to fetch email'
    console.error('[EMAIL FETCH] Error:', error)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

function getImapConfig(): { host: string; port: number; user: string; password: string } | null {
  if (process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD) {
    return {
      host: process.env.IMAP_HOST,
      port: parseInt(process.env.IMAP_PORT || '993'),
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASSWORD,
    }
  }
  return null
}

function fetchFromImap(
  config: { host: string; port: number; user: string; password: string },
  uid: number
): Promise<{ subject?: string; html?: string; text?: string; from?: string; date?: Date }> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 10_000,
      authTimeout: 10_000,
    })

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err) => {
        if (err) {
          imap.end()
          return reject(err)
        }

        const fetch = imap.fetch([uid], { bodies: '' })
        let raw = ''

        fetch.on('message', (msg) => {
          msg.on('body', (stream) => {
            stream.on('data', (chunk: Buffer) => {
              raw += chunk.toString('utf8')
            })
          })
          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(raw)
              imap.end()
              resolve({
                subject: parsed.subject,
                html: typeof parsed.html === 'string' ? parsed.html : undefined,
                text: parsed.text,
                from: parsed.from?.value?.[0]?.address,
                date: parsed.date,
              })
            } catch (parseErr) {
              imap.end()
              reject(parseErr)
            }
          })
        })

        fetch.once('error', (fetchErr) => {
          imap.end()
          reject(fetchErr)
        })
      })
    })

    imap.once('error', reject)
    imap.connect()
  })
}
