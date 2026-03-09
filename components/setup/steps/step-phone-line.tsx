"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Phone, Loader2, ArrowLeft, SkipForward,
  Check, Search, MapPin, Rocket,
} from "lucide-react"
import { toast } from "sonner"
import { formatPhoneNumber } from "@/lib/utils/phone-format"
import { cn } from "@/lib/utils"

interface AvailableNumber {
  phone_number: string
  locality: string | null
  administrative_area: string | null
  monthly_cost: string
}

interface StepProps {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

export function StepPhoneLine({ onNext, onBack, onSkip }: StepProps) {
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [provisioning, setProvisioning] = useState(false)
  const [provisioned, setProvisioned] = useState<string | null>(null)
  const [areaCode, setAreaCode] = useState("")
  const [numbers, setNumbers] = useState<AvailableNumber[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Auto-detect area code from shop phone on load
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings/shop-profile")
        if (res.ok) {
          const data = await res.json()
          const phone = data.profile?.phone || ""
          const digits = phone.replace(/\D/g, "").slice(-10)
          if (digits.length === 10) {
            setAreaCode(digits.slice(0, 3))
          }
          // Check if already provisioned
          if (data.profile?.telnyx_phone) {
            setProvisioned(data.profile.telnyx_phone)
          }
        }
      } catch {
        // defaults
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Auto-search when area code is detected
  useEffect(() => {
    if (!loading && areaCode.length === 3 && !provisioned && numbers.length === 0) {
      searchNumbers()
    }
  }, [loading, areaCode, provisioned])

  const searchNumbers = useCallback(async () => {
    if (areaCode.length !== 3) return
    setSearching(true)
    setSearchError(null)
    setNumbers([])
    setSelected(null)
    try {
      const token = localStorage.getItem("auth_token")
      const res = await fetch(`/api/telnyx/available-numbers?area_code=${areaCode}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Search failed")
      }
      const data = await res.json()
      if (data.numbers.length === 0) {
        setSearchError("No numbers available in this area code. Try a nearby one.")
      } else {
        setNumbers(data.numbers)
      }
    } catch (err: any) {
      setSearchError(err.message || "Failed to search numbers")
    } finally {
      setSearching(false)
    }
  }, [areaCode])

  async function handleProvision() {
    if (!selected) return
    setProvisioning(true)
    try {
      const token = localStorage.getItem("auth_token")
      const res = await fetch("/api/telnyx/provision-number", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phone_number: selected }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Provisioning failed")
      setProvisioned(data.phone_number)
      toast.success("Phone number claimed!")
    } catch (err: any) {
      toast.error(err.message || "Failed to provision number")
    } finally {
      setProvisioning(false)
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
          <Phone size={28} className="text-blue-500" />
          Your Phone Line
        </h2>
        <p className="text-muted-foreground mt-1">
          Your RO Engine phone line — customers see this number when you call or text them, and it&apos;s how they reach your AI phone assistant.
        </p>
      </div>

      {provisioned ? (
        /* Already provisioned — show confirmation */
        <Card className="p-6 border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check size={24} className="text-green-500" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {formatPhoneNumber(provisioned.replace('+1', ''))}
              </p>
              <p className="text-sm text-muted-foreground">
                Your RO Engine phone number is active
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Customers will see this number for calls and texts. You can change it later in Settings.
          </p>
        </Card>
      ) : (
        /* Number selection */
        <Card className="p-6 border-border space-y-5">
          {/* Area code search */}
          <div className="space-y-2">
            <Label>Area Code</Label>
            <div className="flex gap-2">
              <Input
                value={areaCode}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 3)
                  setAreaCode(v)
                }}
                placeholder="479"
                className="w-24"
                maxLength={3}
              />
              <Button
                variant="outline"
                onClick={searchNumbers}
                disabled={searching || areaCode.length !== 3}
              >
                {searching ? (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                ) : (
                  <Search size={14} className="mr-2" />
                )}
                Search
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              We auto-detected your area code from your shop phone. Change it to search a different area.
            </p>
          </div>

          {/* Search error */}
          {searchError && (
            <p className="text-sm text-destructive">{searchError}</p>
          )}

          {/* Loading state */}
          {searching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-3 text-sm text-muted-foreground">Searching for numbers near you...</span>
            </div>
          )}

          {/* Number options */}
          {numbers.length > 0 && !searching && (
            <div className="space-y-2">
              <Label>Available Numbers</Label>
              <div className="grid gap-2">
                {numbers.map((n) => (
                  <button
                    key={n.phone_number}
                    onClick={() => setSelected(n.phone_number)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border text-left transition-colors",
                      selected === n.phone_number
                        ? "border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/20"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        selected === n.phone_number
                          ? "border-blue-500 bg-blue-500"
                          : "border-muted-foreground/30"
                      )}>
                        {selected === n.phone_number && (
                          <Check size={12} className="text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {formatPhoneNumber(n.phone_number.replace('+1', ''))}
                        </p>
                        {n.locality && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin size={10} />
                            {n.locality}{n.administrative_area ? `, ${n.administrative_area}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Provision button */}
          {selected && (
            <Button
              onClick={handleProvision}
              disabled={provisioning}
              className="w-full"
              size="lg"
            >
              {provisioning ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <Check size={16} className="mr-2" />
              )}
              {provisioning ? "Claiming number..." : "Claim This Number"}
            </Button>
          )}
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft size={16} className="mr-2" />
          Back
        </Button>
        <div className="flex gap-3">
          {!provisioned && (
            <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
              I&apos;ll set this up later
              <SkipForward size={16} className="ml-2" />
            </Button>
          )}
          <Button onClick={onNext}>
            Launch RO Engine
            <Rocket size={16} className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
