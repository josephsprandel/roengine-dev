'use client'

import { Clock } from 'lucide-react'

export function EstimateNotYetAvailable() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-950/30 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">
          Estimate Not Yet Available
        </h1>
        <p className="text-lg text-muted-foreground mb-6">
          Your estimate is still being prepared. Please check back shortly or contact the shop for more details.
        </p>
        <p className="text-sm text-muted-foreground">
          If you continue to see this message, please reach out to the shop directly.
        </p>
      </div>
    </div>
  )
}
