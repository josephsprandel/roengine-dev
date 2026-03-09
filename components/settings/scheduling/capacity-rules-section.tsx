"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Save, Loader2, Gauge } from "lucide-react"
import { toast } from "sonner"

interface RulesData {
  max_appointments_per_day: number
  max_waiters_per_day: number
  max_week_killers_per_week: number
  big_job_threshold_hours: number
  daily_tech_hour_ceiling: number
  bay_hold_threshold_hours: number
  week_killer_threshold_hours: number
  friday_max_new_appointments: number
  friday_max_dropoff_hours: number
  lead_tech_intensive_threshold: number
  non_core_weekly_limit: number
  non_core_hour_threshold: number
  week_killer_dropoff_cap: number
  target_waiter_ratio: number
  reduced_capacity_factor: number
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" }
}

export function CapacityRulesSection() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rules, setRules] = useState<RulesData>({
    max_appointments_per_day: 9,
    max_waiters_per_day: 2,
    max_week_killers_per_week: 2,
    big_job_threshold_hours: 8,
    daily_tech_hour_ceiling: 16,
    bay_hold_threshold_hours: 5,
    week_killer_threshold_hours: 15,
    friday_max_new_appointments: 2,
    friday_max_dropoff_hours: 4,
    lead_tech_intensive_threshold: 4,
    non_core_weekly_limit: 2,
    non_core_hour_threshold: 3,
    week_killer_dropoff_cap: 4,
    target_waiter_ratio: 0.15,
    reduced_capacity_factor: 0.60,
  })

  useEffect(() => {
    fetch("/api/scheduling/rules")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.rules) {
          const r = data.rules
          setRules({
            max_appointments_per_day: parseInt(r.max_appointments_per_day) || 9,
            max_waiters_per_day: parseInt(r.max_waiters_per_day) || 2,
            max_week_killers_per_week: parseInt(r.max_week_killers_per_week) || 2,
            big_job_threshold_hours: parseFloat(r.big_job_threshold_hours) || 8,
            daily_tech_hour_ceiling: parseFloat(r.daily_tech_hour_ceiling) || 16,
            bay_hold_threshold_hours: parseFloat(r.bay_hold_threshold_hours) || 5,
            week_killer_threshold_hours: parseFloat(r.week_killer_threshold_hours) || 15,
            friday_max_new_appointments: parseInt(r.friday_max_new_appointments) || 2,
            friday_max_dropoff_hours: parseFloat(r.friday_max_dropoff_hours) || 4,
            lead_tech_intensive_threshold: parseFloat(r.lead_tech_intensive_threshold) || 4,
            non_core_weekly_limit: parseInt(r.non_core_weekly_limit) || 2,
            non_core_hour_threshold: parseFloat(r.non_core_hour_threshold) || 3,
            week_killer_dropoff_cap: parseInt(r.week_killer_dropoff_cap) || 4,
            target_waiter_ratio: parseFloat(r.target_waiter_ratio) || 0.15,
            reduced_capacity_factor: parseFloat(r.reduced_capacity_factor) || 0.60,
          })
        }
      })
      .catch(() => toast.error("Failed to load capacity rules"))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/scheduling/rules", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(rules),
      })
      if (res.ok) {
        toast.success("Capacity rules saved")
      } else {
        toast.error("Failed to save capacity rules")
      }
    } catch {
      toast.error("Failed to save capacity rules")
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: keyof RulesData, value: string, isFloat = false) => {
    setRules(prev => ({
      ...prev,
      [field]: isFloat ? (parseFloat(value) || 0) : (parseInt(value) || 0),
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin mr-2 text-muted-foreground" size={20} />
        <span className="text-muted-foreground">Loading capacity rules...</span>
      </div>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Gauge size={18} className="text-blue-500" />
        <h3 className="font-semibold text-foreground">Capacity Rules</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Scheduling thresholds derived from 3 years of ShopWare data. Adjust with caution.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="Max Appointments/Day" desc="Hard ceiling per day (R04)" value={rules.max_appointments_per_day} onChange={v => updateField("max_appointments_per_day", v)} />
        <Field label="Max Waiters/Day" desc="Soft warn above this (R03)" value={rules.max_waiters_per_day} onChange={v => updateField("max_waiters_per_day", v)} />
        <Field label="Max Week-Killers/Week" desc="Jobs >8hrs per week (R01)" value={rules.max_week_killers_per_week} onChange={v => updateField("max_week_killers_per_week", v)} />
        <Field label="Daily Tech Hour Ceiling" desc="Bookable hours per day" value={rules.daily_tech_hour_ceiling} onChange={v => updateField("daily_tech_hour_ceiling", v, true)} step="0.5" />
        <Field label="Bay Hold Threshold (hrs)" desc="Jobs >= this get bay hold (R02)" value={rules.bay_hold_threshold_hours} onChange={v => updateField("bay_hold_threshold_hours", v, true)} step="0.5" />
        <Field label="Week-Killer Threshold (hrs)" desc="Jobs >= this are week-killers" value={rules.week_killer_threshold_hours} onChange={v => updateField("week_killer_threshold_hours", v, true)} step="1" />
        <Field label="Big Job Threshold (hrs)" desc="Jobs >= this count as large (R01)" value={rules.big_job_threshold_hours} onChange={v => updateField("big_job_threshold_hours", v, true)} step="0.5" />
        <Field label="Friday Max New Appts" desc="Hard cap on Friday intake (R05)" value={rules.friday_max_new_appointments} onChange={v => updateField("friday_max_new_appointments", v)} />
        <Field label="Friday Max Drop-off Hrs" desc="No large drops starting Friday (R05)" value={rules.friday_max_dropoff_hours} onChange={v => updateField("friday_max_dropoff_hours", v, true)} step="0.5" />
        <Field label="Lead Tech Intensive (hrs)" desc="Stagger threshold (R10)" value={rules.lead_tech_intensive_threshold} onChange={v => updateField("lead_tech_intensive_threshold", v, true)} step="0.5" />
        <Field label="Non-Core Weekly Limit" desc="Max heavy non-core jobs/week (R14)" value={rules.non_core_weekly_limit} onChange={v => updateField("non_core_weekly_limit", v)} />
        <Field label="Week-Killer Drop-off Cap" desc="Max drop-offs/day when killer active (R12)" value={rules.week_killer_dropoff_cap} onChange={v => updateField("week_killer_dropoff_cap", v)} />
        <Field label="Target Waiter Ratio" desc="Ideal waiter % of total (10-20%)" value={rules.target_waiter_ratio} onChange={v => updateField("target_waiter_ratio", v, true)} step="0.01" />
        <Field label="Reduced Capacity Factor" desc="Capacity when lead tech absent" value={rules.reduced_capacity_factor} onChange={v => updateField("reduced_capacity_factor", v, true)} step="0.05" />
      </div>

      <div className="mt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 size={16} className="animate-spin mr-2" />Saving...</> : <><Save size={16} className="mr-2" />Save Capacity Rules</>}
        </Button>
      </div>
    </Card>
  )
}

function Field({
  label, desc, value, onChange, step,
}: {
  label: string; desc: string; value: number; onChange: (v: string) => void; step?: string
}) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <p className="text-xs text-muted-foreground mb-1">{desc}</p>
      <Input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        step={step || "1"}
        min={0}
        className="max-w-[120px]"
      />
    </div>
  )
}
