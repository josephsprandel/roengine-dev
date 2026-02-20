"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ArrowRightLeft } from "lucide-react"
import { JobStateBadge } from "./JobStateBadge"
import type { JobStateTransition } from "@/lib/job-states"

interface User {
  id: number
  name: string
}

interface TransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderId: number
  currentStateId: number | null
  onTransferComplete: () => void
}

export function TransferDialog({
  open,
  onOpenChange,
  workOrderId,
  currentStateId,
  onTransferComplete,
}: TransferDialogProps) {
  const [users, setUsers] = useState<User[]>([])
  const [transitions, setTransitions] = useState<JobStateTransition[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [selectedStateId, setSelectedStateId] = useState<string>("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    // Fetch users and transitions in parallel
    const fetchData = async () => {
      try {
        const [usersRes, transitionsRes] = await Promise.all([
          fetch("/api/settings/users"),
          fetch(`/api/job-states/transitions${currentStateId ? `?from_state_id=${currentStateId}` : ""}`),
        ])

        if (usersRes.ok) {
          const data = await usersRes.json()
          setUsers((data.users || []).filter((u: any) => u.is_active))
        }

        if (transitionsRes.ok) {
          const data = await transitionsRes.json()
          setTransitions(data.transitions || [])
        }
      } catch (err) {
        console.error("Error fetching transfer data:", err)
      }
    }

    fetchData()
    // Reset form
    setSelectedUserId("")
    setSelectedStateId("")
    setNote("")
    setError(null)
  }, [open, currentStateId])

  const handleSubmit = async () => {
    if (!selectedUserId || !selectedStateId) {
      setError("Please select a user and a state")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/work-orders/${workOrderId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_user_id: parseInt(selectedUserId),
          to_state_id: parseInt(selectedStateId),
          note: note.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Transfer failed")
        return
      }

      onOpenChange(false)
      onTransferComplete()
    } catch (err) {
      setError("Failed to create transfer")
    } finally {
      setLoading(false)
    }
  }

  const selectedTransition = transitions.find(
    (t) => t.to_state_id.toString() === selectedStateId
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft size={18} />
            Transfer Work Order
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Assign To</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>New Job State</Label>
            <Select value={selectedStateId} onValueChange={setSelectedStateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select new state" />
              </SelectTrigger>
              <SelectContent>
                {transitions.map((t) => (
                  <SelectItem key={t.to_state_id} value={t.to_state_id.toString()}>
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: t.to_state_color }}
                      />
                      {t.to_state_name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTransition && (
              <div className="mt-1">
                <JobStateBadge
                  name={selectedTransition.to_state_name}
                  color={selectedTransition.to_state_color}
                  icon={selectedTransition.to_state_icon}
                  size="sm"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this transfer..."
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-transparent">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !selectedUserId || !selectedStateId}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
