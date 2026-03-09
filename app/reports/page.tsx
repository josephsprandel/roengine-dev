"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Download, Clock, ArrowsClockwise } from "@phosphor-icons/react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
} from "recharts"

// -- Types --
interface ReportMeta {
  generated_at: string
  row_count: number
  cache_hit: boolean
}

interface Summary {
  total_revenue: number
  ro_count: number
  avg_ticket: number
  labor_total: number
  parts_total: number
  tax_total: number
  amount_collected: number
  collection_rate: number
  parts_labor_ratio: number
  shop_supplies_total: number
}

interface RevenueRow { period: string; revenue: number; ro_count: number }
interface CategoryRow { category: string; amount: number }
interface ServiceRow { description: string; count: number; total_revenue: number; avg_price: number }
interface PaymentRow { method: string; count: number; total: number; percentage: number }
interface RoMetricRow { period: string; ro_count: number; avg_ticket: number }
interface VehicleMakeRow { make: string; ro_count: number; total_revenue: number; avg_ticket: number }
interface BestMonthData { month: string; revenue: number }

// -- Formatters --
function fmtCurrency(n: number, compact = false): string {
  if (compact) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function fmtCurrencyFull(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n)
}

function fmtNumber(n: number): string {
  return n.toLocaleString("en-US")
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function fmtDateForTooltip(iso: string, period: "day" | "week" | "month"): string {
  const d = new Date(iso + "T00:00:00")
  if (period === "day") return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  if (period === "week") return `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function shiftYear(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00")
  d.setFullYear(d.getFullYear() + delta)
  return d.toISOString().split("T")[0]
}

function fmtMonthYear(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function csvExport(rows: any[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// -- Chart colors --
const COLORS = [
  "hsl(217, 91%, 60%)",  // blue
  "hsl(142, 71%, 45%)",  // green
  "hsl(38, 92%, 50%)",   // amber
  "hsl(0, 84%, 60%)",    // red
  "hsl(262, 83%, 58%)",  // purple
  "hsl(187, 85%, 43%)",  // teal
]

// -- Presets --
type PresetKey = "30d" | "90d" | "ytd" | "all"
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "30d", label: "Last 30d" },
  { key: "90d", label: "Last 90d" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "All Time" },
]

function getPresetDates(key: PresetKey): { from: string; to: string } | null {
  const today = new Date()
  const to = today.toISOString().split("T")[0]
  if (key === "all") return null
  if (key === "ytd") {
    return { from: `${today.getFullYear()}-01-01`, to }
  }
  const days = key === "30d" ? 30 : 90
  const from = new Date(today)
  from.setDate(from.getDate() - days)
  return { from: from.toISOString().split("T")[0], to }
}

// -- Skeleton --
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />
}

function CardSkeleton() {
  return (
    <Card className="p-6 border-border">
      <Skeleton className="h-5 w-40 mb-4" />
      <Skeleton className="h-64 w-full" />
    </Card>
  )
}

// -- Custom tooltip --
function ChartTooltip({ active, payload, label, formatter, labelFormatter }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{labelFormatter ? labelFormatter(label) : label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-muted-foreground">
          <span style={{ color: p.color }}>{p.name}: </span>
          <span className="font-medium text-foreground">
            {formatter ? formatter(p.value, p.name) : p.value}
          </span>
        </p>
      ))}
    </div>
  )
}

// -- Hook --
function useReport<T>(report: string, params: Record<string, string>, deps: any[]) {
  const [data, setData] = useState<T | null>(null)
  const [meta, setMeta] = useState<ReportMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchReport = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v))
      const res = await fetch(`/api/reports/${report}?${qs}`, { signal: controller.signal })
      if (!res.ok) throw new Error("Failed to load report")
      const json = await res.json()
      setData(json.data)
      setMeta(json.meta)
    } catch (err: any) {
      if (err.name !== "AbortError") setError(err.message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { fetchReport() }, [fetchReport])

  return { data, meta, loading, error, refetch: fetchReport }
}

// -- Page --
export default function ReportsPage() {
  const [preset, setPreset] = useState<PresetKey>("all")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [revPeriod, setRevPeriod] = useState<"day" | "week" | "month">("month")
  const [metricPeriod, setMetricPeriod] = useState<"day" | "week" | "month">("month")
  const [yoyEnabled, setYoyEnabled] = useState(false)
  const [vehicleMode, setVehicleMode] = useState<"count" | "revenue">("count")

  const dates = preset === "all" ? null : getPresetDates(preset)
  const from = customFrom || dates?.from || ""
  const to = customTo || dates?.to || ""

  function handlePreset(key: PresetKey) {
    setPreset(key)
    setCustomFrom("")
    setCustomTo("")
    if (key === "all") setYoyEnabled(false)
  }

  const baseParams = { from, to }

  const summary = useReport<Summary>("summary", baseParams, [from, to])
  const revenueTime = useReport<RevenueRow[]>("revenue-over-time", { ...baseParams, period: revPeriod }, [from, to, revPeriod])
  const revenueCat = useReport<CategoryRow[]>("revenue-by-category", baseParams, [from, to])
  const topServices = useReport<ServiceRow[]>("top-services", { ...baseParams, limit: "15" }, [from, to])
  const payments = useReport<PaymentRow[]>("payment-methods", baseParams, [from, to])
  const roMetrics = useReport<RoMetricRow[]>("ro-metrics", { ...baseParams, period: metricPeriod }, [from, to, metricPeriod])
  const vehiclesMake = useReport<VehicleMakeRow[]>("vehicles-by-make", { ...baseParams, limit: "15" }, [from, to])
  const bestMonthAll = useReport<BestMonthData | null>("best-month", {}, [])
  const bestMonthPeriod = useReport<BestMonthData | null>("best-month", baseParams, [from, to])

  // YoY: shift date range back 1 year
  const yoyFrom = from ? shiftYear(from, -1) : ""
  const yoyTo = to ? shiftYear(to, -1) : ""
  const yoyData = useReport<RevenueRow[]>(
    "revenue-over-time",
    { from: yoyEnabled ? yoyFrom : "", to: yoyEnabled ? yoyTo : "", period: revPeriod },
    [yoyEnabled ? yoyFrom : "__disabled__", yoyEnabled ? yoyTo : "__disabled__", revPeriod, yoyEnabled]
  )

  // Use summary meta for cache age display
  const cacheAge = summary.meta?.generated_at
    ? `${summary.meta.cache_hit ? "Cached" : "Fresh"} ${new Date(summary.meta.generated_at).toLocaleTimeString()}`
    : null

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <Header />
        <main className="flex-1 overflow-y-auto min-h-0">
    <div className="p-6 space-y-6">
      {/* Filter Bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 -mx-6 px-6 py-4 border-b border-border">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground mr-2">Reports</h1>
          <div className="flex gap-1.5">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                variant={preset === p.key && !customFrom ? "default" : "outline"}
                size="sm"
                className={preset === p.key && !customFrom ? "" : "bg-transparent"}
                onClick={() => handlePreset(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => { setCustomFrom(e.target.value); setPreset("all") }}
              className="w-36 h-8 text-sm bg-card border-border"
              placeholder="From"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => { setCustomTo(e.target.value); setPreset("all") }}
              className="w-36 h-8 text-sm bg-card border-border"
              placeholder="To"
            />
          </div>
          {cacheAge && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock size={12} />
              {cacheAge}
            </div>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      {summary.loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} className="p-5 border-border">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </Card>
          ))}
        </div>
      ) : summary.data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <KpiCard label="Total Revenue" value={fmtCurrency(summary.data.total_revenue, true)} />
          <KpiCard label="RO Count" value={fmtNumber(summary.data.ro_count)} />
          <KpiCard label="Avg Ticket" value={fmtCurrency(summary.data.avg_ticket)} />
          <KpiCard label="Parts/Labor Ratio" value={`${summary.data.parts_labor_ratio.toFixed(2)}x`} />
          <KpiCard label="Collection Rate" value={`${summary.data.collection_rate}%`} />
          <KpiCard
            label={bestMonthAll.data ? `Best Month Ever` : "Best Month"}
            value={bestMonthAll.data ? fmtCurrency(bestMonthAll.data.revenue, true) : "—"}
            subtitle={bestMonthAll.data ? fmtMonthYear(bestMonthAll.data.month) : undefined}
          />
          <KpiCard
            label="Best Month (Period)"
            value={bestMonthPeriod.data ? fmtCurrency(bestMonthPeriod.data.revenue, true) : "—"}
            subtitle={bestMonthPeriod.data ? fmtMonthYear(bestMonthPeriod.data.month) : undefined}
          />
        </div>
      ) : null}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Over Time */}
        <Card className="p-6 border-border lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Revenue Over Time</h3>
            <div className="flex items-center gap-2">
              <PeriodToggle value={revPeriod} onChange={setRevPeriod} />
              <Button
                variant={yoyEnabled ? "default" : "outline"}
                size="sm"
                className={`text-xs h-7 px-2.5 ${yoyEnabled ? "" : "bg-transparent"}`}
                onClick={() => setYoyEnabled(!yoyEnabled)}
                disabled={!from && !to}
                title={!from && !to ? "Select a date range to compare year-over-year" : "Toggle year-over-year comparison"}
              >
                YoY
              </Button>
              {revenueTime.data && (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => csvExport(revenueTime.data!, "revenue-over-time.csv")}>
                  <Download size={14} />
                </Button>
              )}
            </div>
          </div>
          {revenueTime.loading ? <Skeleton className="h-72 w-full" /> : revenueTime.data?.length ? (() => {
            // Build chart data: merge current + prior year if YoY enabled
            // Derive year labels from the actual data range
            const lastPeriod = revenueTime.data[revenueTime.data.length - 1].period
            const currentYear = new Date(lastPeriod + "T00:00:00").getFullYear()
            const priorYear = currentYear - 1
            const currentLabel = String(currentYear)
            const priorLabel = String(priorYear)

            let chartData: any[]
            if (yoyEnabled && yoyData.data?.length) {
              // Index prior year data by shifting period forward 1 year to align
              const priorMap = new Map<string, number>()
              for (const r of yoyData.data) {
                const shifted = shiftYear(r.period, 1)
                priorMap.set(shifted, r.revenue)
              }
              chartData = revenueTime.data.map(r => ({
                period: r.period,
                [currentLabel]: r.revenue,
                [priorLabel]: priorMap.get(r.period) ?? null,
              }))
            } else {
              chartData = revenueTime.data.map(r => ({
                period: r.period,
                [currentLabel]: r.revenue,
              }))
            }

            return (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="period"
                    tickFormatter={revPeriod === "day" ? fmtDateShort : fmtDate}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    tickFormatter={(v) => fmtCurrency(v, true)}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip content={<ChartTooltip labelFormatter={(l: string) => fmtDateForTooltip(l, revPeriod)} formatter={(v: number) => fmtCurrencyFull(v)} />} />
                  <Legend />
                  <Line type="monotone" dataKey={currentLabel} name={currentLabel} stroke={COLORS[0]} strokeWidth={2} dot={false} />
                  {yoyEnabled && (
                    <Line type="monotone" dataKey={priorLabel} name={priorLabel} stroke={COLORS[2]} strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )
          })() : <EmptyChart />}
        </Card>

        {/* Revenue by Category */}
        <Card className="p-6 border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Revenue by Category</h3>
            {revenueCat.data && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => csvExport(revenueCat.data!, "revenue-by-category.csv")}>
                <Download size={14} />
              </Button>
            )}
          </div>
          {revenueCat.loading ? <Skeleton className="h-64 w-full" /> : revenueCat.data?.length ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={revenueCat.data}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {revenueCat.data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip formatter={(v: number) => fmtCurrencyFull(v)} />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-1.5">
                {revenueCat.data.map((r, i) => (
                  <div key={r.category} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground">{r.category}</span>
                    </div>
                    <span className="font-medium text-foreground">{fmtCurrency(r.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyChart />}
        </Card>

        {/* Payment Methods */}
        <Card className="p-6 border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Payment Methods</h3>
            {payments.data && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => csvExport(payments.data!, "payment-methods.csv")}>
                <Download size={14} />
              </Button>
            )}
          </div>
          {payments.loading ? <Skeleton className="h-64 w-full" /> : payments.data?.length ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={payments.data}
                    dataKey="total"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {payments.data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip formatter={(v: number) => fmtCurrencyFull(v)} />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-1.5">
                {payments.data.map((r, i) => (
                  <div key={r.method} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground capitalize">{r.method}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{r.percentage}%</span>
                      <span className="font-medium text-foreground">{fmtCurrency(r.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyChart />}
        </Card>

        {/* Top Services */}
        <Card className="p-6 border-border lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Top 15 Services by Revenue</h3>
            {topServices.data && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => csvExport(topServices.data!, "top-services.csv")}>
                <Download size={14} />
              </Button>
            )}
          </div>
          {topServices.loading ? <Skeleton className="h-96 w-full" /> : topServices.data?.length ? (
            <>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={topServices.data} layout="vertical" margin={{ left: 160 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => fmtCurrency(v, true)}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="description"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    width={155}
                  />
                  <Tooltip content={<ChartTooltip formatter={(v: number) => fmtCurrencyFull(v)} />} />
                  <Bar dataKey="total_revenue" name="Revenue" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 font-medium">Service</th>
                      <th className="text-right py-2 font-medium">Count</th>
                      <th className="text-right py-2 font-medium">Avg Price</th>
                      <th className="text-right py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topServices.data.map((s) => (
                      <tr key={s.description} className="border-b border-border/50">
                        <td className="py-1.5 text-foreground">{s.description}</td>
                        <td className="py-1.5 text-right text-muted-foreground">{fmtNumber(s.count)}</td>
                        <td className="py-1.5 text-right text-muted-foreground">{fmtCurrencyFull(s.avg_price)}</td>
                        <td className="py-1.5 text-right font-medium text-foreground">{fmtCurrency(s.total_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : <EmptyChart />}
        </Card>

        {/* RO Count vs Avg Ticket */}
        <Card className="p-6 border-border lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">RO Count vs Avg Ticket</h3>
            <div className="flex items-center gap-2">
              <PeriodToggle value={metricPeriod} onChange={setMetricPeriod} />
              {roMetrics.data && (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => csvExport(roMetrics.data!, "ro-metrics.csv")}>
                  <Download size={14} />
                </Button>
              )}
            </div>
          </div>
          {roMetrics.loading ? <Skeleton className="h-72 w-full" /> : roMetrics.data?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={roMetrics.data} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="period"
                  tickFormatter={metricPeriod === "day" ? fmtDateShort : fmtDate}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(v) => fmtCurrency(v, true)}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <Tooltip content={<ChartTooltip labelFormatter={(l: string) => fmtDateForTooltip(l, metricPeriod)} formatter={(v: number, name: string) => name === "Avg Ticket" ? fmtCurrencyFull(v) : fmtNumber(v)} />} />
                <Legend />
                <Bar yAxisId="left" dataKey="ro_count" name="RO Count" fill={COLORS[0]} opacity={0.7} radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="avg_ticket" name="Avg Ticket" stroke={COLORS[3]} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>

        {/* Vehicles by Make */}
        <Card className="p-6 border-border lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Vehicles by Make</h3>
            <div className="flex items-center gap-2">
              <div className="flex border border-border rounded-md overflow-hidden">
                <button
                  onClick={() => setVehicleMode("count")}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    vehicleMode === "count"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  By Count
                </button>
                <button
                  onClick={() => setVehicleMode("revenue")}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    vehicleMode === "revenue"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  By Revenue
                </button>
              </div>
              {vehiclesMake.data && (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => csvExport(vehiclesMake.data!, "vehicles-by-make.csv")}>
                  <Download size={14} />
                </Button>
              )}
            </div>
          </div>
          {vehiclesMake.loading ? <Skeleton className="h-96 w-full" /> : vehiclesMake.data?.length ? (
            <>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={vehiclesMake.data}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    tickFormatter={vehicleMode === "revenue" ? (v) => fmtCurrency(v, true) : (v) => fmtNumber(v)}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="make"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    width={100}
                  />
                  <Tooltip content={<ChartTooltip formatter={(v: number, name: string) =>
                    name === "Revenue" ? fmtCurrencyFull(v) : fmtNumber(v)
                  } />} />
                  <Bar
                    dataKey={vehicleMode === "revenue" ? "total_revenue" : "ro_count"}
                    name={vehicleMode === "revenue" ? "Revenue" : "RO Count"}
                    fill={COLORS[4]}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 font-medium">Make</th>
                      <th className="text-right py-2 font-medium">RO Count</th>
                      <th className="text-right py-2 font-medium">Total Revenue</th>
                      <th className="text-right py-2 font-medium">Avg Ticket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehiclesMake.data.map((v) => (
                      <tr key={v.make} className="border-b border-border/50">
                        <td className="py-1.5 text-foreground">{v.make}</td>
                        <td className="py-1.5 text-right text-muted-foreground">{fmtNumber(v.ro_count)}</td>
                        <td className="py-1.5 text-right text-muted-foreground">{fmtCurrency(v.total_revenue)}</td>
                        <td className="py-1.5 text-right font-medium text-foreground">{fmtCurrencyFull(v.avg_ticket)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : <EmptyChart />}
        </Card>
      </div>
    </div>
        </main>
      </div>
    </div>
  )
}

function KpiCard({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <Card className="bg-slate-50 dark:bg-slate-900/50 border-border shadow-sm">
      <div className="p-5">
        <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-foreground">{value}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </Card>
  )
}

function PeriodToggle({ value, onChange }: { value: string; onChange: (v: "day" | "week" | "month") => void }) {
  return (
    <div className="flex border border-border rounded-md overflow-hidden">
      {(["day", "week", "month"] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-2.5 py-1 text-xs font-medium transition-colors ${
            value === p
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          {p.charAt(0).toUpperCase() + p.slice(1)}
        </button>
      ))}
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
      <ArrowsClockwise size={32} className="mb-2 opacity-50" />
      <p className="text-sm">No data for this period</p>
      <p className="text-xs mt-1">Try expanding your date range</p>
    </div>
  )
}
