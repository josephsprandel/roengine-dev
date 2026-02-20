"use client"

import { Suspense } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { ROCreationWizard } from "@/components/repair-orders/ro-creation-wizard"
import { useSearchParams } from "next/navigation"

function ROCreationWrapper() {
  const searchParams = useSearchParams()
  const customerId = searchParams.get("customerId") || undefined
  const scheduledStart = searchParams.get("scheduledStart") || undefined
  const bay = searchParams.get("bay") || undefined

  return (
    <ROCreationWizard
      initialCustomerId={customerId}
      initialScheduledStart={scheduledStart}
      initialBay={bay}
    />
  )
}

export default function NewROPage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-8">
          <Suspense fallback={<div>Loading...</div>}>
            <ROCreationWrapper />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
