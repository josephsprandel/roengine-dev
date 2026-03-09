"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, Loader2, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { formatPhoneNumber, unformatPhoneNumber } from "@/lib/utils/phone-format"

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME",
  "MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI",
  "SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
]

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
]

interface StepProps {
  onNext: () => void
  onBack: () => void
}

export function StepShopIdentity({ onNext, onBack }: StepProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    shop_name: "",
    address_line1: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
    website: "",
    timezone: "America/Chicago",
  })

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/shop-profile')
        if (res.ok) {
          const data = await res.json()
          const p = data.profile
          if (p) {
            setForm({
              shop_name: p.shop_name || "",
              address_line1: p.address_line1 || "",
              city: p.city || "",
              state: p.state || "",
              zip: p.zip || "",
              phone: p.phone || "",
              email: p.email || "",
              website: p.website || "",
              timezone: p.timezone || "America/Chicago",
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

  async function handleSave() {
    if (!form.shop_name.trim()) {
      toast.error("Shop name is required")
      return
    }
    if (!form.phone.trim()) {
      toast.error("Phone number is required")
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/settings/shop-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: form }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      onNext()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save shop profile')
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
          <Building2 size={28} className="text-blue-500" />
          Shop Identity
        </h2>
        <p className="text-muted-foreground mt-1">
          Basic information about your shop. This appears on invoices, estimates, and customer communications.
        </p>
      </div>

      <Card className="p-6 border-border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="shop_name">Shop Name *</Label>
            <Input
              id="shop_name"
              value={form.shop_name}
              onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
              placeholder="Your Shop Name"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address_line1">Street Address</Label>
            <Input
              id="address_line1"
              value={form.address_line1}
              onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
              placeholder="123 Main Street"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="City"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>State</Label>
              <Select value={form.state} onValueChange={(v) => setForm({ ...form, state: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                value={form.zip}
                onChange={(e) => setForm({ ...form, zip: e.target.value })}
                placeholder="72701"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              value={formatPhoneNumber(form.phone)}
              onChange={(e) => setForm({ ...form, phone: unformatPhoneNumber(e.target.value) })}
              placeholder="(479) 555-1234"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="shop@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://yourshop.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {US_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
          Continue
          <ArrowRight size={16} className="ml-2" />
        </Button>
      </div>
    </div>
  )
}
