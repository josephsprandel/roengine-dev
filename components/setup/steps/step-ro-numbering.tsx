"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Hash, Loader2, ArrowRight, ArrowLeft, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

interface StepProps {
  onNext: () => void
  onBack: () => void
}

export function StepRoNumbering({ onNext, onBack }: StepProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    ro_numbering_mode: 'sequential' as 'sequential' | 'date_encoded',
    invoice_number_prefix: '',
    next_ro_number: 1,
    date_format: 'YYYYMMDD',
    sequential_padding: 3,
  })

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/invoice')
        if (res.ok) {
          const data = await res.json()
          const s = data.settings
          if (s) {
            setForm({
              ro_numbering_mode: s.ro_numbering_mode || 'sequential',
              invoice_number_prefix: s.invoice_number_prefix ?? '',
              next_ro_number: s.next_ro_number ?? 1,
              date_format: s.date_format || 'YYYYMMDD',
              sequential_padding: s.sequential_padding ?? 3,
            })
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

  function getPreview() {
    const prefix = form.invoice_number_prefix || ''
    const padding = form.sequential_padding || 3
    if (form.ro_numbering_mode === 'sequential') {
      const num = (form.next_ro_number || 1).toString().padStart(padding, '0')
      return `${prefix}${num}`
    }
    const now = new Date()
    const yyyy = now.getFullYear().toString()
    const yy = yyyy.slice(2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    let dateStr: string
    switch (form.date_format) {
      case 'YYMMDD': dateStr = `${yy}${mm}${dd}`; break
      case 'YYMM':   dateStr = `${yy}${mm}`; break
      case 'YYYYMM': dateStr = `${yyyy}${mm}`; break
      default:        dateStr = `${yyyy}${mm}${dd}`; break
    }
    return `${prefix}${dateStr}-${'1'.padStart(padding, '0')}`
  }

  async function handleSave() {
    if (form.ro_numbering_mode === 'sequential' && (!form.next_ro_number || form.next_ro_number < 1)) {
      toast.error("Starting number must be at least 1")
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/settings/invoice', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      onNext()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save RO numbering settings')
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
          <Hash size={28} className="text-blue-500" />
          RO Numbering
        </h2>
        <p className="text-muted-foreground mt-1">
          Configure how repair order numbers are generated. This is especially important if you are migrating from another system.
        </p>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Choose carefully</p>
          <p className="text-sm text-muted-foreground mt-1">
            You can change this setting later in Settings, but existing RO numbers will not be renumbered.
            If migrating from another system, set the starting number to continue your existing sequence.
          </p>
        </div>
      </div>

      <Card className="p-6 border-border space-y-4">
        {/* Mode */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Numbering Mode</Label>
          <Select
            value={form.ro_numbering_mode}
            onValueChange={(v: 'sequential' | 'date_encoded') => setForm({ ...form, ro_numbering_mode: v })}
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
          <Label htmlFor="prefix">Prefix</Label>
          <Input
            id="prefix"
            value={form.invoice_number_prefix}
            onChange={(e) => setForm({ ...form, invoice_number_prefix: e.target.value })}
            placeholder="e.g. RO- (leave empty for no prefix)"
            className="max-w-[200px]"
          />
        </div>

        {/* Sequential-specific */}
        {form.ro_numbering_mode === 'sequential' && (
          <div className="space-y-2">
            <Label htmlFor="next_number">Starting Number</Label>
            <Input
              id="next_number"
              type="number"
              min={1}
              value={form.next_ro_number}
              onChange={(e) => setForm({ ...form, next_ro_number: parseInt(e.target.value) || 1 })}
              className="max-w-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              If migrating from another system, enter the next number after your last RO
            </p>
          </div>
        )}

        {/* Date-encoded-specific */}
        {form.ro_numbering_mode === 'date_encoded' && (
          <div className="space-y-2">
            <Label>Date Format</Label>
            <Select
              value={form.date_format}
              onValueChange={(v) => setForm({ ...form, date_format: v })}
            >
              <SelectTrigger className="max-w-[250px]">
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
          <Label htmlFor="padding">Minimum Digits</Label>
          <Input
            id="padding"
            type="number"
            min={1}
            max={10}
            value={form.sequential_padding}
            onChange={(e) => setForm({ ...form, sequential_padding: e.target.value as any })}
            onBlur={(e) => {
              const v = Math.min(6, Math.max(1, parseInt(e.target.value) || 3))
              setForm({ ...form, sequential_padding: v })
            }}
            className="max-w-[100px]"
          />
        </div>

        {/* Preview */}
        <div className="rounded-md bg-muted/50 p-4 mt-2">
          <p className="text-xs text-muted-foreground mb-1">Your next RO number will be:</p>
          <p className="text-xl font-mono font-bold text-foreground">{getPreview()}</p>
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft size={16} className="mr-2" />
          Back
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
          Continue
          <ArrowRight size={16} className="ml-2" />
        </Button>
      </div>
    </div>
  )
}
