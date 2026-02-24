"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { PartsManagerDashboard } from "@/components/parts-manager/parts-manager-dashboard"

export default function PartsManagerPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main className="p-6">
          <PartsManagerDashboard />
        </main>
      </div>
    </div>
  )
}
