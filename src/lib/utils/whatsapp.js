// src/lib/utils/whatsapp.js

/**
 * Generate a wa.me link to open WhatsApp chat with pre-filled message
 * @param {string} phone  - Indian mobile number (10 digits or with +91)
 * @param {string} message - Text to pre-fill
 */
export function getWhatsAppLink(phone, message) {
  const cleaned = phone.replace(/\D/g, '')
  const number  = cleaned.startsWith('91') ? cleaned : `91${cleaned}`
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

/**
 * Format a distributor sale bill as plain text for WhatsApp
 * @param {object} params
 */
export function formatDistributorBill({ distributor, items, outstanding, date }) {
  const lines = [
    `🥛 *DAIRY ERP — SALE BILL*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📅 Date: ${date}`,
    `👤 Distributor: ${distributor.name}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `*ITEMS*`,
    ...items.map(i =>
      `• ${i.product_name}  ${i.quantity} ${i.unit}  @₹${i.unit_price}  = *₹${(i.quantity * i.unit_price).toFixed(2)}*`
    ),
    `━━━━━━━━━━━━━━━━━━━━`,
    `💰 Today's Bill: *₹${items.reduce((s, i) => s + i.quantity * i.unit_price, 0).toFixed(2)}*`,
    `📋 Previous Outstanding: ₹${outstanding.previous.toFixed(2)}`,
    `✅ Total Outstanding: *₹${outstanding.total.toFixed(2)}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Thank you! 🙏`,
  ]
  return lines.join('\n')
}

/**
 * Format a worker salary receipt as plain text for WhatsApp
 */
export function formatSalaryReceipt({ worker, month, workingDays, gross, paid, remaining }) {
  const lines = [
    `🥛 *DAIRY ERP — SALARY RECEIPT*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 Worker: ${worker.name}`,
    `📅 Month: ${month}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    workingDays != null ? `📆 Working Days: ${workingDays}` : '',
    `💼 Gross Salary: ₹${gross.toFixed(2)}`,
    `💵 Amount Paid: *₹${paid.toFixed(2)}*`,
    remaining > 0 ? `⏳ Remaining: ₹${remaining.toFixed(2)}` : `✅ Fully Paid`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Thank you! 🙏`,
  ].filter(Boolean)
  return lines.join('\n')
}