"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  GripVertical,
  Trash2,
  Plus,
  Loader2,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Check,
} from "lucide-react"
import { toast } from "sonner"

interface PhoneSettings {
  shop_id: number
  assistant_name: string
  aggression_level: number
  roast_mode: boolean
  car_commentary: string
  robocaller_acknowledgment: boolean
  greeting_style: string
  voice_style: string
  generated_prompt: string | null
  prompt_dirty: boolean
  last_generated_at: string | null
}

interface Intro {
  id: number
  shop_id: number
  intro_text: string
  sort_order: number
  is_active: boolean
  created_at: string
}

const AGGRESSION_LABELS: Record<number, { label: string; desc: string }> = {
  1: { label: "Professional", desc: "Courteous and corporate. No humor." },
  2: { label: "Friendly", desc: "Light banter, mostly professional." },
  3: { label: "Full Personality", desc: "Dry wit, genuine opinions, conversational." },
  4: { label: "Chicago Deli", desc: "Loud personality, strong opinions, rapid banter." },
  5: { label: "Unleashed", desc: "Maximum personality. Chaotic but helpful." },
}

const VOICE_OPTIONS = [
  { value: "dry_deadpan", label: "Dry & Deadpan" },
  { value: "warm_funny", label: "Warm & Funny" },
  { value: "enthusiastic", label: "Enthusiastic" },
  { value: "gruff", label: "Gruff but Lovable" },
]

const CAR_COMMENTARY_OPTIONS = [
  { value: "always", label: "Always" },
  { value: "interesting_only", label: "Interesting Only" },
  { value: "never", label: "Never" },
]

const GREETING_OPTIONS = [
  { value: "randomized", label: "Randomized" },
  { value: "semi_scripted", label: "Semi-Scripted" },
  { value: "improvised", label: "Improvised" },
]

