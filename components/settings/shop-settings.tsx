"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { BuildingOfficeIcon as Building2, ClockIcon as Clock, MapPinIcon as MapPin, PhoneIcon as Phone, EnvelopeIcon as Mail, GlobeAltIcon, CheckIcon as Save, ArrowPathIcon as Loader2, ExclamationCircleIcon as AlertCircle, PlusIcon as Plus, XMarkIcon as X, ArrowUpTrayIcon as Upload, PhotoIcon, TrashIcon as Trash2 } from "@heroicons/react/24/outline"
import Image from "next/image"

// All 50 US States
const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
]

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const OPEN_TIMES = ["06:00", "07:00", "08:00", "09:00", "10:00"]
const CLOSE_TIMES = ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"]

interface ShopProfile {
  id?: number
  shop_name: string
  dba_name: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  zip: string
  phone: string
  email: string
  website: string
  services_description: string
  tags: string[]
  parts_markup_percent: number
  logo_url?: string | null
}

interface OperatingHours {
  id?: number
  day_of_week: string
  is_open: boolean
  open_time: string | null
  close_time: string | null
}

const initialProfile: ShopProfile = {
  shop_name: "",
  dba_name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  email: "",
  website: "",
  services_description: "",
  tags: [],
  parts_markup_percent: 35,
}

