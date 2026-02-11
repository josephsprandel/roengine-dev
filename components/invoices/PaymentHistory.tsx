"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CreditCard, Banknote, FileText, DollarSign } from "lucide-react"

interface Payment {
  id: number
  amount: number
  payment_method: "cash" | "card" | "check" | "ach"
  card_surcharge: number
  total_charged: number
  paid_at: string
  recorded_by_name: string
  notes: string | null
}

interface PaymentHistoryProps {
  payments: Payment[]
  balanceDue: number
  grandTotal: number
}

const paymentMethodIcons = {
  cash: Banknote,
  card: CreditCard,
  check: FileText,
  ach: FileText,
}

const paymentMethodLabels = {
  cash: "Cash",
  card: "Credit/Debit Card",
  check: "Check",
  ach: "ACH Transfer",
}

export function PaymentHistory({ payments, balanceDue, grandTotal }: PaymentHistoryProps) {
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const isPaid = balanceDue <= 0

  if (payments.length === 0) {
    return (
      <Card className="p-6 border-border">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <DollarSign size={18} className="text-muted-foreground" />
          Payment History
        </h3>
        <p className="text-sm text-muted-foreground text-center py-4">
          No payments recorded yet
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-6 border-border">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <DollarSign size={18} className="text-muted-foreground" />
        Payment History ({payments.length})
      </h3>

      <div className="space-y-3">
        {payments.map((payment) => {
          const Icon = paymentMethodIcons[payment.payment_method]
          const hasCardSurcharge = payment.card_surcharge > 0

          return (
            <div
              key={payment.id}
              className="flex items-start justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Icon size={18} className="text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">
                      ${payment.amount.toFixed(2)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {paymentMethodLabels[payment.payment_method]}
                    </Badge>
                  </div>
                  {hasCardSurcharge && (
                    <p className="text-xs text-muted-foreground mb-1">
                      + ${payment.card_surcharge.toFixed(2)} card fee = ${payment.total_charged.toFixed(2)} charged
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(payment.paid_at).toLocaleString()} • by {payment.recorded_by_name}
                  </p>
                  {payment.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      "{payment.notes}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-border space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Invoice Total</span>
          <span className="font-medium">${grandTotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Paid</span>
          <span className="font-medium text-green-600 dark:text-green-400">
            ${totalPaid.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between text-base font-semibold pt-2 border-t border-border">
          <span>Balance Due</span>
          {isPaid ? (
            <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/20">
              PAID IN FULL
            </Badge>
          ) : (
            <span className={balanceDue > 0 ? "text-amber-600 dark:text-amber-400" : ""}>
              ${balanceDue.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}
