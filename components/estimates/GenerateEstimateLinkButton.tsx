'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Copy, Send, Loader2, Check } from 'lucide-react'

interface Recommendation {
  id: number
  service_title: string
  estimated_cost: number
  status: string
  reason?: string
}

interface GenerateEstimateLinkButtonProps {
  workOrderId: number
  recommendations: Recommendation[]
  estimateType?: 'maintenance' | 'repair'
}

export function GenerateEstimateLinkButton({
  workOrderId,
  recommendations,
  estimateType = 'maintenance'
}: GenerateEstimateLinkButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedRecs, setSelectedRecs] = useState<number[]>([])
  const [estimateUrl, setEstimateUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Show all non-approved recommendations (awaiting_approval + sent_to_customer)
  const availableRecommendations = recommendations.filter(
    r => r.status !== 'approved' && r.status !== 'superseded'
  )
  const alreadySent = availableRecommendations.filter(r => r.status === 'sent_to_customer')

  if (availableRecommendations.length === 0) {
    return null
  }

  const handleOpen = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      // Pre-select all available recommendations
      setSelectedRecs(availableRecommendations.map(r => r.id))
      setEstimateUrl('')
      setCopied(false)
    }
  }

  const selectedTotal = availableRecommendations
    .filter(r => selectedRecs.includes(r.id))
    .reduce((sum, r) => sum + (parseFloat(r.estimated_cost as any) || 0), 0)

  async function handleGenerate() {
    if (selectedRecs.length === 0) {
      toast.error('Please select at least one service')
      return
    }

    setLoading(true)
    try {
      const authToken = localStorage.getItem('auth_token')
      const res = await fetch(`/api/work-orders/${workOrderId}/estimate/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          recommendationIds: selectedRecs,
          expiresInHours: 72,
          estimateType
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to generate estimate')
      }

      const { url } = await res.json()
      setEstimateUrl(url)
      toast.success('Estimate link generated!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate estimate link')
    } finally {
      setLoading(false)
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(estimateUrl)
    setCopied(true)
    toast.success('Link copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Send className="w-4 h-4" />
          {estimateType === 'repair' ? 'Send Repair Estimate' : 'Send Maintenance Estimate'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Customer Estimate</DialogTitle>
        </DialogHeader>

        {!estimateUrl ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select services to include in the customer estimate:
            </p>

            {alreadySent.length > 0 && (
              <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                ⚠️ {alreadySent.length} service{alreadySent.length > 1 ? 's have' : ' has'} already been sent to the customer
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableRecommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-start space-x-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer"
                  onClick={() => {
                    setSelectedRecs(prev =>
                      prev.includes(rec.id)
                        ? prev.filter(id => id !== rec.id)
                        : [...prev, rec.id]
                    )
                  }}
                >
                  <Checkbox
                    id={`rec-${rec.id}`}
                    checked={selectedRecs.includes(rec.id)}
                    onCheckedChange={(checked) => {
                      setSelectedRecs(prev =>
                        checked
                          ? [...prev, rec.id]
                          : prev.filter(id => id !== rec.id)
                      )
                    }}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`rec-${rec.id}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    <div className="font-medium">{rec.service_title}</div>
                    <div className="text-muted-foreground">
                      ${(parseFloat(rec.estimated_cost as any) || 0).toFixed(2)}
                    </div>
                  </label>
                </div>
              ))}
            </div>

            {selectedRecs.length > 0 && (
              <div className="flex items-center justify-between text-sm px-1 pt-2 border-t border-border">
                <span className="text-muted-foreground">{selectedRecs.length} service{selectedRecs.length > 1 ? 's' : ''} selected</span>
                <span className="font-semibold">${selectedTotal.toFixed(2)}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={loading || selectedRecs.length === 0}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Link'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share this link with your customer:
            </p>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={estimateUrl}
                readOnly
                className="flex-1 px-3 py-2 border border-border rounded-md text-sm bg-muted text-foreground"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button onClick={handleCopyLink} size="sm" variant={copied ? 'default' : 'outline'}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              This link expires in 72 hours. The customer can view and approve services on their phone.
            </p>

            <div className="border-t border-border pt-4">
              <Button
                variant="outline"
                disabled
                className="w-full opacity-50"
                title="Coming soon - Twilio integration pending"
              >
                <Send className="w-4 h-4 mr-2" />
                Send via SMS (Coming Soon)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
