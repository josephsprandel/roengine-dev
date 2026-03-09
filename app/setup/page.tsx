"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Loader2 } from "lucide-react"
import { SetupWizard } from "@/components/setup/setup-wizard"

export default function SetupPage() {
  const { user, roles, isLoading: authLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const [setupStatus, setSetupStatus] = useState<{
    setup_complete: boolean
    setup_step_completed: number
    setup_steps_skipped: string[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    async function checkSetup() {
      try {
        const res = await fetch('/api/setup')
        if (res.ok) {
          const data = await res.json()
          if (data.setup_complete) {
            router.push('/')
            return
          }
          setSetupStatus(data)
        }
      } catch {
        // If API fails, show wizard at step 0
        setSetupStatus({ setup_complete: false, setup_step_completed: 0, setup_steps_skipped: [] })
      } finally {
        setLoading(false)
      }
    }

    checkSetup()
  }, [authLoading, isAuthenticated, router])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!setupStatus) return null

  return (
    <SetupWizard
      initialStep={setupStatus.setup_step_completed}
      skippedSteps={setupStatus.setup_steps_skipped}
    />
  )
}
