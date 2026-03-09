"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Hash, Receipt, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

interface InvoiceSettings {
  ro_numbering_mode: 'sequential' | 'date_encoded'
  next_ro_number: number
  invoice_number_prefix: string
  include_date: boolean
  date_format: string
  sequential_padding: number
  sales_tax_rate: string
  parts_taxable: boolean
  labor_taxable: boolean
}

export function InvoicingSettings() {
  const [settings, setSettings] = useState<InvoiceSettings>({
    ro_numbering_mode: 'sequential',
    next_ro_number: 33823,
    invoice_number_prefix: '',
    include_date: true,
    date_format: 'YYYYMMDD',
    sequential_padding: 3,
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
        ro_numbering_mode: data.settings.ro_numbering_mode || 'sequential',
        next_ro_number: data.settings.next_ro_number ?? 1,
        invoice_number_prefix: data.settings.invoice_number_prefix ?? '',
        include_date: data.settings.include_date ?? true,
        date_format: data.settings.date_format || 'YYYYMMDD',
        sequential_padding: data.settings.sequential_padding ?? 3,
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
          ro_numbering_mode: settings.ro_numbering_mode,
          next_ro_number: settings.next_ro_number,
          invoice_number_prefix: settings.invoice_number_prefix,
          include_date: settings.include_date,
          date_format: settings.date_format,
          sequential_padding: settings.sequential_padding,
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

  function getPreviewRoNumber() {
    const prefix = settings.invoice_number_prefix || ''
    const padding = settings.sequential_padding || 3
    if (settings.ro_numbering_mode === 'sequential') {
      const num = (settings.next_ro_number || 1).toString().padStart(padding, '0')
      return `${prefix}${num}`
    }
    const now = new Date()
    const yyyy = now.getFullYear().toString()
    const yy = yyyy.slice(2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    let dateStr: string
    switch (settings.date_format) {
      case 'YYMMDD': dateStr = `${yy}${mm}${dd}`; break
      case 'YYMM':   dateStr = `${yy}${mm}`; break
      case 'YYYYMM': dateStr = `${yyyy}${mm}`; break
      default:        dateStr = `${yyyy}${mm}${dd}`; break
    }
    return `${prefix}${dateStr}-${'1'.padStart(padding, '0')}`
  }

  return (
    <div className="space-y-6">
      {/* RO Numbering */}
      <Card className="p-6 border-border">
        <div className="flex items-center gap-3 mb-6">
          <Hash size={20} className="text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">RO Numbering</h3>
            <p className="text-sm text-muted-foreground">
              Configure how repair order numbers are generated
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Mode */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Numbering Mode</Label>
            <Select
              value={settings.ro_numbering_mode}
              onValueChange={(value: 'sequential' | 'date_encoded') => {
                setSettings({ ...settings, ro_numbering_mode: value })
                setHasChanges(true)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential">Sequential (33823, 33824, ...)</SelectItem>
                <SelectItem value="date_encoded">Date-encoded (RO-20260307-001)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Prefix */}
          <div className="space-y-2">
            <Label htmlFor="invoice_number_prefix" className="text-sm font-medium">
              Prefix
            </Label>
            <Input
              id="invoice_number_prefix"
              value={settings.invoice_number_prefix}
              onChange={(e) => {
                setSettings({ ...settings, invoice_number_prefix: e.target.value })
                setHasChanges(true)
              }}
              placeholder="e.g. RO- (leave empty for no prefix)"
              className="max-w-[200px]"
            />
          </div>

          {/* Next Number (sequential only) */}
          {settings.ro_numbering_mode === 'sequential' && (
            <div className="space-y-2">
              <Label htmlFor="next_ro_number" className="text-sm font-medium">
                Next RO Number
              </Label>
              <Input
                id="next_ro_number"
                type="number"
                min={1}
                value={settings.next_ro_number}
                onChange={(e) => {
                  setSettings({ ...settings, next_ro_number: parseInt(e.target.value) || 1 })
                  setHasChanges(true)
                }}
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                The next work order will use this number
              </p>
            </div>
          )}

          {/* Date Format (date-encoded only) */}
          {settings.ro_numbering_mode === 'date_encoded' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date Format</Label>
              <Select
                value={settings.date_format}
                onValueChange={(value) => {
                  setSettings({ ...settings, date_format: value })
                  setHasChanges(true)
                }}
              >
                <SelectTrigger className="max-w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YYMMDD">YYMMDD — {new Date().getFullYear().toString().slice(2)}{String(new Date().getMonth()+1).padStart(2,'0')}{String(new Date().getDate()).padStart(2,'0')} (daily)</SelectItem>
                  <SelectItem value="YYMM">YYMM — {new Date().getFullYear().toString().slice(2)}{String(new Date().getMonth()+1).padStart(2,'0')} (monthly)</SelectItem>
                  <SelectItem value="YYYYMMDD">YYYYMMDD — {new Date().toISOString().slice(0,10).replace(/-/g,'')} (daily)</SelectItem>
                  <SelectItem value="YYYYMM">YYYYMM — {new Date().getFullYear()}{String(new Date().getMonth()+1).padStart(2,'0')} (monthly)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Padding */}
          <div className="space-y-2">
            <Label htmlFor="sequential_padding" className="text-sm font-medium">
              Minimum Digits
            </Label>
            <Input
              id="sequential_padding"
              type="number"
              min={1}
              max={10}
              value={settings.sequential_padding}
              onChange={(e) => {
                setSettings({ ...settings, sequential_padding: e.target.value as any })
                setHasChanges(true)
              }}
              onBlur={(e) => {
                const v = Math.min(6, Math.max(1, parseInt(e.target.value) || 3))
                setSettings({ ...settings, sequential_padding: v })
                setHasChanges(true)
              }}
              className="max-w-[100px]"
            />
          </div>

          {/* Preview */}
          <div className="rounded-md bg-muted/50 p-3 mt-2">
            <p className="text-xs text-muted-foreground mb-1">Preview — next RO number:</p>
            <p className="text-sm font-mono font-semibold text-foreground">{getPreviewRoNumber()}</p>
          </div>
        </div>
      </Card>

      {/* Tax Configuration */}
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
              Tax rate applied to taxable items on invoices
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
