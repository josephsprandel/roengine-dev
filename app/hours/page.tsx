"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Clock, Play, Stop, Pencil, Trash, Download, Warning, CheckCircle, Plus, X } from "@phosphor-icons/react"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }
}

// -- Types --
interface TimeEntry {
  id: number
  user_id: number
  employee_name: string
  clock_in: string
  clock_out: string | null
  notes: string | null
  acknowledged_by: number | null
  acknowledged_at: string | null
  created_by: number | null
  anomaly: string | null
}

interface Employee {
  id: number
  full_name: string
}

const ANOMALY_LABELS: Record<string, string> = {
  LONG_SHIFT: "Shift exceeds 12 hours",
  SHORT_SHIFT: "Shift under 15 minutes",
  MISSING_CLOCKOUT: "Missing clock-out",
  OVERLAP: "Overlaps previous entry",
}

// -- Helpers --
function getWeekRange(date: Date): { start: string; end: string } {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  const start = new Date(d)
  start.setDate(diff)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function fmtDatetime(iso: string): string {
  return `${fmtDate(iso)} ${fmtTime(iso)}`
}

function calcHours(clockIn: string, clockOut: string | null): number {
  if (!clockOut) return 0
  return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60)
}

function fmtHours(h: number): string {
  return h.toFixed(2)
}

function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function csvExport(entries: TimeEntry[], filename: string) {
  const rows = entries.map(e => ({
    Employee: e.employee_name,
    Date: fmtDate(e.clock_in),
    "Clock In": fmtTime(e.clock_in),
    "Clock Out": e.clock_out ? fmtTime(e.clock_out) : "",
    Hours: fmtHours(calcHours(e.clock_in, e.clock_out)),
    Notes: e.notes || "",
    Anomaly: e.anomaly ? ANOMALY_LABELS[e.anomaly] || e.anomaly : "",
    Acknowledged: e.acknowledged_at ? "Yes" : "",
  }))
  const headers = Object.keys(rows[0] || {})
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify((r as any)[h] ?? "")).join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// -- Page --
export default function HoursPage() {
  return (
    <Suspense fallback={<div className="flex h-screen bg-background items-center justify-center text-muted-foreground">Loading...</div>}>
      <HoursContent />
    </Suspense>
  )
}

