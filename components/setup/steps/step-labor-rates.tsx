"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DollarSign, Loader2, ArrowRight, ArrowLeft, SkipForward } from "lucide-react"
import { toast } from "sonner"

function titleCase(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

interface LaborRate {
  id: number
  category: string
  rate_per_hour: string
  description: string | null
  is_default: boolean
}

interface StepProps {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

export function StepLaborRates({ onNext, onBack, onSkip }: StepProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rates, setRates] = useState<LaborRate[]>([])
  const [editedRates, setEditedRates] = useState<Record<number, string>>({})

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/labor-rates')
        if (res.ok) {
          const data = await res.json()
          setRates(data.rates || [])
        }
      } catch {
        // Use empty
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function handleRateChange(id: number, value: string) {
    setEditedRates({ ...editedRates, [id]: value })
  }

  async function handleSave() {
    const edits = Object.entries(editedRates)
    if (edits.length === 0) {
      onNext()
      return
    }

    setSaving(true)
    try {
      const token = localStorage.getItem('auth_token')
      for (const [id, rate] of edits) {
        await fetch(`/api/settings/labor-rates/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ rate_per_hour: parseFloat(rate) }),
        })
      }
      onNext()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save labor rates')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <DollarSign size={28} className="text-blue-500" />
          Labor Rates
        </h2>
        <p className="text-muted-foreground mt-1">
          Review and adjust your labor rate categories. These rates are used when creating services on repair orders.
        </p>
      </div>

      <Card className="p-6 border-border">
        {rates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No labor rates configured yet.</p>
        ) : (
          <div className="space-y-3">
            {rates.map((rate) => (
              <div key={rate.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{titleCase(rate.category)}</p>
                  {rate.description && (
                    <p className="text-xs text-muted-foreground">{rate.description}</p>
                  )}
                  {rate.is_default && (
                    <span className="text-[10px] font-medium text-blue-500 uppercase">Default</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min={0}
                    step={5}
                    value={editedRates[rate.id] ?? rate.rate_per_hour}
                    onChange={(e) => handleRateChange(rate.id, e.target.value)}
                    className="w-24 text-right"
                  />
                  <span className="text-sm text-muted-foreground">/hr</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft size={16} className="mr-2" />
          Back
        </Button>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
            Skip for now
            <SkipForward size={16} className="ml-2" />
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
            Continue
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
