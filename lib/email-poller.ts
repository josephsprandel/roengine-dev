import Imap from 'imap'
import { simpleParser } from 'mailparser'
import { query } from '@/lib/db'

let pollInterval: ReturnType<typeof setInterval> | null = null
let backoffMs = 60_000
const MAX_BACKOFF = 8 * 60_000
const BASE_INTERVAL = 60_000

async function getImapConfig(): Promise<{
  host: string
  port: number
  user: string
  password: string
} | null> {
  if (process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD) {
    return {
      host: process.env.IMAP_HOST,
      port: parseInt(process.env.IMAP_PORT || '993'),
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASSWORD,
    }
  }

  try {
    const result = await query(
      'SELECT imap_host, imap_port, imap_user, imap_password FROM shop_profile LIMIT 1'
    )
    if (result.rows.length > 0 && result.rows[0].imap_host && result.rows[0].imap_user) {
      const row = result.rows[0]
      return {
        host: row.imap_host,
        port: row.imap_port || 993,
        user: row.imap_user,
        password: row.imap_password,
      }
    }
  } catch {
    // shop_profile may not have columns yet
  }

  return null
}

function connectImap(config: { host: string; port: number; user: string; password: string }): Promise<Imap> {
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

    imap.once('ready', () => resolve(imap))
    imap.once('error', (err: Error) => reject(err))
    imap.connect()
  })
}

function openInbox(imap: Imap): Promise<Imap.Box> {
  return new Promise((resolve, reject) => {
    imap.openBox('INBOX', false, (err, box) => {
      if (err) reject(err)
      else resolve(box)
    })
  })
}

function searchUnseen(imap: Imap): Promise<number[]> {
  return new Promise((resolve, reject) => {
    // Only fetch emails from the last 7 days to avoid flooding on first run
    const since = new Date()
    since.setDate(since.getDate() - 7)
    imap.search(['UNSEEN', ['SINCE', since]], (err, results) => {
      if (err) reject(err)
      else resolve(results || [])
    })
  })
}

function fetchMessage(imap: Imap, uid: number): Promise<{ raw: string; uid: number }> {
  return new Promise((resolve, reject) => {
    const fetch = imap.fetch([uid], {
      bodies: '',
      struct: true,
      markSeen: true,
    })

    fetch.on('message', (msg) => {
      let raw = ''
      msg.on('body', (stream) => {
        stream.on('data', (chunk: Buffer) => {
          raw += chunk.toString('utf8')
        })
      })
      msg.once('end', () => resolve({ raw, uid }))
    })

    fetch.once('error', reject)
    fetch.once('end', () => {
      // If no messages were emitted, resolve with empty
    })
  })
}

async function processEmail(raw: string, uid: number): Promise<void> {
  // Check for duplicate
  const existing = await query(
    'SELECT 1 FROM messages WHERE imap_uid = $1 LIMIT 1',
    [String(uid)]
  )
  if (existing.rows.length > 0) return

  const parsed = await simpleParser(raw)

  const fromAddress = parsed.from?.value?.[0]?.address || ''
  const subject = (parsed.subject || '').substring(0, 255)
  const plainText = (parsed.text || '').substring(0, 500)

  // Try to match sender to a customer
  let customerId: number | null = null
  let workOrderId: number | null = null

  if (fromAddress) {
    const customerResult = await query(
      'SELECT id FROM customers WHERE LOWER(email) = LOWER($1) AND is_active = true LIMIT 1',
      [fromAddress]
    )
    if (customerResult.rows.length > 0) {
      customerId = customerResult.rows[0].id

      const woResult = await query(
        'SELECT id FROM work_orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1',
        [customerId]
      )
      if (woResult.rows.length > 0) {
        workOrderId = woResult.rows[0].id
      }
    }
  }

  await query(
    `INSERT INTO messages (work_order_id, customer_id, email_address, subject, message_body, message_type, channel, imap_uid, status, direction, sent_at, created_at)
     VALUES ($1, $2, $3, $4, $5, 'inbound_reply', 'email', $6, 'received', 'inbound', $7, NOW())`,
    [
      workOrderId,
      customerId,
      fromAddress,
      subject,
      plainText,
      String(uid),
      parsed.date || new Date(),
    ]
  )
}

async function pollForNewEmails(): Promise<void> {
  const config = await getImapConfig()
  if (!config) return

  let imap: Imap | null = null

  try {
    imap = await connectImap(config)
    await openInbox(imap)
    const unseenUids = await searchUnseen(imap)

    if (unseenUids.length === 0) {
      backoffMs = BASE_INTERVAL
      imap.end()
      return
    }

    for (const uid of unseenUids) {
      try {
        const { raw } = await fetchMessage(imap, uid)
        await processEmail(raw, uid)
      } catch (err) {
        console.error(`[EMAIL POLLER] Error processing message UID ${uid}:`, err)
      }
    }

    backoffMs = BASE_INTERVAL
    imap.end()
  } catch (err) {
    console.error('[EMAIL POLLER] Connection error:', err)
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF)
    if (imap) {
      try { imap.end() } catch { /* ignore */ }
    }
  }
}

export function startEmailPoller(): void {
  if (pollInterval) return

  console.log('[EMAIL POLLER] Starting IMAP polling (60s interval)')

  // Initial poll after a short delay to let the server finish starting
  setTimeout(() => {
    pollForNewEmails().catch((err) =>
      console.error('[EMAIL POLLER] Initial poll error:', err)
    )
  }, 5_000)

  pollInterval = setInterval(() => {
    pollForNewEmails().catch((err) =>
      console.error('[EMAIL POLLER] Poll error:', err)
    )
  }, backoffMs)
}

export function stopEmailPoller(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
    console.log('[EMAIL POLLER] Stopped')
  }
}

export function restartEmailPoller(): void {
  stopEmailPoller()
  backoffMs = BASE_INTERVAL
  startEmailPoller()
}
