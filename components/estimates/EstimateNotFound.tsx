'use client'

import { FileQuestion } from 'lucide-react'

export function EstimateNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
          <FileQuestion className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">
          Estimate Not Found
        </h1>
        <p className="text-lg text-muted-foreground mb-6">
          We couldn't find this estimate. The link may be incorrect or the estimate may have been removed.
        </p>
        <p className="text-sm text-muted-foreground">
          Please contact the shop if you believe this is an error.
        </p>
      </div>
    </div>
  )
}
