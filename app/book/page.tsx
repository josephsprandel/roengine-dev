"use client"

import { useState, useEffect, useCallback } from "react"
import { format, addDays, startOfDay, isSameDay } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Clock,
  Car,
  User,
  Wrench,
  Calendar,
  CheckCircle,
} from "lucide-react"
import { formatPhoneNumber } from "@/lib/utils/phone-format"

// ── Types ──

interface BookingService {
  id: number
  name: string
  description: string
  estimated_duration_minutes: number
  price_estimate_min: string | null
  price_estimate_max: string | null
}

interface TimeSlot {
  time: string
  available: boolean
}

interface AvailabilityResponse {
  date: string
  day: string
  open_time: string
  close_time: string
  slot_duration_minutes: number
  slots: TimeSlot[]
  closed?: boolean
}

type AppointmentType = "waiter" | "dropoff"

// ── Steps ──

const STEPS = [
  { id: 1, name: "Service", icon: Wrench },
  { id: 2, name: "Type", icon: Clock },
  { id: 3, name: "Date", icon: Calendar },
  { id: 4, name: "Time", icon: Clock },
  { id: 5, name: "Vehicle", icon: Car },
  { id: 6, name: "Contact", icon: User },
  { id: 7, name: "Confirm", icon: CheckCircle },
]

// ── Shop branding ──

function useShopInfo() {
  const [shopName, setShopName] = useState("Auto Shop")
  const [shopLogo, setShopLogo] = useState<string | null>(null)
  const [shopPhone, setShopPhone] = useState("")
  const [shopAddress, setShopAddress] = useState("")

  useEffect(() => {
    fetch("/api/settings/shop-profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.profile) {
          setShopName(data.profile.shop_name || "Auto Shop")
          setShopLogo(data.profile.logo_url || null)
          setShopPhone(data.profile.phone || "")
          const addr = [data.profile.address_line1, data.profile.city, data.profile.state].filter(Boolean).join(", ")
          setShopAddress(addr)
        }
      })
      .catch(() => {})
  }, [])

  return { shopName, shopLogo, shopPhone, shopAddress }
}

// ── Main Component ──

