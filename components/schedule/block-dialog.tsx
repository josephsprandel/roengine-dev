"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

export interface BlockDialogDefaults {
  date: string
  startTime?: string
  endTime?: string
  bay?: string
}

interface BlockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaults: BlockDialogDefaults | null
  onCreate: (block: {
    block_date: string
    start_time: string | null
    end_time: string | null
    bay_assignment: string | null
    reason: string | null
  }) => void
}

export function BlockDialog({ open, onOpenChange, defaults, onCreate }: BlockDialogProps) {
  const [date, setDate] = useState("")
  const [allDay, setAllDay] = useState(true)
  const [startTime, setStartTime] = useState("07:00")
  const [endTime, setEndTime] = useState("18:00")
  const [bay, setBay] = useState("all")
  const [reason, setReason] = useState("")

  // Reset form when defaults change
  useEffect(() => {
    if (defaults) {
      setDate(defaults.date)
      setAllDay(!defaults.startTime)
      setStartTime(defaults.startTime || "07:00")
      setEndTime(defaults.endTime || "18:00")
      setBay(defaults.bay || "all")
      setReason("")
    }
  }, [defaults])

  const handleSubmit = () => {
    onCreate({
      block_date: date,
      start_time: allDay ? null : `${startTime}:00`,
      end_time: allDay ? null : `${endTime}:00`,
      bay_assignment: bay === "all" ? null : bay,
      reason: reason.trim() || null,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Block Time</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="block-date">Date</Label>
            <Input
              id="block-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* All Day toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="all-day">All Day</Label>
            <Switch
              id="all-day"
              checked={allDay}
              onCheckedChange={setAllDay}
            />
          </div>

          {/* Time range (only when not all day) */}
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="block-start">Start</Label>
                <Input
                  id="block-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="block-end">End</Label>
                <Input
                  id="block-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Bay selection */}
          <div className="space-y-1.5">
            <Label>Bay</Label>
            <Select value={bay} onValueChange={setBay}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bays</SelectItem>
                <SelectItem value="1">Bay 1</SelectItem>
                <SelectItem value="2">Bay 2</SelectItem>
                <SelectItem value="3">Bay 3</SelectItem>
                <SelectItem value="4">Bay 4</SelectItem>
                <SelectItem value="5">Bay 5</SelectItem>
                <SelectItem value="6">Bay 6</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="block-reason">Reason (optional)</Label>
            <Input
              id="block-reason"
              placeholder="e.g. Staff meeting, Lunch break"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={!date}>
            Block Time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
