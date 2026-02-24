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
}

/**
 * Client-side wrapper that detects if the viewer is a logged-in staff member.
 * - Staff: redirects to the internal RO detail view
 * - Customer (no auth): renders the customer-facing estimate page
 */
export function EstimateSessionRouter({
  estimate,
  token,
  shopProfile,
  workOrderId,
}: EstimateSessionRouterProps) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const authToken = localStorage.getItem("auth_token")
        if (!authToken) {
          setChecking(false)
          return
        }

        // Validate the token
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${authToken}` },
        })

        if (res.ok) {
          const data = await res.json()
          const userName = data.user?.name || "Staff"

          // Log staff view
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

          // Redirect to the internal RO view
          router.replace(`/repair-orders/${workOrderId}`)
          return
        }
      } catch {
        // Token invalid or network error — fall through to customer view
      }

      setChecking(false)
    }

    checkSession()
  }, [router, workOrderId])

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
