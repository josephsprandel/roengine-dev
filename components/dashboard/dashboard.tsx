"use client"

import { MetricsGrid } from "./metrics-grid"
import { RepairOrdersTable } from "./repair-orders-table"
import { AIInsights } from "./ai-insights"
import { QuickActions } from "./quick-actions"

export function Dashboard() {
  return (
    <div className="p-6 space-y-8 bg-gradient-to-br from-background via-background to-card/5 min-h-screen">
      {/* Header section with visual hierarchy */}
      <div className="space-y-2">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground font-medium">Welcome back. Here's your shop performance at a glance.</p>
      </div>

      {/* Metrics */}
      <div>
        <MetricsGrid />
      </div>

      {/* Quick actions and AI insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <QuickActions />
        </div>
        <AIInsights />
      </div>

      {/* Main content */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-4 tracking-tight">Active Repair Orders</h2>
          <RepairOrdersTable />
        </div>
      </div>
    </div>
  )
}
