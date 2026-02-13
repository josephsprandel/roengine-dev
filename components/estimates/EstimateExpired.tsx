'use client'

import { Clock } from 'lucide-react'

export function EstimateExpired() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">
          Estimate Expired
        </h1>
        <p className="text-lg text-muted-foreground mb-6">
          This estimate is no longer available. Please contact the shop for an updated estimate.
        </p>
        <p className="text-sm text-muted-foreground">
          If you have questions, please call the shop directly.
        </p>
      </div>
    </div>
  )
}
