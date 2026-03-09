"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Palette, Loader2, ArrowLeft, ArrowRight, SkipForward, Upload, ImageIcon } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"

interface StepProps {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  saving: boolean
}

export function StepBranding({ onNext, onBack, onSkip, saving }: StepProps) {
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [savingDesc, setSavingDesc] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [description, setDescription] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/shop-profile')
        if (res.ok) {
          const data = await res.json()
          if (data.profile) {
            setLogoUrl(data.profile.logo_url || null)
            setDescription(data.profile.services_description || "")
          }
        }
      } catch {
        // Defaults
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)

      const res = await fetch('/api/settings/shop-logo', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to upload logo')
      }

      const data = await res.json()
      setLogoUrl(`${data.logo_url}?t=${Date.now()}`)
      toast.success('Logo uploaded')
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload logo')
    } finally {
      setUploading(false)
    }
  }

  async function handleFinish() {
    // Save description if changed
    if (description) {
      setSavingDesc(true)
      try {
        await fetch('/api/settings/shop-profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: { services_description: description },
          }),
        })
      } catch {
        // Non-critical
      } finally {
        setSavingDesc(false)
      }
    }
    onNext()
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
          <Palette size={28} className="text-blue-500" />
          Branding
        </h2>
        <p className="text-muted-foreground mt-1">
          Upload your shop logo and add a description. These appear on invoices and customer-facing pages.
        </p>
      </div>

      <Card className="p-6 border-border space-y-6">
        {/* Logo upload */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Shop Logo</Label>
          <div className="flex items-center gap-6">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="Shop logo"
                width={80}
                height={80}
                className="w-20 h-20 rounded-lg object-contain border border-border"
                unoptimized
              />
            ) : (
              <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                <ImageIcon size={32} className="text-muted-foreground" />
              </div>
            )}
            <div>
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" disabled={uploading} asChild>
                  <span>
                    {uploading ? (
                      <Loader2 size={14} className="mr-2 animate-spin" />
                    ) : (
                      <Upload size={14} className="mr-2" />
                    )}
                    {uploading ? "Uploading..." : logoUrl ? "Change Logo" : "Upload Logo"}
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-muted-foreground mt-2">
                PNG, JPG, or SVG. Recommended: 200x200px or larger.
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Shop Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your shop's specialties, services, and what makes you unique..."
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Shown on customer-facing pages and estimates
          </p>
        </div>
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
          <Button onClick={handleFinish} disabled={saving || savingDesc}>
            {(saving || savingDesc) && <Loader2 size={16} className="mr-2 animate-spin" />}
            Continue
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
