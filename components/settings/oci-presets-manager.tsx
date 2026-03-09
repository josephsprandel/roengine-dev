"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Trash2, Plus, Star, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Preset {
  id: number
  label: string
  miles: number
  months: number
  is_default: boolean
  sort_order: number
}

function SortablePresetRow({
  preset,
  onUpdate,
  onDelete,
  onSetDefault,
  canDelete,
}: {
  preset: Preset
  onUpdate: (id: number, field: string, value: string | number) => void
  onDelete: (id: number) => void
  onSetDefault: (id: number) => void
  canDelete: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: preset.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-card border border-border rounded-lg group"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0"
      >
        <GripVertical size={16} />
      </button>

      <Input
        className="w-32 h-8 text-sm bg-transparent border-border"
        value={preset.label}
        onChange={(e) => onUpdate(preset.id, "label", e.target.value)}
        placeholder="Label"
      />
      <Input
        className="w-24 h-8 text-sm bg-transparent border-border text-right"
        type="number"
        min={1000}
        step={500}
        value={preset.miles}
        onChange={(e) => onUpdate(preset.id, "miles", parseInt(e.target.value) || 0)}
        placeholder="Miles"
      />
      <span className="text-xs text-muted-foreground flex-shrink-0">mi</span>
      <Input
        className="w-16 h-8 text-sm bg-transparent border-border text-right"
        type="number"
        min={1}
        max={36}
        value={preset.months}
        onChange={(e) => onUpdate(preset.id, "months", parseInt(e.target.value) || 0)}
        placeholder="Mo"
      />
      <span className="text-xs text-muted-foreground flex-shrink-0">mo</span>

      <Button
        variant="ghost"
        size="sm"
        className={`h-8 w-8 p-0 flex-shrink-0 ${preset.is_default ? "text-yellow-500" : "text-muted-foreground opacity-0 group-hover:opacity-100"}`}
        onClick={() => onSetDefault(preset.id)}
        title={preset.is_default ? "Default preset" : "Set as default"}
      >
        <Star size={14} fill={preset.is_default ? "currentColor" : "none"} />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onDelete(preset.id)}
        disabled={!canDelete}
        title="Delete preset"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  )
}

export function OciPresetsManager() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const fetchPresets = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/oci-presets")
      if (res.ok) setPresets(await res.json())
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPresets() }, [fetchPresets])

  async function handleAdd() {
    try {
      const res = await fetch("/api/settings/oci-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "New Preset", miles: 5000, months: 6 }),
      })
      if (!res.ok) throw new Error("Failed to create preset")
      const created = await res.json()
      setPresets((prev) => [...prev, created])
      toast.success("Preset added")
    } catch {
      toast.error("Failed to add preset")
    }
  }

  async function handleUpdate(id: number, field: string, value: string | number) {
    // Optimistic update locally
    setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))

    // Debounced save handled by blur or could be inline — let's save on change
    setSaving(true)
    try {
      await fetch(`/api/settings/oci-presets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
    } catch {
      toast.error("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    const prev = [...presets]
    setPresets((p) => p.filter((x) => x.id !== id))
    try {
      const res = await fetch(`/api/settings/oci-presets/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to delete")
      }
      toast.success("Preset deleted")
      // Re-fetch to get updated default status
      fetchPresets()
    } catch (err: any) {
      setPresets(prev)
      toast.error(err.message)
    }
  }

  async function handleSetDefault(id: number) {
    setPresets((prev) => prev.map((p) => ({ ...p, is_default: p.id === id })))
    try {
      await fetch(`/api/settings/oci-presets/${id}/set-default`, { method: "PATCH" })
      toast.success("Default updated")
    } catch {
      toast.error("Failed to set default")
      fetchPresets()
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = presets.findIndex((p) => p.id === active.id)
    const newIndex = presets.findIndex((p) => p.id === over.id)
    const reordered = arrayMove(presets, oldIndex, newIndex)
    setPresets(reordered)

    try {
      await fetch("/api/settings/oci-presets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: reordered.map((p) => p.id) }),
      })
    } catch {
      toast.error("Failed to reorder")
      fetchPresets()
    }
  }

  if (loading) {
    return (
      <Card className="p-6 border-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading presets...
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 border-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Oil Change Decal Presets</h3>
          <p className="text-sm text-muted-foreground">
            Configurable presets for windshield decals. Star marks the default. Drag to reorder.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          <Button variant="outline" size="sm" className="gap-1.5 bg-transparent" onClick={handleAdd}>
            <Plus size={14} /> Add Preset
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <div className="w-4" />
          <div className="w-32">Label</div>
          <div className="w-24 text-right">Miles</div>
          <div className="w-4" />
          <div className="w-16 text-right">Months</div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={presets.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {presets.map((preset) => (
              <SortablePresetRow
                key={preset.id}
                preset={preset}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onSetDefault={handleSetDefault}
                canDelete={presets.length > 1}
              />
            ))}
          </SortableContext>
        </DndContext>

        {presets.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No presets configured. Add one to get started.
          </p>
        )}
      </div>
    </Card>
  )
}
