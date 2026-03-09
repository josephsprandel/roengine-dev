"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { CreditCard, Loader2, ArrowRight, ArrowLeft, SkipForward } from "lucide-react"
import { toast } from "sonner"

interface StepProps {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

export function StepBusinessDefaults({ onNext, onBack, onSkip }: StepProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    sales_tax_rate: "12.25",
    shop_supplies_enabled: false,
    shop_supplies_percentage: "0.05",
    cc_surcharge_enabled: true,
    cc_surcharge_rate: "3.5",
    default_labor_rate: "160",
  })

  useEffect(() => {
    async function load() {
      try {
        const [invoiceRes, profileRes] = await Promise.all([
          fetch('/api/settings/invoice'),
          fetch('/api/settings/shop-profile'),
        ])

        if (invoiceRes.ok) {
          const data = await invoiceRes.json()
          const s = data.settings
          if (s) {
            setForm(prev => ({
              ...prev,
              sales_tax_rate: s.sales_tax_rate ? (parseFloat(s.sales_tax_rate) * 100).toString() : prev.sales_tax_rate,
              shop_supplies_enabled: s.shop_supplies_enabled ?? false,
              shop_supplies_percentage: s.shop_supplies_percentage ? (parseFloat(s.shop_supplies_percentage) * 100).toString() : "5",
              cc_surcharge_enabled: s.cc_surcharge_enabled ?? true,
              cc_surcharge_rate: s.cc_surcharge_rate ? (parseFloat(s.cc_surcharge_rate) * 100).toString() : "3.5",
            }))
          }
        }

        if (profileRes.ok) {
          const data = await profileRes.json()
          if (data.profile?.default_labor_rate) {
            setForm(prev => ({ ...prev, default_labor_rate: data.profile.default_labor_rate.toString() }))
          }
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      // Save invoice settings
      const taxRate = parseFloat(form.sales_tax_rate)
      if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
        toast.error("Tax rate must be between 0 and 100")
        setSaving(false)
        return
      }

      await fetch('/api/settings/invoice', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sales_tax_rate: (taxRate / 100).toFixed(4),
          shop_supplies_enabled: form.shop_supplies_enabled,
          shop_supplies_calculation: form.shop_supplies_enabled ? 'percentage' : undefined,
          shop_supplies_percentage: form.shop_supplies_enabled
            ? (parseFloat(form.shop_supplies_percentage) / 100).toFixed(4)
            : undefined,
          cc_surcharge_enabled: form.cc_surcharge_enabled,
          cc_surcharge_rate: form.cc_surcharge_enabled
            ? (parseFloat(form.cc_surcharge_rate) / 100).toFixed(4)
            : undefined,
        }),
      })

      // Save default labor rate on shop profile
      await fetch('/api/settings/shop-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: { default_labor_rate: parseFloat(form.default_labor_rate) || 160 },
        }),
      })

      onNext()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save business defaults')
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
          <CreditCard size={28} className="text-blue-500" />
          Business Defaults
        </h2>
        <p className="text-muted-foreground mt-1">
          Tax rate, shop supplies, credit card surcharge, and default labor rate.
        </p>
      </div>

      <Card className="p-6 border-border space-y-5">
        {/* Tax Rate */}
        <div className="space-y-2">
          <Label htmlFor="tax_rate">Sales Tax Rate (%)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="tax_rate"
              type="text"
              inputMode="decimal"
              value={form.sales_tax_rate}
              onChange={(e) => {
                if (e.target.value === "" || /^\d*\.?\d{0,4}$/.test(e.target.value)) {
                  setForm({ ...form, sales_tax_rate: e.target.value })
                }
              }}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>

        {/* Default Labor Rate */}
        <div className="space-y-2">
          <Label htmlFor="labor_rate">Default Labor Rate</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              id="labor_rate"
              type="number"
              min={0}
              step={5}
              value={form.default_labor_rate}
              onChange={(e) => setForm({ ...form, default_labor_rate: e.target.value })}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">/hr</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Used as the default when no specific labor rate category is selected
          </p>
        </div>

        <div className="border-t border-border my-4" />

        {/* Shop Supplies */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Shop Supplies Fee</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Auto-calculated fee added to each invoice
            </p>
          </div>
          <Switch
            checked={form.shop_supplies_enabled}
            onCheckedChange={(checked) => setForm({ ...form, shop_supplies_enabled: checked })}
          />
        </div>

        {form.shop_supplies_enabled && (
          <div className="space-y-2 pl-4 border-l-2 border-blue-500/20">
            <Label htmlFor="supplies_pct">Percentage of Parts + Labor</Label>
            <div className="flex items-center gap-2">
              <Input
                id="supplies_pct"
                type="text"
                inputMode="decimal"
                value={form.shop_supplies_percentage}
                onChange={(e) => {
                  if (e.target.value === "" || /^\d*\.?\d{0,2}$/.test(e.target.value)) {
                    setForm({ ...form, shop_supplies_percentage: e.target.value })
                  }
                }}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        )}

        <div className="border-t border-border my-4" />

        {/* CC Surcharge */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Credit Card Surcharge</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pass processing fees to customer on card payments
            </p>
          </div>
          <Switch
            checked={form.cc_surcharge_enabled}
            onCheckedChange={(checked) => setForm({ ...form, cc_surcharge_enabled: checked })}
          />
        </div>

        {form.cc_surcharge_enabled && (
          <div className="space-y-2 pl-4 border-l-2 border-blue-500/20">
            <Label htmlFor="cc_rate">Surcharge Rate</Label>
            <div className="flex items-center gap-2">
              <Input
                id="cc_rate"
                type="text"
                inputMode="decimal"
                value={form.cc_surcharge_rate}
                onChange={(e) => {
                  if (e.target.value === "" || /^\d*\.?\d{0,2}$/.test(e.target.value)) {
                    setForm({ ...form, cc_surcharge_rate: e.target.value })
                  }
                }}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
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
