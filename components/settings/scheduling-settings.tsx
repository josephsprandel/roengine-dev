"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Save, Loader2, Clock, Car } from "lucide-react"
import { toast } from "sonner"
import { CapacityRulesSection } from "./scheduling/capacity-rules-section"
import { TechRolesSection } from "./scheduling/tech-roles-section"
import { BusinessHoursSection } from "./scheduling/business-hours-section"
import { BlockTimesSection } from "./scheduling/block-times-section"
import { SeasonalOverridesSection } from "./scheduling/seasonal-overrides-section"

export function SchedulingSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [waiterCutoffTime, setWaiterCutoffTime] = useState("15:00")
  const [maxWaitersPerSlot, setMaxWaitersPerSlot] = useState(2)
  const [maxDropoffsPerDay, setMaxDropoffsPerDay] = useState(10)
  const [dropoffStartTime, setDropoffStartTime] = useState("07:00")
  const [dropoffEndTime, setDropoffEndTime] = useState("17:00")

  useEffect(() => {
    fetch("/api/settings/shop-profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.profile) {
          const p = data.profile
          if (p.waiter_cutoff_time) setWaiterCutoffTime(p.waiter_cutoff_time.substring(0, 5))
          if (p.max_waiters_per_slot != null) setMaxWaitersPerSlot(p.max_waiters_per_slot)
          if (p.max_dropoffs_per_day != null) setMaxDropoffsPerDay(p.max_dropoffs_per_day)
          if (p.dropoff_start_time) setDropoffStartTime(p.dropoff_start_time.substring(0, 5))
          if (p.dropoff_end_time) setDropoffEndTime(p.dropoff_end_time.substring(0, 5))
        }
      })
      .catch(() => toast.error('Failed to load scheduling settings'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch("/api/settings/shop-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            waiter_cutoff_time: waiterCutoffTime,
            max_waiters_per_slot: maxWaitersPerSlot,
            max_dropoffs_per_day: maxDropoffsPerDay,
            dropoff_start_time: dropoffStartTime,
            dropoff_end_time: dropoffEndTime,
          },
        }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      toast.error('Failed to save scheduling settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Scheduling</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure scheduling rules, tech roles, business hours, and block times.
          Rules are derived from 3 years of ShopWare data.
        </p>
      </div>

      {/* Online Booking Settings (existing - saved to shop_profile) */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin mr-2 text-muted-foreground" size={20} />
          <span className="text-muted-foreground">Loading scheduling settings...</span>
        </div>
      ) : (
        <>
          {/* Waiter Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={18} className="text-sky-500" />
              <h3 className="font-semibold text-foreground">Online Booking — Waiter</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Customers who wait while their vehicle is being serviced. These require a bay and a time slot.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="waiter-cutoff" className="text-sm">Cutoff Time</Label>
                <p className="text-xs text-muted-foreground mb-1">No waiter bookings after this time</p>
                <Input
                  id="waiter-cutoff"
                  type="time"
                  value={waiterCutoffTime}
                  onChange={(e) => setWaiterCutoffTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="max-waiters" className="text-sm">Max Waiters Per Slot</Label>
                <p className="text-xs text-muted-foreground mb-1">Concurrent waiters allowed per time slot</p>
                <Input
                  id="max-waiters"
                  type="number"
                  min={1}
                  max={10}
                  value={maxWaitersPerSlot}
                  onChange={(e) => setMaxWaitersPerSlot(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
          </Card>

          {/* Drop-off Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Car size={18} className="text-amber-500" />
              <h3 className="font-semibold text-foreground">Online Booking — Drop-off</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Customers who drop off their vehicle and pick up later. These don&apos;t require a specific bay reservation.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="max-dropoffs" className="text-sm">Max Drop-offs Per Day</Label>
                <p className="text-xs text-muted-foreground mb-1">Daily drop-off capacity</p>
                <Input
                  id="max-dropoffs"
                  type="number"
                  min={1}
                  max={50}
                  value={maxDropoffsPerDay}
                  onChange={(e) => setMaxDropoffsPerDay(parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <Label htmlFor="dropoff-start" className="text-sm">Drop-off Start</Label>
                <p className="text-xs text-muted-foreground mb-1">Earliest drop-off time</p>
                <Input
                  id="dropoff-start"
                  type="time"
                  value={dropoffStartTime}
                  onChange={(e) => setDropoffStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dropoff-end" className="text-sm">Drop-off End</Label>
                <p className="text-xs text-muted-foreground mb-1">Latest drop-off time</p>
                <Input
                  id="dropoff-end"
                  type="time"
                  value={dropoffEndTime}
                  onChange={(e) => setDropoffEndTime(e.target.value)}
                />
              </div>
            </div>
          </Card>

          {/* Save Online Booking Settings */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  Save Online Booking Settings
                </>
              )}
            </Button>
            {saved && (
              <span className="text-sm text-green-600">Settings saved</span>
            )}
          </div>
        </>
      )}

      {/* Rules Engine Sections */}
      <div className="border-t border-border pt-6">
        <h3 className="text-lg font-semibold text-foreground mb-1">Rules Engine</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Data-driven scheduling constraints. These rules enforce capacity limits automatically.
        </p>
      </div>

      <CapacityRulesSection />
      <TechRolesSection />
      <BusinessHoursSection />
      <BlockTimesSection />
      <SeasonalOverridesSection />
    </div>
  )
}
