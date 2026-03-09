import { useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit2, MessageSquare, Phone, Mail, MapPin, PhoneCall, Loader2 } from "lucide-react"
import { formatPhoneNumber } from "@/lib/utils/phone-format"

interface CustomerInfoCardProps {
  customerName: string
  phonePrimary: string
  phoneSecondary?: string | null
  phoneMobile?: string | null
  email?: string | null
  address: string
  workOrderId?: number
  onEdit: () => void
  onSMS?: () => void
  onEmail?: () => void
}

export function CustomerInfoCard({
  customerName,
  phonePrimary,
  phoneSecondary,
  phoneMobile,
  email,
  address,
  workOrderId,
  onEdit,
  onSMS,
  onEmail,
}: CustomerInfoCardProps) {
  const [callStatus, setCallStatus] = useState<string | null>(null)
  const [calling, setCalling] = useState(false)

  const handleCall = useCallback(async () => {
    const phone = phonePrimary || phoneMobile
    if (!phone) return
    setCalling(true)
    setCallStatus("Calling desk phone...")
    try {
      const token = localStorage.getItem("auth_token")
      const res = await fetch("/api/calls/bridge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          customer_phone: phone,
          work_order_id: workOrderId,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setCallStatus(`Connecting to ${customerName}...`)
        setTimeout(() => setCallStatus(null), 8000)
      } else {
        setCallStatus(data.error || "Call failed")
        setTimeout(() => setCallStatus(null), 5000)
      }
    } catch {
      setCallStatus("Call failed")
      setTimeout(() => setCallStatus(null), 5000)
    } finally {
      setCalling(false)
    }
  }, [phonePrimary, phoneMobile, workOrderId, customerName])
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
        {(phonePrimary || phoneSecondary || phoneMobile) && (
          <div className="flex items-start gap-3">
            <Phone size={16} className="text-accent flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Phone</p>
              {phonePrimary && <p className="text-sm font-medium text-foreground">{formatPhoneNumber(phonePrimary)}</p>}
              {phoneSecondary && (
                <p className="text-xs text-muted-foreground">Alt: {formatPhoneNumber(phoneSecondary)}</p>
              )}
              {phoneMobile && (
                <p className="text-xs text-muted-foreground">Mobile: {formatPhoneNumber(phoneMobile)}</p>
              )}
            </div>
          </div>
        )}

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
        <Button size="sm" variant="outline" className="gap-1 bg-transparent w-full" onClick={onSMS}>
          <MessageSquare size={14} />
          SMS
        </Button>
        {(phonePrimary || phoneMobile) && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1 bg-transparent w-full"
            onClick={handleCall}
            disabled={calling}
          >
            {calling ? <Loader2 size={14} className="animate-spin" /> : <PhoneCall size={14} />}
            Call
          </Button>
        )}
        {email && (
          <Button size="sm" variant="outline" className="gap-1 bg-transparent w-full" onClick={onEmail}>
            <Mail size={14} />
            Email
          </Button>
        )}
      </div>

      {callStatus && (
        <div className="absolute bottom-1 left-6 right-6">
          <p className="text-xs text-accent font-medium truncate">{callStatus}</p>
        </div>
      )}
    </Card>
  )
}
