// src/lib/utils/whatsapp.js
// PDF is now the primary delivery method.
// These helpers are kept for fallback text messages only.

export function getWhatsAppLink(phone, message) {
  const cleaned = phone.replace(/\D/g, '')
  const number  = cleaned.startsWith('91') ? cleaned : `91${cleaned}`
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

// Fallback text bill (used only if PDF generation fails)
export function formatDistributorBill({ distributor, items, outstanding, date }) {
  const lines = [
    `🥛 *MILKYFEAST — SALE BILL*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📅 Date: ${date}`,
    `👤 Distributor: ${distributor.name}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `*ITEMS*`,
    ...items.map(i =>
      `• ${i.product_name}  ${i.quantity} ${i.unit}  @Rs.${i.unit_price}  = *Rs.${(i.quantity * i.unit_price).toFixed(2)}*`
    ),
    `━━━━━━━━━━━━━━━━━━━━`,
    `💰 Today: *Rs.${items.reduce((s, i) => s + i.quantity * i.unit_price, 0).toFixed(2)}*`,
    `📋 Outstanding: Rs.${outstanding.total.toFixed(2)}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Thank you! — MilkyFeast 🙏`,
  ]
  return lines.join('\n')
}

// Fallback text salary receipt
export function formatSalaryReceipt({ worker, month, workingDays, gross, paid, remaining }) {
  const lines = [
    `🥛 *MILKYFEAST — SALARY RECEIPT*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 Worker: ${worker.name}`,
    `📅 Month: ${month}`,
    workingDays != null ? `📆 Working Days: ${workingDays}` : '',
    `━━━━━━━━━━━━━━━━━━━━`,
    `💼 Gross: Rs.${gross.toFixed(2)}`,
    `💵 Paid: *Rs.${paid.toFixed(2)}*`,
    remaining > 0 ? `⏳ Remaining: Rs.${remaining.toFixed(2)}` : `✅ Fully Paid`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Thank you! — MilkyFeast 🙏`,
  ].filter(Boolean)
  return lines.join('\n')
}