export function ShopSettings() {
  const [profile, setProfile] = useState<ShopProfile>(initialProfile)
  const [operatingHours, setOperatingHours] = useState<OperatingHours[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTag, setNewTag] = useState("")
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    fetchShopProfile()
  }, [])

  async function fetchShopProfile() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/settings/shop-profile")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch shop profile")
      }

      if (data.profile) {
        setProfile({
          ...data.profile,
          tags: data.profile.tags || [],
          parts_markup_percent: parseFloat(data.profile.parts_markup_percent) || 35,
        })
      }

      if (data.operatingHours && data.operatingHours.length > 0) {
        setOperatingHours(data.operatingHours.map((h: any) => ({
          ...h,
          open_time: h.open_time?.slice(0, 5) || "07:00",
          close_time: h.close_time?.slice(0, 5) || "18:00",
        })))
      } else {
        // Initialize with defaults
        setOperatingHours(DAYS_OF_WEEK.map(day => ({
          day_of_week: day,
          is_open: day !== "Sunday",
          open_time: day === "Saturday" ? "08:00" : "07:00",
          close_time: day === "Saturday" ? "14:00" : "18:00",
        })))
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      setError(null)

      const response = await fetch("/api/settings/shop-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, operatingHours }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save shop profile")
      }

      // Show success (you could add a toast here)
      alert("Shop profile saved successfully!")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function updateHours(day: string, field: keyof OperatingHours, value: any) {
    setOperatingHours(hours =>
      hours.map(h =>
        h.day_of_week === day ? { ...h, [field]: value } : h
      )
    )
  }

  function addTag() {
    if (newTag.trim() && !profile.tags.includes(newTag.trim())) {
      setProfile({ ...profile, tags: [...profile.tags, newTag.trim()] })
      setNewTag("")
    }
  }

  function removeTag(tag: string) {
    setProfile({ ...profile, tags: profile.tags.filter(t => t !== tag) })
  }

  function formatTimeDisplay(time: string): string {
    const hour = parseInt(time.split(":")[0])
    if (hour === 0) return "12:00 AM"
    if (hour < 12) return `${hour}:00 AM`
    if (hour === 12) return "12:00 PM"
    return `${hour - 12}:00 PM`
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadingLogo(true)
      setError(null)

      const formData = new FormData()
      formData.append("logo", file)

      const response = await fetch("/api/settings/shop-logo", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload logo")
      }

      // Update profile with new logo URL
      setProfile({ ...profile, logo_url: data.logo_url })
      alert("Logo uploaded successfully!")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploadingLogo(false)
      // Reset the input
      e.target.value = ""
    }
  }

  async function handleLogoDelete() {
    if (!confirm("Are you sure you want to remove the shop logo?")) return

    try {
      setUploadingLogo(true)
      setError(null)

      const response = await fetch("/api/settings/shop-logo", {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove logo")
      }

      // Clear logo from profile
      setProfile({ ...profile, logo_url: null })
      alert("Logo removed successfully!")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploadingLogo(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !profile.shop_name) {
    return (
      <Card className="p-6 border-border">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
        <Button onClick={fetchShopProfile} className="mt-4">
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Shop Logo */}
      <Card className="p-6 border-border">
        <div className="flex items-center gap-3 mb-6">
          <ImageIcon size={20} className="text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Shop Logo</h3>
            <p className="text-sm text-muted-foreground">
              Upload your shop logo for invoices, estimates, and the header
            </p>
          </div>
        </div>
        
        <div className="flex items-start gap-6">
          {/* Logo Preview */}
          <div className="flex-shrink-0">
            <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
              {profile.logo_url ? (
                <Image
                  src={profile.logo_url}
                  alt="Shop Logo"
                  width={128}
                  height={128}
                  className="w-full h-full object-contain"
                  unoptimized
                />
              ) : (
                <div className="text-center p-4">
                  <ImageIcon size={32} className="mx-auto text-muted-foreground mb-2" />
                  <span className="text-xs text-muted-foreground">No logo</span>
                </div>
              )}
            </div>
          </div>

          {/* Upload Controls */}
          <div className="flex-1 space-y-4">
            <div>
              <Label htmlFor="logo-upload" className="block mb-2">
                Upload Logo
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="logo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                  className="flex-1"
                />
                {uploadingLogo && <Loader2 size={20} className="animate-spin text-muted-foreground" />}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Accepted formats: PNG, JPEG, GIF, WebP, SVG. Max size: 5MB
              </p>
            </div>

            {profile.logo_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogoDelete}
                disabled={uploadingLogo}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 size={14} className="mr-2" />
                Remove Logo
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Shop Information */}
      <Card className="p-6 border-border">
        <div className="flex items-center gap-3 mb-6">
          <Building2 size={20} className="text-accent" />
          <h3 className="text-lg font-semibold text-foreground">Shop Information</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="shop-name">Shop Name</Label>
            <Input
              id="shop-name"
              value={profile.shop_name}
              onChange={(e) => setProfile({ ...profile, shop_name: e.target.value })}
              placeholder="Your shop name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dba">DBA / Trade Name</Label>
            <Input
              id="dba"
              value={profile.dba_name}
              onChange={(e) => setProfile({ ...profile, dba_name: e.target.value })}
              placeholder="If different from shop name"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Street Address</Label>
            <div className="flex gap-2">
              <MapPin size={18} className="text-muted-foreground mt-2.5" />
              <Input
                id="address"
                value={profile.address_line1}
                onChange={(e) => setProfile({ ...profile, address_line1: e.target.value })}
                className="flex-1"
                placeholder="Street address"
              />
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address2">Address Line 2</Label>
            <Input
              id="address2"
              value={profile.address_line2}
              onChange={(e) => setProfile({ ...profile, address_line2: e.target.value })}
              placeholder="Suite, unit, building, etc."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={profile.city}
              onChange={(e) => setProfile({ ...profile, city: e.target.value })}
              placeholder="City"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select
                value={profile.state}
                onValueChange={(value) => setProfile({ ...profile, state: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {US_STATES.map((state) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                value={profile.zip}
                onChange={(e) => setProfile({ ...profile, zip: e.target.value })}
                placeholder="ZIP code"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="flex gap-2">
              <Phone size={18} className="text-muted-foreground mt-2.5" />
              <Input
                id="phone"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="flex-1"
                placeholder="(555) 555-5555"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="flex gap-2">
              <Mail size={18} className="text-muted-foreground mt-2.5" />
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="flex-1"
                placeholder="email@example.com"
              />
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="website">Website</Label>
            <div className="flex gap-2">
              <Globe size={18} className="text-muted-foreground mt-2.5" />
              <Input
                id="website"
                value={profile.website}
                onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                className="flex-1"
                placeholder="https://yourshop.com"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Operating Hours */}
      <Card className="p-6 border-border">
        <div className="flex items-center gap-3 mb-6">
          <Clock size={20} className="text-accent" />
          <h3 className="text-lg font-semibold text-foreground">Operating Hours</h3>
        </div>
        <div className="space-y-4">
          {operatingHours.map((hours) => (
            <div key={hours.day_of_week} className="flex items-center gap-4">
              <span className="w-28 text-sm font-medium text-foreground">{hours.day_of_week}</span>
              <Switch
                checked={hours.is_open}
                onCheckedChange={(checked) => updateHours(hours.day_of_week, "is_open", checked)}
              />
              <Select
                value={hours.open_time || "07:00"}
                onValueChange={(value) => updateHours(hours.day_of_week, "open_time", value)}
                disabled={!hours.is_open}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPEN_TIMES.map((time) => (
                    <SelectItem key={time} value={time}>
                      {formatTimeDisplay(time)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">to</span>
              <Select
                value={hours.close_time || "18:00"}
                onValueChange={(value) => updateHours(hours.day_of_week, "close_time", value)}
                disabled={!hours.is_open}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLOSE_TIMES.map((time) => (
                    <SelectItem key={time} value={time}>
                      {formatTimeDisplay(time)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </Card>

      {/* Parts Markup */}
      <Card className="p-6 border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">Parts Markup</p>
            <p className="text-sm text-muted-foreground">Default markup applied to parts cost</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={profile.parts_markup_percent}
              onChange={(e) => setProfile({ ...profile, parts_markup_percent: parseFloat(e.target.value) || 0 })}
              className="w-20 text-right"
              type="number"
              min="0"
              max="100"
            />
            <span className="text-muted-foreground">%</span>
          </div>
        </div>
      </Card>

      {/* Services Offered */}
      <Card className="p-6 border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Services & Specialties</h3>
        <Textarea
          placeholder="Describe your shop's services and specialties..."
          value={profile.services_description}
          onChange={(e) => setProfile({ ...profile, services_description: e.target.value })}
          rows={4}
        />
        <div className="mt-4">
          <Label className="mb-2 block">Specialty Tags</Label>
          <div className="flex flex-wrap gap-2 mb-3">
            {profile.tags.map((tag) => (
              <Button
                key={tag}
                variant="outline"
                size="sm"
                className="h-7 bg-transparent"
                onClick={() => removeTag(tag)}
              >
                {tag}
                <X size={14} className="ml-1" />
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add a tag..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            />
            <Button variant="outline" size="sm" onClick={addTag}>
              <Plus size={16} className="mr-1" />
              Add Tag
            </Button>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 size={16} className="mr-2 animate-spin" />
          ) : (
            <Save size={16} className="mr-2" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}
