"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ClipboardList, Loader2, ArrowRight, ArrowLeft, SkipForward, AlertTriangle, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface CannedJob {
  id: number
  name: string
  category: string | null
  estimated_hours: number | null
  auto_add_to_all_ros: boolean
  is_active: boolean
}

interface StepProps {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  laborRatesSkipped: boolean
}

export function StepCannedJobs({ onNext, onBack, onSkip, laborRatesSkipped }: StepProps) {
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<CannedJob[]>([])
  const [deleting, setDeleting] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('auth_token')
        const res = await fetch('/api/canned-jobs', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (res.ok) {
          const data = await res.json()
          setJobs(data.canned_jobs || [])
        }
      } catch {
        // Empty
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleDelete(id: number) {
    setDeleting(id)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`/api/canned-jobs/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        setJobs(jobs.filter(j => j.id !== id))
        toast.success('Canned job removed')
      } else {
        toast.error('Failed to remove canned job')
      }
    } catch {
      toast.error('Failed to remove canned job')
    } finally {
      setDeleting(null)
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
          <ClipboardList size={28} className="text-blue-500" />
          Canned Jobs
        </h2>
        <p className="text-muted-foreground mt-1">
          Review pre-configured service templates. These can be quickly added to repair orders.
          You can add more in Settings later.
        </p>
      </div>

      {laborRatesSkipped && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            You skipped labor rates. Canned jobs will use the default rate ($160/hr) until you configure rates in Settings.
          </p>
        </div>
      )}

      <Card className="p-6 border-border">
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No canned jobs configured yet.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{job.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {job.category && (
                      <span className="text-xs text-muted-foreground">{job.category}</span>
                    )}
                    {job.estimated_hours && (
                      <span className="text-xs text-muted-foreground">{job.estimated_hours}h</span>
                    )}
                    {job.auto_add_to_all_ros && (
                      <Badge variant="secondary" className="text-[10px] h-4">Auto-add</Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(job.id)}
                  disabled={deleting === job.id}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  {deleting === job.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
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
          <Button onClick={onNext}>
            Continue
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
