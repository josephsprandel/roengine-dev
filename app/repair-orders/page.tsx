import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { ROListView } from "@/components/repair-orders/ro-list-view"

export default function RepairOrdersPage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <ROListView />
          </div>
        </main>
      </div>
    </div>
  )
}
