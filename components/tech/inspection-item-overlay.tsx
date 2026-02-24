'use client'

import { useState, useCallback } from 'react'
import { X, Check, Sparkles, Loader2, AlertTriangle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { PhotoCapture } from './photo-capture'
import { PhotoAnnotationOverlay } from './photo-annotation-overlay'
import {
  STATUS_COLORS,
  CONDITION_OPTIONS,
  detectMeasurementUnit,
  getAutoRecommendation,
} from '@/lib/tech-helpers'
import type { TechInspectionItem, AutoRecommendation } from '@/lib/tech-helpers'

interface InspectionItemOverlayProps {
  item: TechInspectionItem
  roId: number
  vehicleYMM: string
  onClose: () => void
  onSave: (updated: TechInspectionItem) => void
}

type InspectionStatus = 'pending' | 'green' | 'yellow' | 'red'

export function InspectionItemOverlay({
  item,
  roId,
  vehicleYMM,
  onClose,
  onSave,
}: InspectionItemOverlayProps) {
  const [status, setStatus] = useState<InspectionStatus>(item.status)
  const [techNotes, setTechNotes] = useState(item.tech_notes || '')
  const [aiCleanedNotes, setAiCleanedNotes] = useState(item.ai_cleaned_notes || '')
  const [condition, setCondition] = useState(item.condition || '')
  const [measurementValue, setMeasurementValue] = useState<string>(
    item.measurement_value != null ? String(item.measurement_value) : ''
  )
  const [measurementUnit, setMeasurementUnit] = useState(
    item.measurement_unit || detectMeasurementUnit(item.item_name)
  )
  const [photos, setPhotos] = useState<string[]>(item.photos || [])

  const [saving, setSaving] = useState(false)
  const [cleaningNotes, setCleaningNotes] = useState(false)
  const [creatingRecommendation, setCreatingRecommendation] = useState(false)
  const [recommendationCreated, setRecommendationCreated] = useState(!!item.finding_recommendation_id)

  // Photo annotation
  const [annotatingPhotoIndex, setAnnotatingPhotoIndex] = useState<number | null>(null)

  // Auto-recommendation detection
  const parsedValue = parseFloat(measurementValue)
  const autoRec: AutoRecommendation | null =
    !isNaN(parsedValue) && measurementUnit
      ? getAutoRecommendation(item.item_name, parsedValue, measurementUnit)
      : null

  const showFindingSection = status === 'yellow' || status === 'red'

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token')
    return {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/inspection-results/${item.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status,
          tech_notes: techNotes || null,
          ai_cleaned_notes: aiCleanedNotes || null,
          condition: condition || null,
          measurement_value: measurementValue ? parseFloat(measurementValue) : null,
          measurement_unit: measurementUnit || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        onSave({
          ...item,
          status,
          tech_notes: techNotes,
          ai_cleaned_notes: aiCleanedNotes,
          condition,
          measurement_value: measurementValue ? parseFloat(measurementValue) : null,
          measurement_unit: measurementUnit,
          photos,
          finding_recommendation_id: recommendationCreated ? (item.finding_recommendation_id || -1) : null,
        })
      }
    } catch (err) {
      console.error('Error saving inspection:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleCleanNotes = async () => {
    if (!techNotes.trim()) return
    setCleaningNotes(true)
    try {
      const res = await fetch('/api/tech/clean-notes', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          notes: techNotes,
          vehicle: vehicleYMM,
          inspection_item: item.item_name,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAiCleanedNotes(data.cleaned_notes)
      }
    } catch (err) {
      console.error('Error cleaning notes:', err)
    } finally {
      setCleaningNotes(false)
    }
  }

  const handleCreateRecommendation = async () => {
    setCreatingRecommendation(true)
    try {
      const rec = autoRec || {
        service_title: `${item.item_name} — Attention Needed`,
        reason: aiCleanedNotes || techNotes || 'Identified during vehicle inspection',
        priority: status === 'red' ? 'critical' : 'recommended',
        category_id: 2,
      }

      const res = await fetch(`/api/tech/inspection/${item.id}/finding`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status,
          tech_notes: techNotes || null,
          ai_cleaned_notes: aiCleanedNotes || null,
          condition: condition || null,
          measurement_value: measurementValue ? parseFloat(measurementValue) : null,
          measurement_unit: measurementUnit || null,
          create_recommendation: true,
          service_title: rec.service_title,
          reason: rec.reason,
          priority: rec.priority,
          category_id: rec.category_id,
        }),
      })

      if (res.ok) {
        setRecommendationCreated(true)
      }
    } catch (err) {
      console.error('Error creating recommendation:', err)
    } finally {
      setCreatingRecommendation(false)
    }
  }

  const handleAnnotationSave = async (annotatedBlob: Blob) => {
    if (annotatingPhotoIndex === null) return

    // Upload the annotated image as a replacement
    const formData = new FormData()
    formData.append('photo', annotatedBlob, `annotated-${Date.now()}.jpg`)

    const token = localStorage.getItem('auth_token')

    // First delete the old photo
    try {
      await fetch(`/api/tech/inspection/${item.id}/photo/${annotatingPhotoIndex}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    } catch {}

    // Then upload the annotated version
    try {
      const res = await fetch(`/api/tech/inspection/${item.id}/photo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        setPhotos(data.photos)
      }
    } catch (err) {
      console.error('Error saving annotated photo:', err)
    }

    setAnnotatingPhotoIndex(null)
  }

  // Render annotation overlay on top if active
  if (annotatingPhotoIndex !== null && photos[annotatingPhotoIndex]) {
    return (
      <PhotoAnnotationOverlay
        photoUrl={photos[annotatingPhotoIndex]}
        onSave={handleAnnotationSave}
        onCancel={() => setAnnotatingPhotoIndex(null)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border bg-background flex-shrink-0">
        <button onClick={onClose} className="p-2 -ml-2">
          <X size={22} />
        </button>
        <h2 className="text-sm font-medium text-foreground truncate flex-1 mx-3 text-center">
          {item.item_name}
        </h2>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="h-9 px-4"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8 space-y-6">
        {/* Status Buttons */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
            Status
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['green', 'yellow', 'red'] as const).map((s) => {
              const isSelected = status === s
              const labels = { green: 'Good', yellow: 'Caution', red: 'Needs Attention' }
              const bgColors = {
                green: isSelected ? 'bg-green-500 text-white border-green-500' : 'bg-background border-green-500/40 text-green-600',
                yellow: isSelected ? 'bg-amber-500 text-white border-amber-500' : 'bg-background border-amber-500/40 text-amber-600',
                red: isSelected ? 'bg-red-500 text-white border-red-500' : 'bg-background border-red-500/40 text-red-600',
              }

              return (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex flex-col items-center justify-center rounded-xl border-2 transition-all active:scale-95 ${bgColors[s]}`}
                  style={{ minHeight: '60px' }}
                >
                  {isSelected && <Check size={20} className="mb-0.5" />}
                  <span className="text-sm font-medium">{labels[s]}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Photos */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
            Photos ({photos.length}/5)
          </label>
          <PhotoCapture
            photos={photos}
            inspectionResultId={item.id}
            onPhotoAdded={setPhotos}
            onPhotoRemoved={setPhotos}
            onPhotoTap={(index) => setAnnotatingPhotoIndex(index)}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
            Notes
          </label>
          <Textarea
            value={techNotes}
            onChange={(e) => setTechNotes(e.target.value)}
            placeholder="What did you find? (tech shorthand is OK)"
            rows={3}
            className="text-base resize-none"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleCleanNotes}
            disabled={cleaningNotes || !techNotes.trim()}
            className="mt-2 gap-1.5"
          >
            {cleaningNotes ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            AI Cleanup
          </Button>

          {/* AI cleaned notes */}
          {aiCleanedNotes && (
            <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles size={12} className="text-primary" />
                <span className="text-xs font-medium text-primary">AI Cleaned</span>
              </div>
              <p className="text-sm text-foreground">{aiCleanedNotes}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTechNotes(aiCleanedNotes)}
                className="mt-1.5 text-xs h-7"
              >
                Use as main notes
              </Button>
            </div>
          )}
        </div>

        {/* Finding Section (Yellow/Red only) */}
        {showFindingSection && (
          <div className="space-y-4 p-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              <span className="text-sm font-medium text-foreground">Add Finding</span>
            </div>

            {/* Condition */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full h-12 px-3 text-base rounded-lg bg-background border border-border text-foreground"
              >
                <option value="">Select condition...</option>
                {CONDITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Measurement */}
            {measurementUnit && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Measurement ({measurementUnit})
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={measurementValue}
                    onChange={(e) => setMeasurementValue(e.target.value)}
                    placeholder="0.0"
                    className="flex-1 h-12 px-3 text-base rounded-lg bg-background border border-border text-foreground"
                  />
                  <select
                    value={measurementUnit}
                    onChange={(e) => setMeasurementUnit(e.target.value)}
                    className="h-12 px-3 text-base rounded-lg bg-background border border-border text-foreground"
                  >
                    <option value="mm">mm</option>
                    <option value="32nds">32nds</option>
                    <option value="V">Volts</option>
                    <option value="psi">PSI</option>
                    <option value="%">%</option>
                  </select>
                </div>
              </div>
            )}

            {/* Auto-recommendation banner */}
            {autoRec && !recommendationCreated && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className="text-red-500" />
                  <span className="text-sm font-bold text-red-600">Auto-Detected</span>
                </div>
                <p className="text-sm text-foreground mb-2">{autoRec.service_title}</p>
                <p className="text-xs text-muted-foreground">{autoRec.reason}</p>
              </div>
            )}

            {/* Create Recommendation button */}
            {recommendationCreated ? (
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                <Check size={16} />
                Recommendation created
              </div>
            ) : (
              <Button
                onClick={handleCreateRecommendation}
                disabled={creatingRecommendation}
                className="w-full h-12 text-base gap-2"
                variant={autoRec ? 'default' : 'outline'}
              >
                {creatingRecommendation ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Plus size={18} />
                )}
                {autoRec ? `Create: ${autoRec.service_title}` : 'Create Recommendation'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
