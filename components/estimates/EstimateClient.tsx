'use client'

import { useState } from 'react'
import { CheckCircle, ChevronDown, ChevronUp, Car, User, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface EstimateService {
  id: number
  title: string
  customerExplanation: string
  estimatedCost: number
  status: string
}

interface EstimateData {
  id: number
  status: string
  totalAmount: number
  approvedAmount: number
  expiresAt: string
  respondedAt: string | null
  customer: {
    firstName: string
    lastName: string
    email: string
    phone: string
  }
  vehicle: {
    year: number
    make: string
    model: string
    vin: string
  }
  services: EstimateService[]
}

interface EstimateClientProps {
  estimate: EstimateData
  token: string
}

export function EstimateClient({ estimate, token }: EstimateClientProps) {
  const [selectedServices, setSelectedServices] = useState<Set<number>>(
    new Set(estimate.services.filter(s => s.status !== 'declined').map(s => s.id))
  )
  const [declineReasons, setDeclineReasons] = useState<Record<number, string>>({})
  const [customerNotes, setCustomerNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(estimate.respondedAt !== null)
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set())
  const [submitResult, setSubmitResult] = useState<{
    status: string
    approvedAmount: number
    approvedServices: number
    declinedServices: number
  } | null>(null)

  // Already responded
  if (submitted && !submitResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Already Submitted
          </h1>
          <p className="text-lg text-muted-foreground">
            You've already responded to this estimate. If you need to make changes, please contact the shop.
          </p>
        </div>
      </div>
    )
  }

  // Success state
  if (submitted && submitResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Thank You!
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            Your response has been submitted successfully.
          </p>

          <div className="bg-muted/50 rounded-xl p-6 text-left space-y-3">
            {submitResult.approvedServices > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Approved services</span>
                <span className="font-semibold text-green-600">{submitResult.approvedServices}</span>
              </div>
            )}
            {submitResult.declinedServices > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Declined services</span>
                <span className="font-semibold text-muted-foreground">{submitResult.declinedServices}</span>
              </div>
            )}
            {submitResult.approvedAmount > 0 && (
              <div className="flex justify-between border-t border-border pt-3">
                <span className="text-muted-foreground">Approved total</span>
                <span className="font-bold text-lg">${submitResult.approvedAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground mt-6">
            The shop has been notified and your service advisor will review your selections.
          </p>
        </div>
      </div>
    )
  }

  const toggleService = (id: number) => {
    setSelectedServices(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleExpanded = (id: number) => {
    setExpandedServices(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectedTotal = estimate.services
    .filter(s => selectedServices.has(s.id))
    .reduce((sum, s) => sum + s.estimatedCost, 0)

  const handleSubmit = async () => {
    setSubmitting(true)

    const approvedServiceIds = Array.from(selectedServices)
    const declinedServicesPayload = estimate.services
      .filter(s => !selectedServices.has(s.id))
      .map(s => ({ id: s.id, reason: declineReasons[s.id] || 'Not at this time' }))

    try {
      const res = await fetch(`/api/estimates/${token}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvedServiceIds,
          declinedServices: declinedServicesPayload,
          customerNotes: customerNotes.trim() || undefined
        })
      })

      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || 'Failed to submit. Please try again.')
        return
      }

      const result = await res.json()
      setSubmitResult(result.estimate)
      setSubmitted(true)
    } catch {
      toast.error('Failed to submit. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeclineAll = () => {
    setSelectedServices(new Set())
  }

  const handleSelectAll = () => {
    setSelectedServices(new Set(estimate.services.map(s => s.id)))
  }

  // Calculate time remaining
  const expiresAt = new Date(estimate.expiresAt)
  const now = new Date()
  const hoursLeft = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)))
  const daysLeft = Math.floor(hoursLeft / 24)
  const expiresText = daysLeft > 0
    ? `Expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`
    : `Expires in ${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}`

  return (
    <div className="min-h-screen bg-background pb-36">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-5 sm:px-6">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-foreground mb-1">
            Service Estimate
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <User className="w-4 h-4 flex-shrink-0" />
            <span className="text-base">
              {estimate.customer.firstName} {estimate.customer.lastName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Car className="w-4 h-4 flex-shrink-0" />
            <span className="text-base">
              {estimate.vehicle.year} {estimate.vehicle.make} {estimate.vehicle.model}
            </span>
          </div>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium">{expiresText}</span>
          </div>
        </div>
      </div>

      {/* Services List */}
      <div className="max-w-lg mx-auto px-4 py-5 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-foreground">
            Recommended Services ({estimate.services.length})
          </h2>
          <button
            onClick={selectedServices.size === estimate.services.length ? handleDeclineAll : handleSelectAll}
            className="text-sm text-primary font-medium active:opacity-70"
          >
            {selectedServices.size === estimate.services.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {estimate.services.map((service) => {
          const isSelected = selectedServices.has(service.id)
          const isExpanded = expandedServices.has(service.id)
          const explanation = service.customerExplanation || ''
          const needsExpand = explanation.length > 150

          return (
            <div
              key={service.id}
              className={`rounded-xl border-2 transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card'
              }`}
            >
              {/* Service Header - Tappable */}
              <button
                onClick={() => toggleService(service.id)}
                className="w-full text-left p-4 flex items-start gap-3 active:bg-accent/50 transition-colors"
              >
                {/* Custom Checkbox */}
                <div className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-primary border-primary'
                    : 'border-muted-foreground/40 bg-background'
                }`}>
                  {isSelected && (
                    <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-foreground leading-tight">
                      {service.title}
                    </h3>
                    <span className="text-lg font-bold text-foreground flex-shrink-0">
                      ${service.estimatedCost.toFixed(2)}
                    </span>
                  </div>

                  {/* Explanation preview */}
                  <p className={`text-sm text-muted-foreground mt-2 leading-relaxed ${
                    !isExpanded && needsExpand ? 'line-clamp-3' : ''
                  }`}>
                    {explanation}
                  </p>
                </div>
              </button>

              {/* Expand/collapse for long explanations */}
              {needsExpand && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleExpanded(service.id)
                  }}
                  className="w-full px-4 pb-3 flex items-center justify-center gap-1 text-xs text-primary font-medium active:opacity-70"
                >
                  {isExpanded ? (
                    <>Show less <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>Read more <ChevronDown className="w-3 h-3" /></>
                  )}
                </button>
              )}

              {/* Decline reason - shown when unchecked */}
              {!isSelected && (
                <div className="px-4 pb-4 pt-1">
                  <input
                    type="text"
                    placeholder="Reason (optional)"
                    value={declineReasons[service.id] || ''}
                    onChange={(e) => {
                      e.stopPropagation()
                      setDeclineReasons(prev => ({ ...prev, [service.id]: e.target.value }))
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Additional Notes */}
        <div className="pt-2">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="text-sm text-primary font-medium flex items-center gap-1 active:opacity-70"
          >
            {showNotes ? 'Hide' : 'Add'} additional notes
            {showNotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showNotes && (
            <textarea
              placeholder="Any comments or questions for the shop..."
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              rows={3}
              className="mt-2 w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          )}
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
          {/* Summary */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedServices.size} of {estimate.services.length} selected
            </span>
            <span className="text-2xl font-bold text-foreground">
              ${selectedTotal.toFixed(2)}
            </span>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all active:scale-[0.98] ${
              selectedServices.size > 0
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {submitting
              ? 'Submitting...'
              : selectedServices.size > 0
                ? `Approve ${selectedServices.size} Service${selectedServices.size > 1 ? 's' : ''}`
                : 'Decline All Services'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
