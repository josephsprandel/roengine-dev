"use client"

import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { CreditCard, Banknote, FileText, DollarSign, Loader2, CheckCircle, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"

interface Payment {
  id: number
  amount: number
  payment_method: "cash" | "card" | "check" | "ach"
  card_surcharge: number
  total_charged: number
  paid_at: string
  recorded_by_name: string
  notes: string | null
  is_reversal: boolean
  reversal_of: number | null
  reversed_at: string | null
}

interface PricingSummaryProps {
  totals: {
    parts: number
    labor: number
    laborGross: number
    laborDiscount: number
    partsDiscount: number
    sublets: number
    hazmat: number
    fees: number
    shopSupplies: number
    subtotal: number
    tax: number
    taxRate: number
    grandTotal: number
    amountPaid: number
    balanceDue: number
  }
  shopSuppliesAmount: number
  feesAmount: number
  subletsAmount: number
  laborDiscountAmount: number
  laborDiscountType: 'percent' | 'flat'
  partsDiscountAmount: number
  partsDiscountType: 'percent' | 'flat'
  hasPerServiceDiscounts: boolean
  onUpdateField: (field: string, value: number | string) => void
  payments: Payment[]
  canAddPayment: boolean
  workOrderId: number
  ccSurchargeEnabled: boolean
  ccSurchargeRate: number
  onPaymentChange: () => void
}

interface PaymentMethodOption {
  id: number
  type: string
  name: string
  display_label: string
}

function EditableAmount({
  label,
  value,
  onSave,
}: {
  label: string
  value: number
  onSave: (value: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [editValue, setEditValue] = useState(value.toFixed(2))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setEditValue(value.toFixed(2))
      setTimeout(() => inputRef.current?.select(), 50)
    }
  }, [open, value])

  const handleSave = () => {
    const parsed = parseFloat(editValue)
    if (!isNaN(parsed) && parsed >= 0) {
      onSave(parsed)
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="text-right font-mono tabular-nums hover:bg-muted/50 rounded px-1 -mx-1 cursor-pointer transition-colors"
          title={`Click to edit ${label}`}
        >
          ${value.toFixed(2)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3" align="end" sideOffset={4}>
        <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">$</span>
          <Input
            ref={inputRef}
            type="number"
            step="0.01"
            min="0"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave()
              if (e.key === "Escape") setOpen(false)
            }}
            className="h-8 text-sm font-mono"
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Enter to save, Esc to cancel</p>
      </PopoverContent>
    </Popover>
  )
}

function EditableDiscount({
  label,
  amount,
  type,
  onSave,
}: {
  label: string
  amount: number
  type: 'percent' | 'flat'
  onSave: (amount: number, type: 'percent' | 'flat') => void
}) {
  const [open, setOpen] = useState(false)
  const [editAmount, setEditAmount] = useState(String(amount || ''))
  const [editType, setEditType] = useState<'percent' | 'flat'>(type)

  useEffect(() => {
    if (open) {
      setEditAmount(String(amount || ''))
      setEditType(type)
    }
  }, [open, amount, type])

  const handleSave = () => {
    const parsed = parseFloat(editAmount) || 0
    onSave(parsed, editType)
    setOpen(false)
  }

  const displayValue = amount > 0
    ? type === 'percent' ? `${amount}%` : `$${amount.toFixed(2)}`
    : '$0.00'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="text-right font-mono tabular-nums hover:bg-muted/50 rounded px-1 -mx-1 cursor-pointer transition-colors text-red-600"
          title={`Click to edit ${label}`}
        >
          ({displayValue})
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end" sideOffset={4}>
        <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') setOpen(false)
            }}
            className="h-8 text-sm font-mono flex-1"
            placeholder="0"
            autoFocus
          />
          <div className="flex rounded-md border border-border overflow-hidden flex-shrink-0">
            <button
              className={`px-2 py-1 text-xs font-medium transition-colors ${
                editType === 'percent' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
              onClick={() => setEditType('percent')}
            >
              %
            </button>
            <button
              className={`px-2 py-1 text-xs font-medium transition-colors ${
                editType === 'flat' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
              onClick={() => setEditType('flat')}
            >
              $
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">Enter to save, Esc to cancel</p>
      </PopoverContent>
    </Popover>
  )
}

function formatPaymentDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function PricingSummary({
  totals,
  shopSuppliesAmount,
  feesAmount,
  subletsAmount,
  laborDiscountAmount,
  laborDiscountType,
  partsDiscountAmount,
  partsDiscountType,
  hasPerServiceDiscounts,
  onUpdateField,
  payments,
  canAddPayment,
  workOrderId,
  ccSurchargeEnabled,
  ccSurchargeRate,
  onPaymentChange,
}: PricingSummaryProps) {
  const { user } = useAuth()
  const userId = user?.id || 1
  // Payment methods from DB
  const [methodOptions, setMethodOptions] = useState<PaymentMethodOption[]>([])
  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("Cash")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentNotes, setPaymentNotes] = useState("")
  const [posting, setPosting] = useState(false)
  const [reversingId, setReversingId] = useState<number | null>(null)

  // Fetch payment methods from settings
  useEffect(() => {
    fetch("/api/settings/payment-methods")
      .then((r) => r.json())
      .then((data) => {
        if (data.methods?.length > 0) {
          setMethodOptions(data.methods)
          setPaymentMethod(data.methods[0].display_label)
        }
      })
      .catch(() => {})
  }, [])

  // Card surcharge calculation — applies to any credit_card type
  const amountNum = parseFloat(paymentAmount) || 0
  const selectedMethodType = methodOptions.find((m) => m.display_label === paymentMethod)?.type
  const isCardPayment = selectedMethodType === "credit_card"
  const cardSurcharge = isCardPayment && ccSurchargeEnabled ? amountNum * ccSurchargeRate : 0

  // Reset form when balance changes (e.g. after posting)
  useEffect(() => {
    if (totals.balanceDue > 0) {
      setPaymentAmount(totals.balanceDue.toFixed(2))
    } else {
      setPaymentAmount("0.00")
    }
  }, [totals.balanceDue])

  const handlePostPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error("Enter a valid payment amount")
      return
    }
    if (parseFloat(paymentAmount) > totals.balanceDue) {
      toast.error(`Payment cannot exceed balance due of $${totals.balanceDue.toFixed(2)}`)
      return
    }

    setPosting(true)
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          payment_method: paymentMethod,
          notes: paymentNotes.trim() || null,
          user_id: userId,
          paid_at: paymentDate
            ? new Date(paymentDate + 'T' + new Date().toTimeString().slice(0, 8))
            : undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to record payment")

      toast.success("Payment recorded")
      setPaymentNotes("")
      setPaymentMethod(methodOptions[0]?.display_label || "Cash")
      onPaymentChange()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setPosting(false)
    }
  }

  const handleReversePayment = async (paymentId: number, amount: number) => {
    if (!confirm(`Reverse payment of $${amount.toFixed(2)}? This will create a reversal record.`)) return

    setReversingId(paymentId)
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/payments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: paymentId, user_id: userId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to reverse payment')

      toast.success(data.message)
      onPaymentChange()
    } catch (err: any) {
      toast.error(err.message || 'Failed to reverse payment')
    } finally {
      setReversingId(null)
    }
  }

  const isPaid = totals.balanceDue <= 0 && totals.grandTotal > 0

  return (
    <Card className="p-5 border-border bg-muted/30">
      <div className="flex justify-end gap-6">
        {/* Left column — Post Payment + Payment Log */}
        <div className="w-[340px]">
          {/* Post Payment Form */}
          {canAddPayment && (
            <div className="mb-5">
              <h3 className="font-semibold text-sm mb-3">Post Payment</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="w-28 text-xs text-muted-foreground flex-shrink-0">Payment Amount:</Label>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePostPayment() }}
                    className="pl-7 h-9 font-mono text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Label className="w-28 text-xs text-muted-foreground flex-shrink-0">Payment Method:</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v)}>
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {methodOptions.map((m) => (
                      <SelectItem key={m.id} value={m.display_label}>
                        {m.display_label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Label className="w-28 text-xs text-muted-foreground flex-shrink-0">Select Date:</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="h-9 flex-1"
                />
              </div>

              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Add accounting notes..."
                rows={2}
                className="text-sm"
              />

              {isCardPayment && ccSurchargeEnabled && cardSurcharge > 0 && (
                <p className="text-xs text-muted-foreground">
                  + ${cardSurcharge.toFixed(2)} card fee ({(ccSurchargeRate * 100).toFixed(2)}%) = ${(amountNum + cardSurcharge).toFixed(2)} total charged
                </p>
              )}

              <Button
                onClick={handlePostPayment}
                disabled={posting || !paymentAmount || parseFloat(paymentAmount) <= 0}
                className="gap-2"
                size="sm"
              >
                {posting ? <Loader2 size={14} className="animate-spin" /> : <DollarSign size={14} />}
                {posting ? "Posting..." : "Post Payment"}
              </Button>
              </div>
            </div>
          )}

          {/* Review Payment Log */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Review Payment Log</h3>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No payments recorded</p>
            ) : (
              <div className="space-y-1.5">
                {payments.map((payment) => {
                  const isReversal = payment.is_reversal
                  const isReversed = !!payment.reversed_at
                  const absAmount = Math.abs(payment.amount)

                  return (
                    <div
                      key={payment.id}
                      className={`flex items-start justify-between py-1.5 ${isReversed ? 'opacity-50' : ''}`}
                    >
                      <div className="min-w-0">
                        {isReversal ? (
                          <>
                            <p className="text-sm text-red-600 font-medium">
                              -${absAmount.toFixed(2)} Payment Reversed
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatPaymentDate(payment.paid_at)}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className={`text-sm font-medium ${isReversed ? 'line-through text-muted-foreground' : ''}`}>
                              {payment.payment_method}: ${absAmount.toFixed(2)}
                              {payment.card_surcharge > 0 && (
                                <span className="text-muted-foreground font-normal text-xs ml-1">
                                  (+${payment.card_surcharge.toFixed(2)} fee)
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatPaymentDate(payment.paid_at)}
                            </p>
                            {payment.notes && !payment.notes.startsWith('Reversal of') && (
                              <p className="text-[11px] text-muted-foreground italic">{payment.notes}</p>
                            )}
                          </>
                        )}
                      </div>
                      {!isReversal && !isReversed && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReversePayment(payment.id, payment.amount)}
                          disabled={reversingId === payment.id}
                          className="flex-shrink-0 ml-3 h-7 px-2.5 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        >
                          {reversingId === payment.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <RotateCcw size={12} />
                          )}
                          Reverse
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column — Summary */}
        <div className="w-[340px] flex-shrink-0">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <DollarSign size={16} className="text-muted-foreground" />
            Summary
          </h3>
          <table className="text-sm w-full">
            <tbody>
              {/* Labor */}
              <tr>
                <td className="py-0.5 text-muted-foreground">Total Labor:</td>
                <td className="py-0.5 text-right font-mono tabular-nums">
                  ${totals.laborGross.toFixed(2)}
                </td>
              </tr>
              {/* Labor Discount */}
              {hasPerServiceDiscounts && totals.laborDiscount > 0 ? (
                <tr>
                  <td className="py-0.5 text-muted-foreground">Labor Discount:</td>
                  <td className="py-0.5 text-right font-mono tabular-nums text-red-600">
                    (${totals.laborDiscount.toFixed(2)})
                  </td>
                </tr>
              ) : (
                <tr>
                  <td className="py-0.5 text-muted-foreground">Labor Discount:</td>
                  <td className="py-0.5 text-right">
                    <EditableDiscount
                      label="Labor Discount"
                      amount={laborDiscountAmount}
                      type={laborDiscountType}
                      onSave={(amt, typ) => {
                        onUpdateField('labor_discount_amount', amt)
                        onUpdateField('labor_discount_type', typ)
                      }}
                    />
                  </td>
                </tr>
              )}

              {/* Parts */}
              <tr>
                <td className="py-0.5 text-muted-foreground">Total Parts:</td>
                <td className="py-0.5 text-right font-mono tabular-nums">
                  ${totals.parts.toFixed(2)}
                </td>
              </tr>
              {/* Parts Discount */}
              <tr>
                <td className="py-0.5 text-muted-foreground">Parts Discount:</td>
                <td className="py-0.5 text-right">
                  <EditableDiscount
                    label="Parts Discount"
                    amount={partsDiscountAmount}
                    type={partsDiscountType}
                    onSave={(amt, typ) => {
                      onUpdateField('parts_discount_amount', amt)
                      onUpdateField('parts_discount_type', typ)
                    }}
                  />
                </td>
              </tr>

              {/* Fees */}
              <tr>
                <td className="py-0.5 text-muted-foreground">Total Fees:</td>
                <td className="py-0.5 text-right">
                  <EditableAmount
                    label="Fees"
                    value={feesAmount || totals.fees}
                    onSave={(v) => onUpdateField("fees_amount", v)}
                  />
                </td>
              </tr>

              {/* Sublets */}
              <tr>
                <td className="py-0.5 text-muted-foreground">Total Sublets:</td>
                <td className="py-0.5 text-right">
                  <EditableAmount
                    label="Sublets"
                    value={subletsAmount || totals.sublets}
                    onSave={(v) => onUpdateField("sublets_amount", v)}
                  />
                </td>
              </tr>

              {/* Shop Supplies */}
              <tr>
                <td className="py-0.5 text-muted-foreground">Shop Supplies:</td>
                <td className="py-0.5 text-right">
                  <EditableAmount
                    label="Shop Supplies"
                    value={shopSuppliesAmount || totals.shopSupplies}
                    onSave={(v) => onUpdateField("shop_supplies_amount", v)}
                  />
                </td>
              </tr>

              {/* Divider */}
              <tr>
                <td colSpan={2} className="py-1">
                  <div className="border-t border-border" />
                </td>
              </tr>

              {/* Subtotal */}
              <tr>
                <td className="py-0.5 font-semibold">Subtotal:</td>
                <td className="py-0.5 text-right font-mono tabular-nums font-semibold">
                  ${totals.subtotal.toFixed(2)}
                </td>
              </tr>

              {/* Tax */}
              <tr>
                <td className="py-0.5 text-muted-foreground">
                  Sales Tax ({(totals.taxRate * 100).toFixed(2)}%):
                </td>
                <td className="py-0.5 text-right font-mono tabular-nums">
                  ${totals.tax.toFixed(2)}
                </td>
              </tr>

              {/* Grand Total bar */}
              <tr>
                <td colSpan={2} className="pt-2 pb-1">
                  <div className="bg-primary text-primary-foreground rounded px-3 py-2 flex items-center justify-between">
                    <span className="font-bold">Grand Total:</span>
                    <span className="font-bold font-mono tabular-nums text-lg">
                      ${totals.grandTotal.toFixed(2)}
                    </span>
                  </div>
                </td>
              </tr>

              {/* Amount Paid / Due */}
              <tr>
                <td className="py-0.5 text-muted-foreground">Amount Paid:</td>
                <td className="py-0.5 text-right font-mono tabular-nums">
                  ${totals.amountPaid.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="py-0.5 font-semibold text-amber-600 dark:text-amber-400">Amount Due:</td>
                <td className="py-0.5 text-right font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                  {totals.balanceDue <= 0 ? '$0.00' : `$${totals.balanceDue.toFixed(2)}`}
                </td>
              </tr>

              {/* Paid badge */}
              {isPaid && (
                <tr>
                  <td colSpan={2} className="pt-3">
                    <div className="flex items-center justify-center gap-2 py-2">
                      <CheckCircle size={28} className="text-green-600" />
                      <span className="text-2xl font-bold text-green-600">PAID</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </Card>
  )
}
