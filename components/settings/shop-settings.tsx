"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Building2, Clock, MapPin, Phone, Mail, Globe, Save } from "lucide-react"

export function ShopSettings() {
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => setSaving(false), 1000)
  }

  return (
    <div className="space-y-6">
      {/* Shop Information */}
      <Card className="p-6 border-border">
        <div className="flex items-center gap-3 mb-6">
          <Building2 size={20} className="text-accent" />
          <h3 className="text-lg font-semibold text-foreground">Shop Information</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="shop-name">Shop Name</Label>
            <Input id="shop-name" defaultValue="Downtown Auto Repair" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dba">DBA / Trade Name</Label>
            <Input id="dba" placeholder="If different from shop name" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Street Address</Label>
            <div className="flex gap-2">
              <MapPin size={18} className="text-muted-foreground mt-2.5" />
              <Input id="address" defaultValue="1234 Main Street, Suite 100" className="flex-1" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" defaultValue="Los Angeles" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select defaultValue="CA">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CA">California</SelectItem>
                  <SelectItem value="TX">Texas</SelectItem>
                  <SelectItem value="FL">Florida</SelectItem>
                  <SelectItem value="NY">New York</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input id="zip" defaultValue="90012" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="flex gap-2">
              <Phone size={18} className="text-muted-foreground mt-2.5" />
              <Input id="phone" defaultValue="(213) 555-0123" className="flex-1" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="flex gap-2">
              <Mail size={18} className="text-muted-foreground mt-2.5" />
              <Input id="email" type="email" defaultValue="service@downtownauto.com" className="flex-1" />
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="website">Website</Label>
            <div className="flex gap-2">
              <Globe size={18} className="text-muted-foreground mt-2.5" />
              <Input id="website" defaultValue="https://downtownautorepair.com" className="flex-1" />
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
          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
            <div key={day} className="flex items-center gap-4">
              <span className="w-28 text-sm font-medium text-foreground">{day}</span>
              <Switch defaultChecked={day !== "Sunday"} />
              <Select defaultValue={day === "Saturday" ? "8:00" : "7:00"}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["6:00", "7:00", "8:00", "9:00"].map((time) => (
                    <SelectItem key={time} value={time}>
                      {time} AM
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">to</span>
              <Select defaultValue={day === "Saturday" ? "14:00" : "18:00"}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["14:00", "16:00", "17:00", "18:00", "19:00", "20:00"].map((time) => (
                    <SelectItem key={time} value={time}>
                      {parseInt(time) > 12 ? `${parseInt(time) - 12}:00 PM` : `${time} PM`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </Card>

      {/* Services Offered */}
      <Card className="p-6 border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Services & Specialties</h3>
        <Textarea
          placeholder="Describe your shop's services and specialties..."
          defaultValue="Full-service auto repair specializing in domestic and Asian vehicles. ASE-certified technicians. Services include engine diagnostics, brake repair, transmission service, AC repair, electrical systems, and routine maintenance. Factory-scheduled maintenance for all makes and models."
          rows={4}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {["ASE Certified", "AAA Approved", "Domestic", "Asian", "European", "Hybrid/EV", "Diesel"].map((tag) => (
            <Button key={tag} variant="outline" size="sm" className="h-7 bg-transparent">
              {tag}
            </Button>
          ))}
          <Button variant="ghost" size="sm" className="h-7 text-accent">
            + Add Tag
          </Button>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save size={16} className="mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}
