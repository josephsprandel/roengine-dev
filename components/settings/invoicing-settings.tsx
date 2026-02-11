"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Receipt, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

interface InvoiceSettings {
  sales_tax_rate: string
  parts_taxable: boolean
  labor_taxable: boolean
}

export function InvoicingSettings() {
  const [settings, setSettings] = useState<InvoiceSettings>({
    sales_tax_rate: "0.1225",
    parts_taxable: true,
    labor_taxable: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/settings/invoice")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch invoice settings")
      }

      // Convert decimal to percentage for display (0.1225 → 12.25)
      const taxRateDecimal = parseFloat(data.settings.sales_tax_rate || "0.1225")
      const taxRatePercentage = (taxRateDecimal * 100).toString()

      setSettings({
        sales_tax_rate: taxRatePercentage,
        parts_taxable: data.settings.parts_taxable ?? true,
        labor_taxable: data.settings.labor_taxable ?? true,
      })
    } catch (err: any) {
      setError(err.message)
      toast.error("Failed to load tax settings")
    } finally {
      setLoading(false)
    }
  }

  function handleTaxRateChange(value: string) {
    // Allow empty string, numbers, and decimal point
    if (value === "" || /^\d*\.?\d{0,4}$/.test(value)) {
      setSettings({ ...settings, sales_tax_rate: value })
      setHasChanges(true)
    }
  }

  function handlePartsToggle(checked: boolean) {
    setSettings({ ...settings, parts_taxable: checked })
    setHasChanges(true)
  }

  function handleLaborToggle(checked: boolean) {
    setSettings({ ...settings, labor_taxable: checked })
    setHasChanges(true)
  }

  async function handleSave() {
    try {
      setSaving(true)

      // Validate tax rate
      const taxRate = parseFloat(settings.sales_tax_rate)
      if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
        toast.error("Tax rate must be between 0 and 100")
        return
      }

      // Convert percentage to decimal for storage (12.25 → 0.1225)
      const taxRateDecimal = (taxRate / 100).toFixed(4)

      const response = await fetch("/api/settings/invoice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sales_tax_rate: taxRateDecimal,
          parts_taxable: settings.parts_taxable,
          labor_taxable: settings.labor_taxable,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save tax settings")
      }

      setHasChanges(false)
      toast.success("Tax settings updated successfully")
      
      // Refresh settings to get the stored values
      fetchSettings()
    } catch (err: any) {
      toast.error(err.message || "Failed to update tax settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6 border-border">
        <div className="flex items-center gap-3 text-destructive mb-4">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
        <Button onClick={fetchSettings}>
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Receipt size={20} className="text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Tax Configuration</h3>
            <p className="text-sm text-muted-foreground">
              Configure how sales tax is calculated on invoices
            </p>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          {/* Sales Tax Rate */}
          <div className="space-y-2">
            <Label htmlFor="sales_tax_rate" className="text-sm font-medium">
              Sales Tax Rate (%)
            </Label>
            <div className="relative">
              <Input
                id="sales_tax_rate"
                type="text"
                inputMode="decimal"
                value={settings.sales_tax_rate}
                onChange={(e) => handleTaxRateChange(e.target.value)}
                placeholder="12.25"
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                %
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Tax rate applied to taxable items on invoices. Example: 12.25 for Washington County, AR
            </p>
          </div>

          {/* Parts Taxable */}
          <div className="flex items-center justify-between space-x-4">
            <div className="flex-1">
              <Label htmlFor="parts_taxable" className="text-sm font-medium cursor-pointer">
                Charge Tax on Parts
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                When enabled, sales tax will be applied to parts purchases
              </p>
            </div>
            <Switch
              id="parts_taxable"
              checked={settings.parts_taxable}
              onCheckedChange={handlePartsToggle}
            />
          </div>

          {/* Labor Taxable */}
          <div className="flex items-center justify-between space-x-4">
            <div className="flex-1">
              <Label htmlFor="labor_taxable" className="text-sm font-medium cursor-pointer">
                Charge Tax on Labor
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                When enabled, sales tax will be applied to labor charges
              </p>
            </div>
            <Switch
              id="labor_taxable"
              checked={settings.labor_taxable}
              onCheckedChange={handleLaborToggle}
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3 mt-6 pt-6 border-t border-border">
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          {hasChanges && !saving && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle size={12} />
              You have unsaved changes
            </p>
          )}
          {!hasChanges && !saving && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 size={12} className="text-green-500" />
              All changes saved
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
