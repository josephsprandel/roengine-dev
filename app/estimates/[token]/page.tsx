/**
 * Customer-Facing Estimate Page (Server Component)
 *
 * Public page - customer views and responds to estimate via token URL.
 * Mobile-first design, no login required.
 */

import { EstimateSessionRouter } from '@/components/estimates/EstimateSessionRouter'
import { EstimateExpired } from '@/components/estimates/EstimateExpired'
import { EstimateNotFound } from '@/components/estimates/EstimateNotFound'
import { EstimateNotYetAvailable } from '@/components/estimates/EstimateNotYetAvailable'
import { EstimateError } from '@/components/estimates/EstimateError'

export const dynamic = 'force-dynamic'

export default async function EstimatePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ preview?: string }>
}) {
  const { token } = await params
  const { preview } = await searchParams
  const isPreview = preview === 'true'

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/estimates/${token}`, {
      cache: 'no-store'
    })

    if (!res.ok) {
      if (res.status === 410) {
        return <EstimateExpired />
      }
      if (res.status === 404) {
        try {
          const errorData = await res.json()
          if (errorData.reason === 'not_yet_available') {
            return <EstimateNotYetAvailable />
          }
        } catch { /* fall through */ }
        return <EstimateNotFound />
      }
      return <EstimateError />
    }

    const data = await res.json()
    return (
      <EstimateSessionRouter
        estimate={data.estimate}
        token={token}
        shopProfile={data.shopProfile}
        workOrderId={data.estimate.workOrderId}
        preview={isPreview}
      />
    )
  } catch {
    return <EstimateError />
  }
}
