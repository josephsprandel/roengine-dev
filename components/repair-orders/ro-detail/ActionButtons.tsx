import { Button } from "@/components/ui/button"

interface ActionButtonsProps {
  onApprove: () => void
  onComplete: () => void
  onCancel: () => void
  isApproved: boolean
  isCompleted: boolean
  isCancelled: boolean
  isSaving: boolean
}

export function ActionButtons({
  onApprove,
  onComplete,
  onCancel,
  isApproved,
  isCompleted,
  isCancelled,
  isSaving,
}: ActionButtonsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Button
        className="gap-2"
        onClick={onApprove}
        disabled={isSaving || isApproved || isCompleted || isCancelled}
      >
        Approve
      </Button>
      <Button
        variant="outline"
        className="bg-transparent gap-2"
        onClick={onComplete}
        disabled={isSaving || isCompleted || isCancelled}
      >
        Complete
      </Button>
      <Button
        variant="outline"
        className="bg-transparent text-destructive border-destructive/30 hover:bg-destructive/10 gap-2"
        onClick={onCancel}
        disabled={isSaving || isCancelled}
      >
        Cancel RO
      </Button>
    </div>
  )
}
