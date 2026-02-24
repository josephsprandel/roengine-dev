export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startEmailPoller } = await import('./lib/email-poller')
    startEmailPoller()
  }
}
