"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp } from "lucide-react"
import { SEASONAL_ARO_PROFILE, MONTH_BOOKING_CEILING } from "@/lib/scheduling/constants"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export function SeasonalOverridesSection() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} className="text-amber-500" />
        <h3 className="font-semibold text-foreground">Seasonal Overrides</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Based on 3 years of AutoHouse historical data. Months with booking ceiling overrides
        automatically reduce the daily appointment cap.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left py-2 pr-4">Month</th>
              <th className="text-center py-2 px-3">ARO Index</th>
              <th className="text-center py-2 px-3">Volume</th>
              <th className="text-center py-2 px-3">Ceiling Override</th>
              <th className="text-left py-2 pl-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {MONTH_NAMES.map((name, i) => {
              const month = i + 1
              const profile = SEASONAL_ARO_PROFILE[month]
              const ceiling = MONTH_BOOKING_CEILING[month]
              const aroColor =
                profile.aro_index >= 1.10 ? "text-green-600" :
                profile.aro_index >= 1.0 ? "text-foreground" :
                profile.aro_index >= 0.90 ? "text-amber-600" :
                "text-red-600"

              return (
                <tr key={month} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-4 font-medium">{name}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`font-mono font-semibold ${aroColor}`}>
                      {profile.aro_index.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center font-mono">
                    {profile.volume_index.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {ceiling != null ? (
                      <Badge variant="outline" className="text-red-600 border-red-300">
                        Max {ceiling}/day
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 pl-3 text-xs text-muted-foreground max-w-[300px]">
                    {profile.notes}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