export default function BookingPage() {
  const { shopName, shopLogo, shopPhone, shopAddress } = useShopInfo()

  const [step, setStep] = useState(1)

  // Step 1: Services
  const [services, setServices] = useState<BookingService[]>([])
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([])

  // Step 2: Appointment type
  const [appointmentType, setAppointmentType] = useState<AppointmentType | null>(null)

  // Step 3: Date
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Step 4: Time
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Step 5: Vehicle
  const [vehicleYear, setVehicleYear] = useState("")
  const [vehicleMake, setVehicleMake] = useState("")
  const [vehicleModel, setVehicleModel] = useState("")
  const [vehicleVin, setVehicleVin] = useState("")

  // Step 6: Contact
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerNotes, setCustomerNotes] = useState("")

  // Step 7: Confirmation
  const [submitting, setSubmitting] = useState(false)
  const [bookingResult, setBookingResult] = useState<any>(null)
  const [bookingError, setBookingError] = useState("")

  // ── Fetch services on mount ──
  useEffect(() => {
    fetch("/api/booking/services")
      .then((r) => r.json())
      .then((data) => setServices(data.services || []))
      .catch(() => {})
  }, [])

  // ── Fetch availability when date or type changes ──
  const fetchAvailability = useCallback(async (date: Date, type: AppointmentType) => {
    setLoadingSlots(true)
    setSelectedTime(null)
    try {
      const dateStr = format(date, "yyyy-MM-dd")
      const res = await fetch(`/api/booking/availability?date=${dateStr}&type=${type}`)
      const data = await res.json()
      setAvailability(data)
    } catch {
      setAvailability(null)
    } finally {
      setLoadingSlots(false)
    }
  }, [])

  useEffect(() => {
    if (selectedDate && appointmentType) fetchAvailability(selectedDate, appointmentType)
  }, [selectedDate, appointmentType, fetchAvailability])

  // ── Step validation ──
  const canProceed = () => {
    switch (step) {
      case 1: return selectedServiceIds.length > 0
      case 2: return appointmentType !== null
      case 3: return selectedDate !== null
      case 4: return selectedTime !== null
      case 5: return vehicleYear.length === 4 && vehicleMake.trim() !== "" && vehicleModel.trim() !== ""
      case 6: return customerName.trim() !== "" && customerPhone.trim().length >= 7 && customerEmail.includes("@")
      default: return false
    }
  }

  // ── Submit booking ──
  const handleSubmit = async () => {
    setSubmitting(true)
    setBookingError("")
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          phone: customerPhone.trim(),
          email: customerEmail.trim(),
          year: vehicleYear,
          make: vehicleMake.trim(),
          model: vehicleModel.trim(),
          vin: vehicleVin.trim() || null,
          selected_services: selectedServiceIds,
          scheduled_start: selectedTime,
          notes: customerNotes.trim() || null,
          appointment_type: appointmentType,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Booking failed")

      setBookingResult(data.booking)
      setStep(7)
    } catch (err: any) {
      setBookingError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Navigation ──
  const goNext = () => {
    if (step === 6) {
      handleSubmit()
    } else if (step < 7 && canProceed()) {
      setStep(step + 1)
    }
  }

  const goBack = () => {
    if (step > 1 && step < 7) setStep(step - 1)
  }

  // ── Price formatter ──
  const formatPrice = (min: string | null, max: string | null) => {
    if (!min && !max) return "Quote on inspection"
    if (min && max) return `$${parseFloat(min).toFixed(0)}–$${parseFloat(max).toFixed(0)}`
    return min ? `From $${parseFloat(min).toFixed(0)}` : ""
  }

  // ── Date picker dates (next 30 days, skip past) ──
  const today = startOfDay(new Date())
  const dateDays = Array.from({ length: 30 }, (_, i) => addDays(today, i))

  const selectedServiceNames = services
    .filter((s) => selectedServiceIds.includes(s.id))
    .map((s) => s.name)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {shopLogo && (
            <img src={shopLogo} alt={shopName} className="w-10 h-10 rounded-lg object-cover" />
          )}
          <div>
            <h1 className="text-lg font-bold text-gray-900">{shopName}</h1>
            <p className="text-xs text-gray-500">Book an Appointment</p>
          </div>
        </div>
      </header>

      {/* Progress */}
      {step < 7 && (
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between">
              {STEPS.slice(0, 6).map((s, i) => {
                const Icon = s.icon
                const isComplete = step > s.id
                const isCurrent = step === s.id
                return (
                  <div key={s.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                          isComplete
                            ? "bg-green-500 text-white"
                            : isCurrent
                              ? "bg-gray-900 text-white"
                              : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {isComplete ? <Check size={14} /> : <Icon size={14} />}
                      </div>
                      <span className={`text-[10px] ${isCurrent ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                        {s.name}
                      </span>
                    </div>
                    {i < 5 && (
                      <div className={`flex-1 h-0.5 mx-1.5 mt-[-12px] ${isComplete ? "bg-green-500" : "bg-gray-200"}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Step 1: Services */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">What do you need?</h2>
              <p className="text-sm text-gray-500 mt-1">Select one or more services</p>
            </div>
            <div className="space-y-2">
              {services.map((svc) => {
                const isSelected = selectedServiceIds.includes(svc.id)
                return (
                  <button
                    key={svc.id}
                    onClick={() => {
                      setSelectedServiceIds((prev) =>
                        isSelected ? prev.filter((id) => id !== svc.id) : [...prev, svc.id]
                      )
                    }}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{svc.name}</p>
                        {svc.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{svc.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <span className="text-xs text-gray-400">
                          {formatPrice(svc.price_estimate_min, svc.price_estimate_max)}
                        </span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center">
                            <Check size={12} />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 2: Appointment Type */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Will you be waiting or dropping off?</h2>
              <p className="text-sm text-gray-500 mt-1">This helps us find the best time for you</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => { setAppointmentType("waiter"); setSelectedTime(null) }}
                className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                  appointmentType === "waiter"
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">I&apos;ll wait</p>
                    <p className="text-sm text-gray-500 mt-1">I&apos;ll wait while you work on it</p>
                  </div>
                  {appointmentType === "waiter" && (
                    <div className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center flex-shrink-0">
                      <Check size={12} />
                    </div>
                  )}
                </div>
              </button>
              <button
                onClick={() => { setAppointmentType("dropoff"); setSelectedTime(null) }}
                className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                  appointmentType === "dropoff"
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">I&apos;ll drop it off</p>
                    <p className="text-sm text-gray-500 mt-1">I&apos;ll drop it off and pick up later</p>
                  </div>
                  {appointmentType === "dropoff" && (
                    <div className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center flex-shrink-0">
                      <Check size={12} />
                    </div>
                  )}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Date */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Pick a date</h2>
              <p className="text-sm text-gray-500 mt-1">Select your preferred appointment date</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {dateDays.map((date) => {
                const isSelected = selectedDate && isSameDay(date, selectedDate)
                const isToday = isSameDay(date, today)
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => setSelectedDate(date)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      isSelected
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <p className="text-[10px] text-gray-400 uppercase">{format(date, "EEE")}</p>
                    <p className={`text-lg font-bold ${isSelected ? "text-gray-900" : "text-gray-700"}`}>
                      {format(date, "d")}
                    </p>
                    <p className="text-[10px] text-gray-400">{format(date, "MMM")}</p>
                    {isToday && <p className="text-[9px] text-green-600 font-medium">Today</p>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 4: Time */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {appointmentType === "dropoff" ? "Pick a drop-off time" : "Pick a time"}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")}
              </p>
            </div>
            {loadingSlots ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin mr-2 text-gray-400" size={20} />
                <span className="text-gray-400">Loading times...</span>
              </div>
            ) : availability?.closed ? (
              <Card className="p-6 text-center">
                <p className="text-gray-500">We&apos;re closed on {availability.day}s.</p>
                <Button variant="outline" className="mt-3" onClick={goBack}>
                  Pick another date
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {availability?.slots
                  .filter((s) => s.available)
                  .map((slot) => {
                    const time = new Date(slot.time)
                    const isSelected = selectedTime === slot.time
                    return (
                      <button
                        key={slot.time}
                        onClick={() => setSelectedTime(slot.time)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          isSelected
                            ? "border-gray-900 bg-gray-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <p className={`font-medium ${isSelected ? "text-gray-900" : "text-gray-700"}`}>
                          {format(time, "h:mm a")}
                        </p>
                      </button>
                    )
                  })}
                {availability?.slots.filter((s) => s.available).length === 0 && (
                  <div className="col-span-3 text-center py-8">
                    <p className="text-gray-500">No available times on this date.</p>
                    <Button variant="outline" className="mt-3" onClick={goBack}>
                      Pick another date
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 5: Vehicle */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Your vehicle</h2>
              <p className="text-sm text-gray-500 mt-1">Tell us about your car</p>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="year" className="text-xs text-gray-500">Year *</Label>
                  <Input
                    id="year"
                    placeholder="2021"
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    maxLength={4}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="make" className="text-xs text-gray-500">Make *</Label>
                  <Input
                    id="make"
                    placeholder="Toyota"
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="model" className="text-xs text-gray-500">Model *</Label>
                  <Input
                    id="model"
                    placeholder="Camry"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="vin" className="text-xs text-gray-500">VIN (optional)</Label>
                <Input
                  id="vin"
                  placeholder="1HGCM82633A004352"
                  value={vehicleVin}
                  onChange={(e) => setVehicleVin(e.target.value.toUpperCase().slice(0, 17))}
                  maxLength={17}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Contact */}
        {step === 6 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Your information</h2>
              <p className="text-sm text-gray-500 mt-1">How can we reach you?</p>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="name" className="text-xs text-gray-500">Full name *</Label>
                <Input
                  id="name"
                  placeholder="John Smith"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-xs text-gray-500">Phone number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-xs text-gray-500">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="notes" className="text-xs text-gray-500">Notes (optional)</Label>
                <textarea
                  id="notes"
                  placeholder="Anything we should know? Describe any concerns..."
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            {/* Summary card */}
            <Card className="p-4 bg-gray-50 border-gray-200">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Booking Summary</p>
              <div className="space-y-1 text-sm">
                <p className="text-gray-700">{selectedServiceNames.join(", ")}</p>
                <p className="text-gray-700">
                  {appointmentType === "waiter" ? "Waiting" : "Drop-off"} &middot;{" "}
                  {selectedDate && format(selectedDate, "EEE, MMM d")} at{" "}
                  {selectedTime && format(new Date(selectedTime), "h:mm a")}
                </p>
                <p className="text-gray-700">
                  {vehicleYear} {vehicleMake} {vehicleModel}
                </p>
              </div>
            </Card>

            {bookingError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {bookingError}
              </div>
            )}
          </div>
        )}

        {/* Step 7: Confirmation */}
        {step === 7 && bookingResult && (
          <div className="space-y-6 text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
              <CheckCircle size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">You&apos;re booked!</h2>
              <p className="text-gray-500 mt-1">We&apos;ll see you then.</p>
            </div>

            <Card className="p-5 text-left bg-white border-gray-200">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Reference</p>
                  <p className="font-mono font-bold text-lg text-gray-900">{bookingResult.reference}</p>
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-400 uppercase">Appointment</p>
                  <p className="font-medium text-gray-900">
                    {format(new Date(bookingResult.scheduled_start), "EEEE, MMMM d, yyyy")}
                  </p>
                  <p className="text-gray-700">
                    {format(new Date(bookingResult.scheduled_start), "h:mm a")} –{" "}
                    {format(new Date(bookingResult.scheduled_end), "h:mm a")}
                  </p>
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-400 uppercase">Type</p>
                  <p className="text-gray-700">{appointmentType === "waiter" ? "Waiting while serviced" : "Drop-off"}</p>
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-400 uppercase">Services</p>
                  <p className="text-gray-700">{bookingResult.services}</p>
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-400 uppercase">Vehicle</p>
                  <p className="text-gray-700">{vehicleYear} {vehicleMake} {vehicleModel}</p>
                </div>
              </div>
            </Card>

            <div className="text-sm text-gray-500 space-y-1">
              {shopPhone && <p>Questions? Call us at <a href={`tel:${shopPhone.replace(/\D/g, '')}`} className="font-medium text-gray-900 underline">{formatPhoneNumber(shopPhone)}</a></p>}
              {shopAddress && <p>{shopAddress}</p>}
            </div>
          </div>
        )}

        {/* Navigation */}
        {step < 7 && (
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-200">
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={step === 1}
              className="text-gray-500"
            >
              <ChevronLeft size={16} className="mr-1" />
              Back
            </Button>
            <Button
              onClick={goNext}
              disabled={!canProceed() || submitting}
              className="bg-gray-900 text-white hover:bg-gray-800 px-6"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Booking...
                </>
              ) : step === 6 ? (
                <>
                  Confirm Booking
                  <Check size={16} className="ml-2" />
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight size={16} className="ml-1" />
                </>
              )}
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
