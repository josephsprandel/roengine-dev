import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit2, MessageSquare, Phone, Mail, MapPin } from "lucide-react"

interface CustomerInfoCardProps {
  customerName: string
  phonePrimary: string
  phoneSecondary?: string | null
  phoneMobile?: string | null
  email?: string | null
  address: string
  onEdit: () => void
}

export function CustomerInfoCard({
  customerName,
  phonePrimary,
  phoneSecondary,
  phoneMobile,
  email,
  address,
  onEdit,
}: CustomerInfoCardProps) {
  return (
    <Card className="p-6 border-border relative">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center text-accent-foreground font-bold text-lg flex-shrink-0">
            {customerName.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{customerName}</h2>
            <p className="text-xs text-muted-foreground">Customer Information</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onEdit} className="gap-2">
          <Edit2 size={14} />
        </Button>
      </div>
      
      <div className="space-y-3 pr-24">
        <div className="flex items-start gap-3">
          <Phone size={16} className="text-accent flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="text-sm font-medium text-foreground">{phonePrimary}</p>
            {phoneSecondary && (
              <p className="text-xs text-muted-foreground">Alt: {phoneSecondary}</p>
            )}
            {phoneMobile && (
              <p className="text-xs text-muted-foreground">Mobile: {phoneMobile}</p>
            )}
          </div>
        </div>

        {email && (
          <div className="flex items-start gap-3">
            <Mail size={16} className="text-accent flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium text-foreground truncate">{email}</p>
            </div>
          </div>
        )}

        {address && (
          <div className="flex items-start gap-3">
            <MapPin size={16} className="text-accent flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Address</p>
              <p className="text-sm font-medium text-foreground">{address}</p>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 right-6 flex flex-col gap-2 w-24">
        <Button size="sm" variant="outline" className="gap-1 bg-transparent w-full">
          <MessageSquare size={14} />
          SMS
        </Button>
        <Button size="sm" variant="outline" className="gap-1 bg-transparent w-full">
          <Phone size={14} />
          Call
        </Button>
        {email && (
          <Button size="sm" variant="outline" className="gap-1 bg-transparent w-full">
            <Mail size={14} />
            Email
          </Button>
        )}
      </div>
    </Card>
  )
}
