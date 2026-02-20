/**
 * Customer-Facing Repair Estimate Page (Server Component)
 *
 * Public page - customer views and responds to repair estimate via token URL.
 * Mobile-first design, no login required.
 * Simplified version — no vehicle diagram, just line-item services.
 */

import { RepairEstimateClient } from '@/components/estimates/RepairEstimateClient'
import { EstimateExpired } from '@/components/estimates/EstimateExpired'
import { EstimateNotFound } from '@/components/estimates/EstimateNotFound'
import { EstimateError } from '@/components/estimates/EstimateError'

export const dynamic = 'force-dynamic'

export default async function RepairEstimatePage({
  params
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/repair-estimate/${token}`, {
      cache: 'no-store'
    })

    if (!res.ok) {
      if (res.status === 410) {
        return <EstimateExpired />
      }
      if (res.status === 404) {
        return <EstimateNotFound />
      }
      return <EstimateError />
    }

    const data = await res.json()
    return <RepairEstimateClient estimate={data.estimate} token={token} shopProfile={data.shopProfile} />
  } catch {
    return <EstimateError />
  }
}
