'use client'

import { AlertTriangle } from 'lucide-react'

export function EstimateError() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">
          Something Went Wrong
        </h1>
        <p className="text-lg text-muted-foreground mb-6">
          We had trouble loading this estimate. Please try refreshing the page.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium text-lg active:scale-95 transition-transform"
        >
          Refresh Page
        </button>
      </div>
    </div>
  )
}