function SortableIntroRow({
  intro,
  onDelete,
}: {
  intro: Intro
  onDelete: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: intro.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 bg-background border rounded-md group"
    >
      <button
        className="cursor-grab text-muted-foreground hover:text-foreground shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <p className="flex-1 text-sm text-foreground truncate">{intro.intro_text}</p>
      <button
        onClick={() => onDelete(intro.id)}
        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export function PhoneAssistantSettings() {
  const [settings, setSettings] = useState<PhoneSettings | null>(null)
  const [intros, setIntros] = useState<Intro[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null)
  const [promptExpanded, setPromptExpanded] = useState(false)
  const [newIntroText, setNewIntroText] = useState("")
  const [addingIntro, setAddingIntro] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/phone-assistant")
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      setSettings(data.settings)
      setIntros(data.intros)
    } catch (err: any) {
      toast.error("Failed to load phone settings")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const updateField = (field: keyof PhoneSettings, value: any) => {
    if (!settings) return
    setSettings({ ...settings, [field]: value })
    setHasChanges(true)
  }

  const saveSettings = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch("/api/settings/phone-assistant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistant_name: settings.assistant_name,
          aggression_level: settings.aggression_level,
          roast_mode: settings.roast_mode,
          car_commentary: settings.car_commentary,
          robocaller_acknowledgment: settings.robocaller_acknowledgment,
          greeting_style: settings.greeting_style,
          voice_style: settings.voice_style,
        }),
      })
      if (!res.ok) throw new Error("Failed to save")
      const data = await res.json()
      setSettings(data.settings)
      setHasChanges(false)
      toast.success("Phone settings saved")
    } catch {
      toast.error("Failed to save phone settings")
    } finally {
      setSaving(false)
    }
  }

  const generatePrompt = async (confirm: boolean = false) => {
    setGenerating(true)
    try {
      const res = await fetch("/api/settings/phone-assistant/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Generation failed")
      }
      const data = await res.json()

      if (confirm) {
        setSettings((prev) =>
          prev
            ? {
                ...prev,
                generated_prompt: data.prompt,
                prompt_dirty: false,
                last_generated_at: new Date().toISOString(),
              }
            : prev
        )
        setPreviewPrompt(null)
        toast.success("Prompt generated and synced to Retell")
      } else {
        setPreviewPrompt(data.prompt)
        toast.info("Preview generated — review and confirm to apply")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate prompt")
    } finally {
      setGenerating(false)
    }
  }

  const addIntro = async () => {
    if (!newIntroText.trim()) return
    setAddingIntro(true)
    try {
      const res = await fetch("/api/settings/phone-assistant/intros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intro_text: newIntroText.trim() }),
      })
      if (!res.ok) throw new Error("Failed to add")
      const data = await res.json()
      setIntros((prev) => [...prev, data.intro])
      setNewIntroText("")
      setSettings((prev) => (prev ? { ...prev, prompt_dirty: true } : prev))
      toast.success("Intro added")
    } catch {
      toast.error("Failed to add intro")
    } finally {
      setAddingIntro(false)
    }
  }

  const deleteIntro = async (id: number) => {
    try {
      const res = await fetch("/api/settings/phone-assistant/intros", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error("Failed to delete")
      setIntros((prev) => prev.filter((i) => i.id !== id))
      setSettings((prev) => (prev ? { ...prev, prompt_dirty: true } : prev))
      toast.success("Intro removed")
    } catch {
      toast.error("Failed to remove intro")
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = intros.findIndex((i) => i.id === active.id)
    const newIndex = intros.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(intros, oldIndex, newIndex)
    setIntros(reordered)

    try {
      await fetch("/api/settings/phone-assistant/intros", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: reordered.map((i) => i.id) }),
      })
      setSettings((prev) => (prev ? { ...prev, prompt_dirty: true } : prev))
    } catch {
      toast.error("Failed to reorder")
      fetchData()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    )
  }

  if (!settings) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Phone settings not configured. Run migration 056.</p>
      </Card>
    )
  }

  const aggressionInfo = AGGRESSION_LABELS[settings.aggression_level]

  return (
    <div className="space-y-6">
      {/* Dirty banner */}
      {settings.prompt_dirty && (
        <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertTriangle size={18} className="text-yellow-500 shrink-0" />
          <p className="text-sm text-yellow-600 dark:text-yellow-400 flex-1">
            Settings have changed since last prompt generation. Regenerate to apply.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => generatePrompt(false)}
            disabled={generating}
            className="shrink-0"
          >
            {generating ? <Loader2 size={14} className="animate-spin mr-1" /> : <Sparkles size={14} className="mr-1" />}
            Regenerate
          </Button>
        </div>
      )}

      {/* Identity */}
      <Card className="p-6">
        <h4 className="text-sm font-semibold text-foreground mb-4">Identity</h4>
        <div className="max-w-sm">
          <Label htmlFor="assistant-name">Assistant Name</Label>
          <Input
            id="assistant-name"
            value={settings.assistant_name}
            onChange={(e) => updateField("assistant_name", e.target.value)}
            placeholder="Claude"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            The name the AI uses when answering calls
          </p>
        </div>
      </Card>

      {/* Personality */}
      <Card className="p-6 space-y-6">
        <h4 className="text-sm font-semibold text-foreground">Personality</h4>

        {/* Aggression slider */}
        <div>
          <Label>
            Aggression Level: {aggressionInfo.label} ({settings.aggression_level}/5)
          </Label>
          <Slider
            value={[settings.aggression_level]}
            onValueChange={([v]) => updateField("aggression_level", v)}
            min={1}
            max={5}
            step={1}
            className="mt-3 max-w-sm"
          />
          <p className="text-xs text-muted-foreground mt-2">{aggressionInfo.desc}</p>
        </div>

        {/* Voice style */}
        <div className="max-w-sm">
          <Label>Voice Style</Label>
          <Select
            value={settings.voice_style}
            onValueChange={(v) => updateField("voice_style", v)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Switches row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div>
              <Label className="text-sm">Roast Mode</Label>
              <p className="text-xs text-muted-foreground">Playful teasing about cars</p>
            </div>
            <Switch
              checked={settings.roast_mode}
              onCheckedChange={(v) => updateField("roast_mode", v)}
            />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div>
              <Label className="text-sm">Robocaller Acknowledgment</Label>
              <p className="text-xs text-muted-foreground">Humor for spam calls</p>
            </div>
            <Switch
              checked={settings.robocaller_acknowledgment}
              onCheckedChange={(v) => updateField("robocaller_acknowledgment", v)}
            />
          </div>
        </div>

        {/* Car commentary */}
        <div className="max-w-sm">
          <Label>Car Commentary</Label>
          <Select
            value={settings.car_commentary}
            onValueChange={(v) => updateField("car_commentary", v)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAR_COMMENTARY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Whether the AI comments on callers' vehicles
          </p>
        </div>
      </Card>

      {/* Greeting */}
      <Card className="p-6 space-y-4">
        <h4 className="text-sm font-semibold text-foreground">Greeting</h4>

        <div className="max-w-sm">
          <Label>Greeting Style</Label>
          <Select
            value={settings.greeting_style}
            onValueChange={(v) => updateField("greeting_style", v)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GREETING_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Intro pool */}
        <div>
          <Label className="mb-2 block">Intro Pool</Label>
          <p className="text-xs text-muted-foreground mb-3">
            Greeting lines the AI draws from. Drag to reorder priority.
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={intros.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {intros.map((intro) => (
                  <SortableIntroRow
                    key={intro.id}
                    intro={intro}
                    onDelete={deleteIntro}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {intros.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
              No intros yet. Add one below.
            </p>
          )}

          {/* Add new intro */}
          <div className="flex gap-2 mt-3">
            <Input
              value={newIntroText}
              onChange={(e) => setNewIntroText(e.target.value)}
              placeholder="New greeting line..."
              onKeyDown={(e) => e.key === "Enter" && addIntro()}
              className="flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={addIntro}
              disabled={addingIntro || !newIntroText.trim()}
            >
              {addingIntro ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            </Button>
          </div>
        </div>
      </Card>

      {/* Generated Prompt */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Generated Prompt</h4>
          <div className="flex items-center gap-2">
            {settings.last_generated_at && (
              <span className="text-xs text-muted-foreground">
                Last generated:{" "}
                {new Date(settings.last_generated_at).toLocaleString()}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => generatePrompt(false)}
              disabled={generating}
            >
              {generating ? (
                <Loader2 size={14} className="animate-spin mr-1" />
              ) : (
                <Sparkles size={14} className="mr-1" />
              )}
              {previewPrompt ? "Regenerate" : "Generate Preview"}
            </Button>
          </div>
        </div>

        {/* Preview prompt (not yet confirmed) */}
        {previewPrompt && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Sparkles size={16} className="text-blue-500 shrink-0" />
              <p className="text-sm text-blue-600 dark:text-blue-400 flex-1">
                Preview ready. Review below, then confirm to save and sync to Retell.
              </p>
              <Button
                size="sm"
                onClick={() => generatePrompt(true)}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 size={14} className="animate-spin mr-1" />
                ) : (
                  <Check size={14} className="mr-1" />
                )}
                Confirm & Apply
              </Button>
            </div>
            <Textarea
              value={previewPrompt}
              readOnly
              className="font-mono text-xs min-h-[300px]"
            />
          </div>
        )}

        {/* Current saved prompt (collapsible) */}
        {settings.generated_prompt && !previewPrompt && (
          <div>
            <button
              onClick={() => setPromptExpanded(!promptExpanded)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {promptExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {promptExpanded ? "Hide" : "Show"} current prompt ({settings.generated_prompt.length} chars)
            </button>
            {promptExpanded && (
              <Textarea
                value={settings.generated_prompt}
                readOnly
                className="font-mono text-xs min-h-[300px] mt-2"
              />
            )}
          </div>
        )}

        {!settings.generated_prompt && !previewPrompt && (
          <p className="text-sm text-muted-foreground">
            No prompt generated yet. Using file-based template as fallback.
          </p>
        )}
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving || !hasChanges}>
          {saving && <Loader2 size={14} className="animate-spin mr-2" />}
          Save Settings
        </Button>
      </div>
    </div>
  )
}
