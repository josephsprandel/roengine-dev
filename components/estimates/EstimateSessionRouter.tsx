"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { EstimateClient } from "./EstimateClient"
import { Loader2 } from "lucide-react"

interface EstimateSessionRouterProps {
  estimate: any
  token: string
  shopProfile: any
  workOrderId: number
  preview?: boolean
}

/**
 * Client-side wrapper that detects if the viewer is a logged-in staff member.
 * - Staff (no preview): redirects to the internal RO detail view with zero side effects
 * - Staff (preview mode): renders the customer-facing estimate page without tracking
 * - Customer (no auth): renders the customer-facing estimate page and logs the view
 */
export function EstimateSessionRouter({
  estimate,
  token,
  shopProfile,
  workOrderId,
  preview = false,
}: EstimateSessionRouterProps) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const authToken = localStorage.getItem("auth_token")
        if (!authToken) {
          // No auth token — this is a customer. Track the view.
          trackCustomerView(token)
          setChecking(false)
          return
        }

        // Validate the token
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${authToken}` },
        })

        if (res.ok) {
          // Authenticated staff member
          if (preview) {
            // Preview mode: show customer view without tracking
            setChecking(false)
            return
          }

          const data = await res.json()
          const userName = data.user?.name || "Staff"

          // Log staff view (not a customer event)
          try {
            await fetch(`/api/work-orders/${workOrderId}/activity`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                actorType: "staff",
                action: "staff_viewed_estimate_link",
                description: `${userName} viewed estimate link`,
              }),
            })
          } catch {
            // Non-critical
          }

          // Redirect to the internal RO view immediately — zero customer-facing side effects
          router.replace(`/repair-orders/${workOrderId}`)
          return
        }
      } catch {
        // Token invalid or network error — fall through to customer view
      }

      // Invalid/expired token — treat as customer
      trackCustomerView(token)
      setChecking(false)
    }

    checkSession()
  }, [router, workOrderId, token, preview])

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500">Loading estimate...</p>
        </div>
      </div>
    )
  }

  // Customer view — render the estimate page as normal
  return <EstimateClient estimate={estimate} token={token} shopProfile={shopProfile} />
}

/**
 * Fire-and-forget call to record that a customer viewed the estimate.
 * Only called after confirming the viewer is NOT staff.
 */
function trackCustomerView(token: string) {
  fetch(`/api/estimates/${token}/viewed`, { method: "POST" }).catch(() => {
    // Non-critical — estimate still works without tracking
  })
}
