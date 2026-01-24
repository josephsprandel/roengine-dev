import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { RODetailView } from '@/components/repair-orders/ro-detail-view'

export default async function RepairOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <RODetailView roId={id} />
          </div>
        </main>
      </div>
    </div>
  )
}
