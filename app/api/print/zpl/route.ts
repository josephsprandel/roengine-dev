import { NextRequest, NextResponse } from 'next/server'
import net from 'net'

const PRINTER_HOST = '192.168.88.122'
const PRINTER_PORT = 9100
const TIMEOUT_MS = 5000

export async function POST(request: NextRequest) {
  try {
    const { zpl } = await request.json()

    if (!zpl || typeof zpl !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid zpl string' }, { status: 400 })
    }

    await new Promise<void>((resolve, reject) => {
      const socket = new net.Socket()

      const cleanup = () => {
        socket.removeAllListeners()
        socket.destroy()
      }

      socket.setTimeout(TIMEOUT_MS)

      socket.on('timeout', () => {
        cleanup()
        reject(new Error('Connection timed out'))
      })

      socket.on('error', (err) => {
        cleanup()
        reject(new Error(`Printer connection failed: ${err.message}`))
      })

      socket.connect(PRINTER_PORT, PRINTER_HOST, () => {
        socket.write(Buffer.from(zpl, 'utf-8'), (err) => {
          cleanup()
          if (err) {
            reject(new Error(`Failed to write to printer: ${err.message}`))
          } else {
            resolve()
          }
        })
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[ZPL Print]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
