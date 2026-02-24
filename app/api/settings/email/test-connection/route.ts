import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import Imap from 'imap'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, host, port, user, password } = body

    if (!type || !host || !user || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (type === 'smtp') {
      return await testSmtp(host, parseInt(port || '587'), user, password)
    }

    if (type === 'imap') {
      return await testImap(host, parseInt(port || '993'), user, password)
    }

    return NextResponse.json({ error: 'Invalid type. Use smtp or imap.' }, { status: 400 })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Connection test failed'
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 })
  }
}

async function testSmtp(host: string, port: number, user: string, password: string) {
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: password },
    connectionTimeout: 10_000,
  })

  try {
    await transporter.verify()
    transporter.close()
    return NextResponse.json({ success: true, message: 'SMTP connection successful' })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'SMTP connection failed'
    transporter.close()
    return NextResponse.json({ success: false, error: errMsg }, { status: 400 })
  }
}

function testImap(host: string, port: number, user: string, password: string): Promise<NextResponse> {
  return new Promise((resolve) => {
    const imap = new Imap({
      user,
      password,
      host,
      port,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 10_000,
      authTimeout: 10_000,
    })

    const timeout = setTimeout(() => {
      try { imap.end() } catch { /* ignore */ }
      resolve(NextResponse.json({ success: false, error: 'IMAP connection timed out' }, { status: 400 }))
    }, 15_000)

    imap.once('ready', () => {
      clearTimeout(timeout)
      imap.end()
      resolve(NextResponse.json({ success: true, message: 'IMAP connection successful' }))
    })

    imap.once('error', (err: Error) => {
      clearTimeout(timeout)
      try { imap.end() } catch { /* ignore */ }
      resolve(NextResponse.json({ success: false, error: err.message }, { status: 400 }))
    })

    imap.connect()
  })
}
