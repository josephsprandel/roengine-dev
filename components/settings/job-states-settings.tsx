"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { GripVertical, Plus, Pencil, Trash2, ChevronRight, Loader2 } from "lucide-react"
import { getIcon, jobStateBadgeStyle } from "@/lib/job-states"
import type { JobState } from "@/lib/job-states"
import { JobStateFormDialog } from "./job-state-form-dialog"

// Sortable item component
function SortableStateItem({
  state,
  onEdit,
  onDelete,
}: {
  state: JobState
  onEdit: (state: JobState) => void
  onDelete: (state: JobState) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: state.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const Icon = getIcon(state.icon)
  const badgeStyle = jobStateBadgeStyle(state.color)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg group"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical size={16} />
      </button>

      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: state.color }}
      />

      <Icon size={16} style={{ color: state.color }} className="flex-shrink-0" />

      <span className="font-medium text-sm text-foreground flex-1">{state.name}</span>

      <div className="flex items-center gap-1.5">
        {state.is_initial && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Initial
          </Badge>
        )}
        {state.is_terminal && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Terminal
          </Badge>
        )}
        {state.is_system && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            System
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onEdit(state)}
        >
          <Pencil size={14} />
        </Button>
        {!state.is_system && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(state)}
          >
            <Trash2 size={14} />
          </Button>
        )}
      </div>
    </div>
  )
}

// Pipeline preview component
function PipelinePreview({ states }: { states: JobState[] }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {states.map((state, idx) => {
        const Icon = getIcon(state.icon)
        const style = jobStateBadgeStyle(state.color)

        return (
          <div key={state.id} className="flex items-center gap-1 flex-shrink-0">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border"
              style={style}
            >
              <Icon size={14} />
              <span className="whitespace-nowrap">{state.name}</span>
            </div>
            {idx < states.length - 1 && (
              <ChevronRight size={14} className="text-border flex-shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function JobStatesSettings() {
  const [states, setStates] = useState<JobState[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingState, setEditingState] = useState<JobState | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const fetchStates = useCallback(async () => {
    try {
      const res = await fetch("/api/job-states")
      if (res.ok) {
        const data = await res.json()
        setStates(data.job_states || [])
      }
    } catch (err) {
      console.error("Error fetching job states:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStates()
  }, [fetchStates])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = states.findIndex((s) => s.id === active.id)
    const newIndex = states.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(states, oldIndex, newIndex)
    setStates(reordered)

    // Persist reorder
    try {
      await fetch("/api/job-states/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: reordered.map((s) => s.id) }),
      })
    } catch (err) {
      console.error("Error reordering:", err)
      fetchStates() // Revert
    }
  }

  const handleEdit = (state: JobState) => {
    setEditingState(state)
    setFormOpen(true)
  }

  const handleAdd = () => {
    setEditingState(null)
    setFormOpen(true)
  }

  const handleDelete = async (state: JobState) => {
    setDeleteError(null)
    if (!window.confirm(`Delete "${state.name}"? This cannot be undone.`)) return

    try {
      const res = await fetch(`/api/job-states/${state.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        setDeleteError(data.error || "Failed to delete")
        return
      }
      fetchStates()
    } catch {
      setDeleteError("Failed to delete job state")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Job States Pipeline</h2>
            <p className="text-sm text-muted-foreground">
              Configure the workflow states that repair orders move through
            </p>
          </div>
          <Button onClick={handleAdd} size="sm" className="gap-2">
            <Plus size={16} />
            Add State
          </Button>
        </div>

        {/* Pipeline Preview */}
        <div className="mb-6 p-4 rounded-lg bg-muted/30 border border-border/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Pipeline Preview</p>
          <PipelinePreview states={states} />
        </div>

        {/* Sortable list */}
        <div className="space-y-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={states.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {states.map((state) => (
                <SortableStateItem
                  key={state.id}
                  state={state}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {deleteError && (
          <p className="text-sm text-destructive mt-3">{deleteError}</p>
        )}
      </Card>

      <JobStateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingState={editingState}
        onSave={fetchStates}
      />
    </div>
  )
}
