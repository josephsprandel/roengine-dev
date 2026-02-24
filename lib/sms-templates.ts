export interface ShopInfo {
  name: string
  phone: string
  hours: string
}

const OPT_OUT = "Reply STOP to opt out."

export function estimateLink(
  customerName: string,
  vehicleYear: number,
  vehicleMake: string,
  vehicleModel: string,
  estimateUrl: string,
  shopInfo: ShopInfo
): string {
  return `Hi ${customerName}, your estimate for your ${vehicleYear} ${vehicleMake} ${vehicleModel} is ready. View it here: ${estimateUrl} - ${shopInfo.name}. ${OPT_OUT}`
}

export function statusUpdate(
  customerName: string,
  vehicleYMM: string,
  statusMessage: string,
  shopInfo: ShopInfo
): string {
  return `Update on your ${vehicleYMM}: ${statusMessage} - ${shopInfo.name}. ${OPT_OUT}`
}

export function pickupReady(
  customerName: string,
  vehicleYMM: string,
  total: string,
  shopInfo: ShopInfo
): string {
  return `Good news! Your ${vehicleYMM} is ready for pickup. Your total is $${total}. We're open ${shopInfo.hours}. - ${shopInfo.name}. ${OPT_OUT}`
}

export function appointmentReminder(
  customerName: string,
  vehicleYMM: string,
  dateTime: string,
  shopInfo: ShopInfo
): string {
  return `Reminder: Your ${vehicleYMM} is scheduled for service ${dateTime}. Reply CONFIRM or call ${shopInfo.phone} to reschedule. - ${shopInfo.name}. ${OPT_OUT}`
}

export function approvalRequest(
  customerName: string,
  serviceName: string,
  price: string,
  shopInfo: ShopInfo
): string {
  return `Hi ${customerName}, we found your ${serviceName} needs attention. Cost: $${price}. Reply YES to approve or NO to decline. - ${shopInfo.name}. ${OPT_OUT}`
}

export function custom(body: string, shopInfo: ShopInfo): string {
  return `${body} - ${shopInfo.name}. ${OPT_OUT}`
}

export type TemplateId = 'estimate_link' | 'status_update' | 'pickup_ready' | 'appointment_reminder' | 'approval_request' | 'custom'

export interface TemplateData {
  customerName?: string
  vehicleYear?: number
  vehicleMake?: string
  vehicleModel?: string
  vehicleYMM?: string
  estimateUrl?: string
  statusMessage?: string
  total?: string
  dateTime?: string
  serviceName?: string
  price?: string
  body?: string
}

export function generateFromTemplate(templateId: TemplateId, data: TemplateData, shopInfo: ShopInfo): string {
  switch (templateId) {
    case 'estimate_link':
      return estimateLink(
        data.customerName || 'Customer',
        data.vehicleYear || 0,
        data.vehicleMake || '',
        data.vehicleModel || '',
        data.estimateUrl || '',
        shopInfo
      )
    case 'status_update':
      return statusUpdate(
        data.customerName || 'Customer',
        data.vehicleYMM || '',
        data.statusMessage || '',
        shopInfo
      )
    case 'pickup_ready':
      return pickupReady(
        data.customerName || 'Customer',
        data.vehicleYMM || '',
        data.total || '0.00',
        shopInfo
      )
    case 'appointment_reminder':
      return appointmentReminder(
        data.customerName || 'Customer',
        data.vehicleYMM || '',
        data.dateTime || '',
        shopInfo
      )
    case 'approval_request':
      return approvalRequest(
        data.customerName || 'Customer',
        data.serviceName || '',
        data.price || '0.00',
        shopInfo
      )
    case 'custom':
      return custom(data.body || '', shopInfo)
    default:
      return data.body || ''
  }
}
