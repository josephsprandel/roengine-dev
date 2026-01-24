import { RODetailView } from '@/components/repair-orders/ro-detail-view'

export default async function RepairOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  
  return (
    <div className="container mx-auto p-6">
      <RODetailView roId={id} />
    </div>
  )
}
