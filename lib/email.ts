import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import Imap from 'imap'
import { query } from '@/lib/db'
import { getShopInfo } from '@/lib/email-templates'

const isDryRun = process.env.EMAIL_DRY_RUN === 'true'

let cachedTransporter: Transporter | null = null

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  text: string
  workOrderId?: number
  customerId?: number
  messageType: string
  templateId?: string
  templateData?: Record<string, unknown>
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  dbMessageId?: number
  error?: string
  dryRun?: boolean
}

async function getSmtpConfig(): Promise<{
  host: string
  port: number
  user: string
  password: string
  fromEmail: string
} | null> {
  // Try env vars first
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    return {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
    }
  }

  // Fallback to shop_profile
  try {
    const result = await query(
      'SELECT smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_email FROM shop_profile LIMIT 1'
    )
    if (result.rows.length > 0 && result.rows[0].smtp_host && result.rows[0].smtp_user) {
      const row = result.rows[0]
      return {
        host: row.smtp_host,
        port: row.smtp_port || 587,
        user: row.smtp_user,
        password: row.smtp_password,
        fromEmail: row.smtp_from_email || row.smtp_user,
      }
    }
  } catch {
    // shop_profile may not have columns yet if migration hasn't run
  }

  return null
}

async function getTransporter(): Promise<Transporter> {
  if (cachedTransporter) return cachedTransporter

  const config = await getSmtpConfig()
  if (!config) {
    throw new Error('SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD env vars or configure in Settings.')
  }

  const secure = config.port === 465

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure,
    name: 'autohousenwa.com',
    auth: {
      user: config.user,
      pass: config.password,
    },
  })

  return cachedTransporter
}

export function resetTransporter(): void {
  cachedTransporter = null
}

export function validateEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const SENT_FOLDER_NAMES = ['Sent', 'INBOX.Sent', 'Sent Items', 'Sent Messages']

function appendToSentFolder(rawMessage: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: process.env.IMAP_USER!,
      password: process.env.IMAP_PASSWORD!,
      host: process.env.IMAP_HOST!,
      port: parseInt(process.env.IMAP_PORT || '993'),
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 15_000,
      authTimeout: 10_000,
    })

    imap.once('ready', () => {
      // List mailboxes to find the correct Sent folder name
      imap.getBoxes((err, boxes) => {
        if (err) {
          console.error('[EMAIL] Failed to list mailboxes:', err)
          imap.end()
          return reject(err)
        }

        // Find the Sent folder
        let sentFolder = 'Sent'
        const topLevel = Object.keys(boxes)

        for (const name of SENT_FOLDER_NAMES) {
          // Check top-level
          if (topLevel.includes(name)) {
            sentFolder = name
            break
          }
          // Check INBOX children (e.g. INBOX.Sent)
          if (name.startsWith('INBOX.') && boxes['INBOX']?.children) {
            const child = name.replace('INBOX.', '')
            if (Object.keys(boxes['INBOX'].children).includes(child)) {
              sentFolder = name
              break
            }
          }
        }

        imap.append(rawMessage, { mailbox: sentFolder, flags: ['\\Seen'] }, (appendErr) => {
          imap.end()
          if (appendErr) {
            console.error(`[EMAIL] IMAP append error:`, appendErr)
            return reject(appendErr)
          }
          resolve()
        })
      })
    })

    imap.once('error', (err: Error) => {
      console.error('[EMAIL] IMAP connection error (Sent append):', err.message)
      reject(err)
    })

    imap.connect()
  })
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  workOrderId,
  customerId,
  messageType,
  templateId,
  templateData,
}: SendEmailParams): Promise<SendEmailResult> {
  if (!validateEmailAddress(to)) {
    return { success: false, error: 'Invalid email address' }
  }

  const bodyPreview = text.substring(0, 500)

  if (isDryRun) {
    const result = await query(
      `INSERT INTO messages (work_order_id, customer_id, email_address, subject, message_body, message_type, channel, template_id, template_data, status, direction, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'email', $7, $8, 'sent', 'outbound', NOW())
       RETURNING id`,
      [
        workOrderId || null,
        customerId || null,
        to,
        subject,
        bodyPreview,
        messageType,
        templateId || null,
        templateData ? JSON.stringify(templateData) : null,
      ]
    )

    return {
      success: true,
      messageId: `DRY_RUN_${Date.now()}`,
      dbMessageId: result.rows[0].id,
      dryRun: true,
    }
  }

  try {
    const transporter = await getTransporter()
    const config = await getSmtpConfig()
    const fromEmail = config?.fromEmail || process.env.SMTP_USER || 'noreply@localhost'
    const shopInfo = await getShopInfo()

    const info = await transporter.sendMail({
      from: `${shopInfo.name} <${fromEmail}>`,
      to,
      subject,
      html,
      text,
    })

    // Append to IMAP Sent folder (fire-and-forget, don't block the response)
    if (process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD) {
      const rawMessage = [
        `From: ${shopInfo.name} <${fromEmail}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `Message-ID: ${info.messageId}`,
        `Date: ${new Date().toUTCString()}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="----=_Part_boundary"`,
        ``,
        `------=_Part_boundary`,
        `Content-Type: text/plain; charset=utf-8`,
        ``,
        text,
        `------=_Part_boundary`,
        `Content-Type: text/html; charset=utf-8`,
        ``,
        html,
        `------=_Part_boundary--`,
      ].join('\r\n')

      appendToSentFolder(rawMessage).catch((err) => {
        console.error('[EMAIL] Failed to append to Sent folder:', err)
      })
    }

    const result = await query(
      `INSERT INTO messages (work_order_id, customer_id, email_address, subject, message_body, message_type, channel, template_id, template_data, status, direction, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'email', $7, $8, 'sent', 'outbound', NOW())
       RETURNING id`,
      [
        workOrderId || null,
        customerId || null,
        to,
        subject,
        bodyPreview,
        messageType,
        templateId || null,
        templateData ? JSON.stringify(templateData) : null,
      ]
    )

    return {
      success: true,
      messageId: info.messageId,
      dbMessageId: result.rows[0].id,
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to send email'
    const errCode = error instanceof Error && 'code' in error ? String((error as { code: unknown }).code) : ''
    console.error('[EMAIL] Send error:', errMsg)

    await query(
      `INSERT INTO messages (work_order_id, customer_id, email_address, subject, message_body, message_type, channel, status, direction, error_code, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, 'email', 'failed', 'outbound', $7, $8)
       RETURNING id`,
      [
        workOrderId || null,
        customerId || null,
        to,
        subject,
        bodyPreview,
        messageType,
        errCode,
        errMsg,
      ]
    )

    return { success: false, error: errMsg }
  }
}

export async function checkEmailConsent(customerId: number): Promise<{ consent: boolean }> {
  const result = await query(
    'SELECT email_consent FROM customers WHERE id = $1',
    [customerId]
  )
  if (result.rows.length === 0) {
    return { consent: false }
  }
  return { consent: result.rows[0].email_consent || false }
}

export async function updateEmailConsent(customerId: number, consent: boolean): Promise<void> {
  if (consent) {
    await query(
      `UPDATE customers SET email_consent = true, email_consent_at = NOW() WHERE id = $1`,
      [customerId]
    )
  } else {
    await query(
      `UPDATE customers SET email_consent = false, email_consent_at = NULL WHERE id = $1`,
      [customerId]
    )
  }
}