function HoursContent() {
  const { user, hasRole } = useAuth()
  const searchParams = useSearchParams()
  const isAdmin = hasRole("Owner") || hasRole("Manager")
  const adminView = isAdmin && searchParams.get("view") === "admin"

  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedUser, setSelectedUser] = useState<string>(() => adminView ? "all" : "")
  const [dateRange, setDateRange] = useState(() => getWeekRange(new Date()))
  const [clockedIn, setClockedIn] = useState(false)
  const [openEntry, setOpenEntry] = useState<TimeEntry | null>(null)
  const [elapsed, setElapsed] = useState("")
  const [clockLoading, setClockLoading] = useState(false)

  // Admin inline edit
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editClockIn, setEditClockIn] = useState("")
  const [editClockOut, setEditClockOut] = useState("")
  const [editNotes, setEditNotes] = useState("")

  // Missed punch modal
  const [missedPunchOpen, setMissedPunchOpen] = useState(false)
  const [mpUserId, setMpUserId] = useState("")
  const [mpDate, setMpDate] = useState("")
  const [mpClockIn, setMpClockIn] = useState("")
  const [mpClockOut, setMpClockOut] = useState("")
  const [mpNotes, setMpNotes] = useState("")
  const [mpSaving, setMpSaving] = useState(false)

  // Delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null)

  // Fetch clock status independently (not tied to date range)
  const fetchClockStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/timeclock/status", { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        const isIn = data.status === "clocked_in"
        setClockedIn(isIn)
        if (isIn && data.lastEvent) {
          setOpenEntry({ id: data.entryId || 0, user_id: user?.id || 0, employee_name: "", clock_in: data.lastEvent, clock_out: null, notes: null, acknowledged_by: null, acknowledged_at: null, created_by: null, anomaly: null })
        } else {
          setOpenEntry(null)
        }
      }
    } catch { /* non-critical */ }
  }, [user?.id])

  // Use a ref so the event listener can call fetchEntries without a dep cycle
  const fetchEntriesRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (user) fetchClockStatus()
    const handleClockEvent = () => { fetchClockStatus(); fetchEntriesRef.current() }
    window.addEventListener("clock-status-changed", handleClockEvent)
    return () => window.removeEventListener("clock-status-changed", handleClockEvent)
  }, [user, fetchClockStatus])

  // Fetch employees for admin dropdown
  useEffect(() => {
    if (!isAdmin) return
    fetch("/api/settings/users")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.users) {
          setEmployees(data.users.filter((u: any) => u.is_active).map((u: any) => ({
            id: u.id,
            full_name: u.name || u.full_name,
          })))
        }
      })
      .catch(() => {})
  }, [isAdmin])

  // Fetch time entries
  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end,
      })
      if (isAdmin && selectedUser) {
        params.set("user_id", selectedUser)
      }
      const res = await fetch(`/api/hours?${params}`, { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to load hours")
      const data = await res.json()
      setEntries(data.entries)
    } catch {
      toast.error("Failed to load time entries")
    } finally {
      setLoading(false)
    }
  }, [dateRange, selectedUser, isAdmin, user?.id])

  fetchEntriesRef.current = fetchEntries
  useEffect(() => { fetchEntries() }, [fetchEntries])

  // Elapsed time ticker
  useEffect(() => {
    if (!openEntry) { setElapsed(""); return }
    const tick = () => {
      const ms = Date.now() - new Date(openEntry.clock_in).getTime()
      const h = Math.floor(ms / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      setElapsed(`${h}h ${m}m`)
    }
    tick()
    const interval = setInterval(tick, 60000)
    return () => clearInterval(interval)
  }, [openEntry])

  // Clock in/out handlers
  async function handleClockIn() {
    setClockLoading(true)
    try {
      const res = await fetch("/api/hours/clock-in", { method: "POST", headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Clocked in")
      fetchClockStatus()
      fetchEntries()
      window.dispatchEvent(new Event("clock-status-changed"))
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setClockLoading(false)
    }
  }

  async function handleClockOut() {
    setClockLoading(true)
    try {
      const res = await fetch("/api/hours/clock-out", { method: "POST", headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Clocked out")
      fetchClockStatus()
      fetchEntries()
      window.dispatchEvent(new Event("clock-status-changed"))
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setClockLoading(false)
    }
  }

  // Admin: inline edit
  function startEdit(entry: TimeEntry) {
    setEditingId(entry.id)
    setEditClockIn(toLocalDatetimeInput(entry.clock_in))
    setEditClockOut(entry.clock_out ? toLocalDatetimeInput(entry.clock_out) : "")
    setEditNotes(entry.notes || "")
  }

  async function saveEdit() {
    if (!editingId) return
    try {
      const res = await fetch(`/api/hours/${editingId}`, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          clock_in: new Date(editClockIn).toISOString(),
          clock_out: editClockOut ? new Date(editClockOut).toISOString() : null,
          notes: editNotes,
        }),
      })
      if (!res.ok) throw new Error("Failed to save")
      toast.success("Entry updated")
      setEditingId(null)
      fetchEntries()
    } catch {
      toast.error("Failed to save entry")
    }
  }

  // Admin: acknowledge anomaly
  async function handleAcknowledge(id: number) {
    try {
      const res = await fetch(`/api/hours/${id}`, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ acknowledge: true }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("Anomaly acknowledged")
      fetchEntries()
    } catch {
      toast.error("Failed to acknowledge")
    }
  }

  // Admin: delete entry
  async function handleDelete() {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/hours/${deleteId}`, { method: "DELETE", headers: authHeaders() })
      if (!res.ok) throw new Error("Failed")
      toast.success("Entry deleted")
      setDeleteId(null)
      fetchEntries()
    } catch {
      toast.error("Failed to delete")
    }
  }

  // Admin: add missed punch
  async function handleMissedPunch() {
    if (!mpUserId || !mpDate || !mpClockIn) {
      toast.error("Employee, date, and clock-in time are required")
      return
    }
    setMpSaving(true)
    try {
      const clockIn = new Date(`${mpDate}T${mpClockIn}`).toISOString()
      const clockOut = mpClockOut ? new Date(`${mpDate}T${mpClockOut}`).toISOString() : null
      const res = await fetch("/api/hours", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          user_id: parseInt(mpUserId),
          clock_in: clockIn,
          clock_out: clockOut,
          notes: mpNotes || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      toast.success("Missed punch added")
      setMissedPunchOpen(false)
      setMpUserId("")
      setMpDate("")
      setMpClockIn("")
      setMpClockOut("")
      setMpNotes("")
      fetchEntries()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setMpSaving(false)
    }
  }

  // Week navigation
  function shiftWeek(delta: number) {
    const start = new Date(dateRange.start + "T00:00:00")
    start.setDate(start.getDate() + delta * 7)
    setDateRange(getWeekRange(start))
  }

  // Summary
  const totalHours = entries.reduce((sum, e) => sum + calcHours(e.clock_in, e.clock_out), 0)
  const daysWorked = new Set(entries.filter(e => e.clock_out).map(e => new Date(e.clock_in).toDateString())).size
  const anomalyCount = entries.filter(e => e.anomaly && !e.acknowledged_at).length

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <Header />
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-2xl font-bold text-foreground">{adminView ? "Hours Manager" : "My Hours"}</h1>
              <div className="flex items-center gap-3">
                {/* Clock in/out button */}
                {clockedIn ? (
                  <Button
                    onClick={handleClockOut}
                    disabled={clockLoading}
                    className="bg-red-600 hover:bg-red-700 text-white gap-2"
                  >
                    <Stop size={16} weight="fill" />
                    Clock Out {elapsed && `(${elapsed})`}
                  </Button>
                ) : (
                  <Button
                    onClick={handleClockIn}
                    disabled={clockLoading}
                    className="bg-green-600 hover:bg-green-700 text-white gap-2"
                  >
                    <Play size={16} weight="fill" />
                    Clock In
                  </Button>
                )}
              </div>
            </div>

            {/* Filters */}
            <Card className="p-4 border-border">
              <div className="flex flex-wrap items-center gap-4">
                {isAdmin && (
                  <div className="w-48">
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger className="bg-card border-border">
                        <SelectValue placeholder="All Employees" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Employees</SelectItem>
                        {employees.map(e => (
                          <SelectItem key={e.id} value={String(e.id)}>{e.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="bg-transparent" onClick={() => shiftWeek(-1)}>
                    &larr;
                  </Button>
                  <span className="text-sm font-medium text-foreground min-w-[180px] text-center">
                    {fmtDate(dateRange.start)} — {fmtDate(dateRange.end)}
                  </span>
                  <Button variant="outline" size="sm" className="bg-transparent" onClick={() => shiftWeek(1)}>
                    &rarr;
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-transparent text-xs"
                    onClick={() => {
                      const now = new Date()
                      const prev = new Date(now)
                      prev.setDate(now.getDate() - 7)
                      setDateRange(getWeekRange(prev))
                    }}
                  >
                    Last Week
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-transparent text-xs"
                    onClick={() => setDateRange(getWeekRange(new Date()))}
                  >
                    This Week
                  </Button>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 bg-transparent"
                      onClick={() => setMissedPunchOpen(true)}
                    >
                      <Plus size={14} /> Add Missed Punch
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => csvExport(entries, `hours-${dateRange.start}-${dateRange.end}.csv`)}
                    title="Export CSV"
                  >
                    <Download size={14} />
                  </Button>
                </div>
              </div>
            </Card>

            {/* Summary strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-slate-50 dark:bg-slate-900/50 border-border shadow-sm p-4">
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold text-foreground">{fmtHours(totalHours)}</p>
              </Card>
              <Card className="bg-slate-50 dark:bg-slate-900/50 border-border shadow-sm p-4">
                <p className="text-sm text-muted-foreground">Days Worked</p>
                <p className="text-2xl font-bold text-foreground">{daysWorked}</p>
              </Card>
              <Card className="bg-slate-50 dark:bg-slate-900/50 border-border shadow-sm p-4">
                <p className="text-sm text-muted-foreground">Entries</p>
                <p className="text-2xl font-bold text-foreground">{entries.length}</p>
              </Card>
              <Card className={`border-border shadow-sm p-4 ${anomalyCount > 0 ? "bg-amber-50 dark:bg-amber-950/30" : "bg-slate-50 dark:bg-slate-900/50"}`}>
                <p className="text-sm text-muted-foreground">Anomalies</p>
                <p className={`text-2xl font-bold ${anomalyCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                  {anomalyCount}
                </p>
              </Card>
            </div>

            {/* Timesheet table */}
            <Card className="border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {isAdmin && <th className="text-left py-3 px-4 font-medium text-muted-foreground">Employee</th>}
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Clock In</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Clock Out</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Hours</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Notes</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                      {isAdmin && <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={isAdmin ? 8 : 6} className="py-12 text-center text-muted-foreground">
                          Loading...
                        </td>
                      </tr>
                    ) : entries.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 8 : 6} className="py-12 text-center text-muted-foreground">
                          No entries for this period.
                        </td>
                      </tr>
                    ) : entries.map(entry => {
                      const hours = calcHours(entry.clock_in, entry.clock_out)
                      const isEditing = editingId === entry.id
                      const hasAnomaly = entry.anomaly && !entry.acknowledged_at

                      return (
                        <tr
                          key={entry.id}
                          className={`border-b border-border/50 group ${
                            hasAnomaly ? "bg-amber-50/50 dark:bg-amber-950/20" : ""
                          }`}
                        >
                          {isAdmin && (
                            <td className="py-2.5 px-4 text-foreground font-medium">
                              {entry.employee_name}
                            </td>
                          )}
                          <td className="py-2.5 px-4 text-foreground">
                            {fmtDate(entry.clock_in)}
                          </td>
                          <td className="py-2.5 px-4 text-foreground">
                            {isEditing ? (
                              <Input
                                type="datetime-local"
                                value={editClockIn}
                                onChange={e => setEditClockIn(e.target.value)}
                                className="w-44 h-8 text-sm bg-card border-border"
                              />
                            ) : fmtTime(entry.clock_in)}
                          </td>
                          <td className="py-2.5 px-4 text-foreground">
                            {isEditing ? (
                              <Input
                                type="datetime-local"
                                value={editClockOut}
                                onChange={e => setEditClockOut(e.target.value)}
                                className="w-44 h-8 text-sm bg-card border-border"
                              />
                            ) : entry.clock_out ? fmtTime(entry.clock_out) : (
                              <span className="text-muted-foreground italic">Active</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-foreground">
                            {entry.clock_out ? fmtHours(hours) : "—"}
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground max-w-[200px] truncate">
                            {isEditing ? (
                              <Input
                                value={editNotes}
                                onChange={e => setEditNotes(e.target.value)}
                                className="h-8 text-sm bg-card border-border"
                                placeholder="Notes"
                              />
                            ) : (entry.notes || "—")}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {entry.anomaly ? (
                              <div className="inline-flex items-center gap-1">
                                {entry.acknowledged_at ? (
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                    <CheckCircle size={12} weight="fill" /> Ack
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 cursor-default"
                                    title={ANOMALY_LABELS[entry.anomaly] || entry.anomaly}
                                  >
                                    <Warning size={12} weight="fill" />
                                    {entry.anomaly.replace("_", " ")}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                <CheckCircle size={12} /> OK
                              </span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-2.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {isEditing ? (
                                  <>
                                    <Button size="sm" className="h-7 text-xs" onClick={saveEdit}>
                                      Save
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    {entry.anomaly && !entry.acknowledged_at && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700"
                                        onClick={() => handleAcknowledge(entry.id)}
                                        title="Acknowledge anomaly"
                                      >
                                        <CheckCircle size={14} />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => startEdit(entry)}
                                      title="Edit"
                                    >
                                      <Pencil size={14} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => setDeleteId(entry.id)}
                                      title="Delete"
                                    >
                                      <Trash size={14} />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  {entries.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-border bg-muted/20">
                        {isAdmin && <td className="py-3 px-4" />}
                        <td className="py-3 px-4 font-medium text-foreground" colSpan={3}>
                          Weekly Total
                        </td>
                        <td className="py-3 px-4 text-right font-bold font-mono text-foreground">
                          {fmtHours(totalHours)}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-sm">
                          {daysWorked} day{daysWorked !== 1 ? "s" : ""} worked
                        </td>
                        <td className="py-3 px-4" />
                        {isAdmin && <td className="py-3 px-4" />}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>

            {/* Non-admin anomaly note */}
            {!isAdmin && anomalyCount > 0 && (
              <Card className="p-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
                  <Warning size={16} weight="fill" />
                  {anomalyCount} anomal{anomalyCount === 1 ? "y" : "ies"} detected. Contact an admin to correct.
                </div>
              </Card>
            )}
          </div>
        </main>
      </div>

      {/* Missed Punch Modal */}
      <Dialog open={missedPunchOpen} onOpenChange={setMissedPunchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Missed Punch</DialogTitle>
            <DialogDescription>Create a time entry for a missed clock-in/out.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Employee</Label>
              <Select value={mpUserId} onValueChange={setMpUserId}>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Date</Label>
              <Input type="date" value={mpDate} onChange={e => setMpDate(e.target.value)} className="bg-card border-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Clock In</Label>
                <Input type="time" value={mpClockIn} onChange={e => setMpClockIn(e.target.value)} className="bg-card border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Clock Out</Label>
                <Input type="time" value={mpClockOut} onChange={e => setMpClockOut(e.target.value)} className="bg-card border-border" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Notes</Label>
              <Input value={mpNotes} onChange={e => setMpNotes(e.target.value)} placeholder="Reason for missed punch" className="bg-card border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="bg-transparent" onClick={() => setMissedPunchOpen(false)}>Cancel</Button>
            <Button onClick={handleMissedPunch} disabled={mpSaving}>
              {mpSaving ? "Saving..." : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Time Entry?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="bg-transparent" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
