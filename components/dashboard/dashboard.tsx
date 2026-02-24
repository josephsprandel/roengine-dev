"use client"

import { MetricsGrid } from "./metrics-grid"
import { RepairOrdersTable } from "./repair-orders-table"
import { AIInsights } from "./ai-insights"
import { GlobalActivityFeed } from "./global-activity-feed"

export function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      {/* Metrics */}
      <MetricsGrid />

      {/* Activity feed and AI insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GlobalActivityFeed />
        </div>
        <AIInsights />
      </div>

      {/* Main content */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">Active Repair Orders</h2>
          <RepairOrdersTable />
        </div>
      </div>
    </div>
  )
}
