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
import { GripVertical, Plus, Pencil, Trash2, Loader2, ClipboardCheck, Zap, FileText } from "lucide-react"
import { toast } from "sonner"
import type { CannedJob } from "@/lib/canned-jobs"
import { CannedJobFormDialog } from "./canned-job-form-dialog"

function SortableCannedJobItem({
  job,
  onEdit,
  onDelete,
}: {
  job: CannedJob
  onEdit: (job: CannedJob) => void
  onDelete: (job: CannedJob) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: job.id,
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
      className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg group"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical size={16} />
      </button>

      <span className="font-medium text-sm text-foreground flex-1">{job.name}</span>

      <div className="flex items-center gap-1.5">
        {job.category_name && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {job.category_name}
          </Badge>
        )}
        {job.default_labor_hours && parseFloat(String(job.default_labor_hours)) > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {job.default_labor_hours} hrs
          </Badge>
        )}
        {job.is_inspection && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
            <ClipboardCheck size={10} />
            Inspection
          </Badge>
        )}
        {job.auto_add_to_all_ros && (
          <Badge variant="default" className="text-[10px] px-1.5 py-0 gap-0.5">
            <Zap size={10} />
            Auto-add
          </Badge>
        )}
        {job.show_in_wizard && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
            <FileText size={10} />
            Wizard
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onEdit(job)}
        >
          <Pencil size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(job)}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  )
}

export function CannedJobsSettings() {
  const [cannedJobs, setCannedJobs] = useState<CannedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<CannedJob | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/canned-jobs")
      if (res.ok) {
        const data = await res.json()
        setCannedJobs(data.canned_jobs || [])
      }
    } catch (err) {
      console.error("Error fetching canned jobs:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = cannedJobs.findIndex((j) => j.id === active.id)
    const newIndex = cannedJobs.findIndex((j) => j.id === over.id)
    const reordered = arrayMove(cannedJobs, oldIndex, newIndex)
    setCannedJobs(reordered)

    try {
      await fetch("/api/canned-jobs/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: reordered.map((j) => j.id) }),
      })
    } catch (err) {
      console.error("Error reordering:", err)
      toast.error('Failed to reorder canned jobs')
      fetchJobs()
    }
  }

  const handleEdit = (job: CannedJob) => {
    setEditingJob(job)
    setFormOpen(true)
  }

  const handleAdd = () => {
    setEditingJob(null)
    setFormOpen(true)
  }

  const handleDelete = async (job: CannedJob) => {
    setDeleteError(null)
    if (!window.confirm(`Delete "${job.name}"? This cannot be undone.`)) return

    try {
      const res = await fetch(`/api/canned-jobs/${job.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        setDeleteError(data.error || "Failed to delete")
        return
      }
      fetchJobs()
    } catch {
      setDeleteError("Failed to delete canned job")
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
            <h2 className="text-lg font-semibold text-foreground">Canned Jobs</h2>
            <p className="text-sm text-muted-foreground">
              Reusable service templates that can be quickly added to any repair order
            </p>
          </div>
          <Button onClick={handleAdd} size="sm" className="gap-2">
            <Plus size={16} />
            Add Canned Job
          </Button>
        </div>

        <div className="space-y-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={cannedJobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
              {cannedJobs.map((job) => (
                <SortableCannedJobItem
                  key={job.id}
                  job={job}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </SortableContext>
          </DndContext>

          {cannedJobs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No canned jobs yet. Add one to get started.
            </p>
          )}
        </div>

        {deleteError && (
          <p className="text-sm text-destructive mt-3">{deleteError}</p>
        )}
      </Card>

      <CannedJobFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingJob={editingJob}
        onSave={fetchJobs}
      />
    </div>
  )
}
