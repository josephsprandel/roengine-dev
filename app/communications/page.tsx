"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { CommunicationsDashboard } from "@/components/communications/communications-dashboard"

export default function CommunicationsPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main className="p-6">
          <CommunicationsDashboard />
        </main>
      </div>
    </div>
  )
}
