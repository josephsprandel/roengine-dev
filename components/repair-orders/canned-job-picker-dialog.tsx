"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, ClipboardCheck } from "lucide-react"
import { toast } from "sonner"
import type { CannedJob } from "@/lib/canned-jobs"

interface CannedJobPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderId: number
  onApplied: () => void
}

export function CannedJobPickerDialog({
  open,
  onOpenChange,
  workOrderId,
  onApplied,
}: CannedJobPickerDialogProps) {
  const [jobs, setJobs] = useState<CannedJob[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setSearch("")
    setLoading(true)
    fetch("/api/canned-jobs")
      .then((r) => r.json())
      .then((d) => setJobs(d.canned_jobs || []))
      .catch((err) => console.error("Error fetching canned jobs:", err))
      .finally(() => setLoading(false))
  }, [open])

  const filtered = jobs.filter(
    (j) =>
      j.name.toLowerCase().includes(search.toLowerCase()) ||
      (j.category_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (j.description || "").toLowerCase().includes(search.toLowerCase())
  )

  const handleApply = async (jobId: number) => {
    setApplying(jobId)
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}/apply-canned-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canned_job_id: jobId }),
      })
      if (res.ok) {
        onOpenChange(false)
        onApplied()
      } else {
        const data = await res.json()
        toast.error('Failed to apply canned job')
        console.error("Failed to apply canned job:", data.error)
      }
    } catch (err) {
      toast.error('Failed to apply canned job')
      console.error("Error applying canned job:", err)
    } finally {
      setApplying(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[70vh]">
        <DialogHeader>
          <DialogTitle>Add Canned Job</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Search canned jobs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
          autoFocus
        />

        <div className="space-y-1 overflow-y-auto max-h-[50vh]">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-muted-foreground" size={24} />
            </div>
          )}

          {!loading &&
            filtered.map((job) => (
              <button
                key={job.id}
                className="w-full text-left p-3 rounded-lg hover:bg-muted border border-transparent hover:border-border transition-colors disabled:opacity-50"
                onClick={() => handleApply(job.id)}
                disabled={applying !== null}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground">{job.name}</span>
                  <div className="flex gap-1.5">
                    {job.is_inspection && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
                        <ClipboardCheck size={10} />
                        Inspection
                      </Badge>
                    )}
                    {job.category_name && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {job.category_name}
                      </Badge>
                    )}
                  </div>
                </div>
                {job.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {job.description}
                  </p>
                )}
                {applying === job.id && (
                  <div className="mt-1">
                    <Loader2 size={14} className="animate-spin text-muted-foreground" />
                  </div>
                )}
              </button>
            ))}

          {!loading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No canned jobs found
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
