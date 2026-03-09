"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, CalendarOff, Plus, Trash2, Repeat } from "lucide-react"
import { toast } from "sonner"

interface BlockTime {
  id: number
  block_date: string | null
  start_time: string | null
  end_time: string | null
  bay_assignment: string | null
  reason: string | null
  is_recurring: boolean
  day_of_week: string | null
  recurring_start_time: string | null
  recurring_end_time: string | null
  is_closed_all_day: boolean
  created_by_name: string | null
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" }
}

export function BlockTimesSection() {
  const [loading, setLoading] = useState(true)
  const [blocks, setBlocks] = useState<BlockTime[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)

  // New block form state
  const [isRecurring, setIsRecurring] = useState(false)
  const [blockDate, setBlockDate] = useState("")
  const [dayOfWeek, setDayOfWeek] = useState("Monday")
  const [isAllDay, setIsAllDay] = useState(true)
  const [startTime, setStartTime] = useState("07:00")
  const [endTime, setEndTime] = useState("18:00")
  const [reason, setReason] = useState("")
  const [creating, setCreating] = useState(false)

  const fetchBlocks = () => {
    fetch("/api/scheduling/block-times")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.blocks) setBlocks(data.blocks)
      })
      .catch(() => toast.error("Failed to load block times"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchBlocks() }, [])

  const handleCreate = async () => {
    if (!reason.trim()) {
      toast.error("Reason is required")
      return
    }
    setCreating(true)
    try {
      const body: any = {
        reason: reason.trim(),
        is_recurring: isRecurring,
        is_closed_all_day: isAllDay,
      }
      if (isRecurring) {
        body.day_of_week = dayOfWeek
        if (!isAllDay) {
          body.recurring_start_time = startTime
          body.recurring_end_time = endTime
        }
      } else {
        body.block_date = blockDate
        if (!isAllDay) {
          body.start_time = startTime
          body.end_time = endTime
        }
      }

      const res = await fetch("/api/scheduling/block-times", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success("Block time created")
        setDialogOpen(false)
        resetForm()
        fetchBlocks()
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to create block time")
      }
    } catch {
      toast.error("Failed to create block time")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/scheduling/block-times/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      })
      if (res.ok) {
        toast.success("Block time deleted")
        setBlocks(prev => prev.filter(b => b.id !== id))
      } else {
        toast.error("Failed to delete block time")
      }
    } catch {
      toast.error("Failed to delete block time")
    }
  }

  const resetForm = () => {
    setIsRecurring(false)
    setBlockDate("")
    setDayOfWeek("Monday")
    setIsAllDay(true)
    setStartTime("07:00")
    setEndTime("18:00")
    setReason("")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin mr-2 text-muted-foreground" size={20} />
        <span className="text-muted-foreground">Loading block times...</span>
      </div>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarOff size={18} className="text-red-500" />
          <h3 className="font-semibold text-foreground">Block Times</h3>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus size={14} className="mr-1" />Add Block
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Block times prevent scheduling during specific dates, times, or recurring weekly windows.
      </p>

      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No block times configured</p>
      ) : (
        <div className="space-y-2">
          {blocks.map(block => (
            <div key={block.id} className="flex items-center justify-between bg-muted/50 rounded-md p-3">
              <div className="flex items-center gap-3">
                {block.is_recurring && (
                  <Badge variant="outline" className="text-xs"><Repeat size={10} className="mr-1" />Recurring</Badge>
                )}
                <div>
                  <span className="text-sm font-medium">
                    {block.is_recurring
                      ? `Every ${block.day_of_week}`
                      : block.block_date}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {block.is_closed_all_day
                      ? "All Day"
                      : block.is_recurring
                        ? `${block.recurring_start_time?.substring(0, 5) || ""} - ${block.recurring_end_time?.substring(0, 5) || ""}`
                        : block.start_time
                          ? `${block.start_time.substring(0, 5)} - ${block.end_time?.substring(0, 5) || ""}`
                          : "All Day"}
                  </span>
                </div>
                {block.reason && (
                  <span className="text-xs text-muted-foreground">— {block.reason}</span>
                )}
              </div>
              <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(block.id)}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Block Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Block Time</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Label className="text-sm">Recurring</Label>
              <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
            </div>

            {isRecurring ? (
              <div>
                <Label className="text-sm">Day of Week</Label>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label className="text-sm">Date</Label>
                <Input type="date" value={blockDate} onChange={e => setBlockDate(e.target.value)} />
              </div>
            )}

            <div className="flex items-center gap-3">
              <Label className="text-sm">All Day</Label>
              <Switch checked={isAllDay} onCheckedChange={setIsAllDay} />
            </div>

            {!isAllDay && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Start Time</Label>
                  <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">End Time</Label>
                  <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm">Reason <span className="text-red-500">*</span></Label>
              <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., Holiday, Staff meeting, Training..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !reason.trim()}>
              {creating ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
              Create Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
