// src/lib/utils/pdf.js
// Enhanced design with fully dynamic distributor and vehicle information
// Uses jsPDF + jspdf-autotable

import jsPDF from 'jspdf'
import 'jspdf-autotable'

// ── Brand colours ────────────────────────────────────────────
const B = {
  blue900:   [30,  58,  138],
  blue700:   [29,  78,  216],
  blue500:   [37,  99,  235],
  blue100:   [219, 234, 254],
  blue50:    [239, 246, 255],
  slate900:  [15,  23,  42],
  slate700:  [51,  65,  85],
  slate500:  [100, 116, 139],
  slate200:  [226, 232, 240],
  slate100:  [241, 245, 249],
  green700:  [21,  128, 61],
  red700:    [185, 28,  28],
  white:     [255, 255, 255],
}

// ── Load logo ─────────────────────────────────────────────────
async function loadLogo() {
  try {
    const res  = await fetch('/logo.png')
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise(resolve => {
      const r = new FileReader()
      r.onloadend = () => resolve(r.result)
      r.onerror   = () => resolve(null)
      r.readAsDataURL(blob)
    })
  } catch { return null }
}

// Helper function to convert amount to Indian English Words
function numberToIndianWords(num) {
  if (num === 0) return 'Zero'
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  
  function convertLessThanOneThousand(n) {
    let str = ''
    if (n >= 100) {
      str += units[Math.floor(n / 100)] + ' Hundred '
      n %= 100
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' '
      n %= 10
    }
    if (n > 0) {
      str += units[n] + ' '
    }
    return str.trim()
  }

  let amtStr = ''
  let integerPart = Math.floor(num)
  let paisePart = Math.round((num - integerPart) * 100)

  if (integerPart >= 10000000) {
    amtStr += convertLessThanOneThousand(Math.floor(integerPart / 10000000)) + ' Crore '
    integerPart %= 10000000
  }
  if (integerPart >= 100000) {
    amtStr += convertLessThanOneThousand(Math.floor(integerPart / 100000)) + ' Lakh '
    integerPart %= 100000
  }
  if (integerPart >= 1000) {
    amtStr += convertLessThanOneThousand(Math.floor(integerPart / 1000)) + ' Thousand '
    integerPart %= 1000
  }
  if (integerPart > 0) {
    amtStr += convertLessThanOneThousand(integerPart)
  }
  
  amtStr = amtStr.trim() + ' Only'
  
  if (paisePart > 0) {
    amtStr = amtStr.replace(' Only', '') + ' and ' + convertLessThanOneThousand(paisePart) + ' Paise Only'
  }
  return amtStr
}

// ══════════════════════════════════════════════════════════════
// SALE INVOICE — FULLY DYNAMIC with distributor & vehicle info
// ══════════════════════════════════════════════════════════════
export async function generateSaleBillPDF({
  invoiceNo, date, distributor = {}, vehicle = {}, items = [],
  previousOutstanding = 0, totalOutstanding,
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  const displayInvoiceNo = invoiceNo !== null && invoiceNo !== undefined
    ? String(invoiceNo).padStart(5, '0')
    : ''
      
  const itemsTotalSales = items.reduce((s, i) => s + (parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0)), 0)
  const totalAmount = itemsTotalSales + parseFloat(previousOutstanding || 0)
  const baseAmount = itemsTotalSales / 1.05
  const cgstAmount = baseAmount * 0.025
  const sgstAmount = baseAmount * 0.025
  const amountInWords = numberToIndianWords(totalAmount)

  // Styled outer boundary
  doc.setDrawColor(...B.slate200)
  doc.setLineWidth(0.4)
  doc.rect(5, 5, W - 10, H - 10, 'S')

  // Upper divider
  doc.setDrawColor(...B.slate200)
  doc.line(5, 33, W - 5, 33)

  // Logo (attempt to load, fallback to initials)
  try {
    doc.addImage('/logo.png', 'PNG', 10, 8, 22, 16)
  } catch (e) {}

  // Company header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...B.blue900)
  doc.text('Milky Feast Foods', W / 2, 12, { align: 'center' })
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...B.slate700)
  doc.text('Gat no-103, near palakhi mahamarg, Katphal, MIDC Baramati 413102', W / 2, 17, { align: 'center' })
  doc.setTextColor(...B.slate500)
  doc.text('Phone: 9960323127    Email: milkyfeastfoods@gmail.com', W / 2, 21, { align: 'center' })
  
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...B.slate900)
  doc.setFontSize(7.5)
  doc.text('GST No : 27ABYFM8864H1Z8        FSSAI No : 21523084004246        PAN No : ABCDE1234F', W / 2, 26, { align: 'center' })

  // Banner separator
  doc.setDrawColor(...B.slate200)
  doc.line(5, 39, W - 5, 39)
  
  // Document title background
  doc.setFillColor(...B.blue50)
  doc.rect(5.4, 33.4, W - 10.8, 5.2, 'F')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...B.blue900)
  doc.text('Sale Invoice', W / 2, 37, { align: 'center' })

  // Inner dividers
  doc.setDrawColor(...B.slate200)
  doc.line(5, 69, W - 5, 69)
  doc.line(145, 39, 145, 69)

  // ═══════════════════════════════════════════════════════════
  // LEFT SECTION — BUYER DETAILS (fully dynamic)
  // ═══════════════════════════════════════════════════════════
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...B.slate500)
  doc.text('Buyer', 9, 44)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...B.slate900)
  doc.text(String(distributor?.name || '—'), 9, 49)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...B.slate700)
  
  const addressLine1 = distributor?.address || '—'
  const phoneNumber = distributor?.phone ? String(distributor.phone) : '—'
  doc.text(addressLine1, 9, 54)
  doc.text(phoneNumber, 9, 59)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...B.slate500)
  // Dynamic distributor tax details
  const gstText = `GST No : ${distributor?.gst_no || '—'}`
  const fssaiText = `FSSAI No : ${distributor?.fssai_no || '—'}`
  const panText = `PAN No : ${distributor?.pan_no || '—'}`
  doc.text(`${gstText}    ${fssaiText}    ${panText}`, 9, 64)

  // ═══════════════════════════════════════════════════════════
  // RIGHT SECTION — INVOICE METADATA (dynamic)
  // ═══════════════════════════════════════════════════════════
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...B.slate500)
  doc.text('Invoice No', 149, 45)
  doc.text('Invoice Date & Time', 149, 50)
  doc.text('Route', 149, 55)
  doc.text('Transporter', 149, 60)
  doc.text('Vehicle No', 149, 65)

  doc.text(':', 185, 45)
  doc.text(':', 185, 50)
  doc.text(':', 185, 55)
  doc.text(':', 185, 60)
  doc.text(':', 185, 65)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...B.slate900)
  doc.text(displayInvoiceNo, 188, 45)
  
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...B.slate700)
  doc.text(String(date || '—'), 188, 50)
  doc.text(String(distributor?.route || '—'), 188, 55)
  // Transporter name (from vehicle)
  doc.text(String(vehicle?.name || '—'), 188, 60)
  // Vehicle number (registration)
  doc.text(String(vehicle?.vehicle_number || '—'), 188, 65)

  // ═══════════════════════════════════════════════════════════
  // ITEMS TABLE
  // ═══════════════════════════════════════════════════════════
  let totalItemsCount = items.length
  const tableBody = items.map((item, idx) => [
    idx + 1,
    item.product_name || '—',
    '04039090',
    `${parseFloat(item.quantity || 0)} ${item.unit || 'Pouch'}`,
    parseFloat(item.quantity || 0).toFixed(2),
    parseFloat(item.unit_price || 0).toFixed(2),
    (parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)).toFixed(2)
  ])

  tableBody.push(['', 'Product Value', '', '', '', '', baseAmount.toFixed(2)])
  tableBody.push(['', 'CGST OUTPUT @ 2.5%', '', '', '', '', cgstAmount.toFixed(2)])
  tableBody.push(['', 'SGST OUTPUT @ 2.5%', '', '', '', '', sgstAmount.toFixed(2)])
  tableBody.push(['', 'Previous Outstanding Balance', '', '', '', '', parseFloat(previousOutstanding || 0).toFixed(2)])

  const totalPackedQty = items.reduce((s, i) => s + parseFloat(i.quantity || 0), 0).toFixed(2)
  const totalQuantitySum = items.reduce((s, i) => s + parseFloat(i.quantity || 0), 0).toFixed(2)
  tableBody.push(['', '', '', totalPackedQty, totalQuantitySum, '', totalAmount.toFixed(2)])

  const autoTableFunc = doc.autoTable || (doc.jsPDF && doc.jsPDF.autoTable)
  autoTableFunc.call(doc, {
    startY: 69,
    margin: { left: 5, right: 5 },
    head: [['', 'Description of Goods / Service', 'HSN No', 'Packed Qty', 'Quantity', 'Rate', 'Amount']],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: B.slate900,
      font: 'helvetica',
      lineColor: B.slate200,
      lineWidth: 0.3,
    },
    headStyles: {
      fontStyle: 'bold',
      halign: 'center',
      fillColor: B.blue900,
      textColor: B.white
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 25, halign: 'center' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 32, halign: 'right' },
    },
    didParseCell: function(data) {
      if (data.row.index >= totalItemsCount) {
        data.cell.styles.fontStyle = 'bold'
        if (data.row.index === totalItemsCount + 4) {
          data.cell.styles.fillColor = B.blue100
        } else {
          data.cell.styles.fillColor = B.slate100
        }
      }
    }
  })

  let currentY = doc.lastAutoTable?.finalY || 140

  // ═══════════════════════════════════════════════════════════
  // AMOUNT IN WORDS
  // ═══════════════════════════════════════════════════════════
  doc.setDrawColor(...B.slate200)
  doc.line(5, currentY, W - 5, currentY)
  
  doc.setFillColor(...B.slate100)
  doc.rect(5.4, currentY + 0.4, W - 10.8, 8.2, 'F')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...B.slate900)
  doc.text('Amount In Words : Rs. ' + amountInWords, 7, currentY + 5.5)
  
  doc.setDrawColor(...B.slate200)
  doc.line(5, currentY + 9, W - 5, currentY + 9)
  
  currentY += 9

  // ═══════════════════════════════════════════════════════════
  // BOTTOM SECTION — PAYMENT & SIGNATURE
  // ═══════════════════════════════════════════════════════════
  doc.setDrawColor(...B.slate200)
  doc.line(5, H - 15, W - 5, H - 15)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...B.slate900)
  doc.text('Amount Paid : ', 7, H - 9)
  
  doc.setDrawColor(...B.slate200)
  doc.setLineWidth(0.3)
  doc.rect(30, H - 13, 40, 6, 'S')

  doc.setTextColor(...B.slate700)
  doc.text('Dealer Signature', 165, H - 9)
  doc.text('Authorised Signature', W - 48, H - 9)

  return doc
}

// ══════════════════════════════════════════════════════════════
// SALARY RECEIPT (unchanged)
// ══════════════════════════════════════════════════════════════
export async function generateSalaryReceiptPDF({
  receiptNo, month, worker,
  workingDays, grossAmount, paidAmount,
  remainingAmount, paymentStatus,
}) {
  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W        = doc.internal.pageSize.getWidth()
  const H        = doc.internal.pageSize.getHeight()

  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  // Styled outer boundary
  doc.setDrawColor(...B.slate200)
  doc.setLineWidth(0.4)
  doc.rect(5, 5, W - 10, H - 10, 'S')

  doc.setFillColor(...B.blue900)
  doc.rect(0, 0, W, 27, 'F')

  doc.setFillColor(...B.blue500)
  doc.rect(0, 27, W, 3, 'F')

  if (true) { // Logo placeholder
    doc.setFillColor(...B.white)
    doc.roundedRect(10, 6, 18, 14, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...B.blue700)
    doc.text('MF', 19, 15, { align: 'center' })
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...B.white)
  doc.text('MilkyFeast', 33, 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...B.blue100)
  doc.text('Fresh Dairy Products', 33, 20)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...B.white)
  doc.text('SALARY RECEIPT', W - 10, 13, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...B.blue100)
  doc.text(`Receipt No: ${receiptNo}    Date: ${dateStr}`, W - 10, 20, { align: 'right' })

  doc.setDrawColor(...B.blue500)
  doc.setLineWidth(1)
  doc.line(0, 30, W, 30)

  let y = 38

  // Worker details
  doc.setFillColor(...B.blue700)
  doc.rect(10, y, 1.5, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...B.slate900)
  doc.text('WORKER DETAILS', 14, y + 4.5)
  doc.setDrawColor(...B.slate200)
  doc.setLineWidth(0.4)
  doc.line(10, y + 8, W - 10, y + 8)
  y += 14

  const details = [
    ['Worker Name',  worker.name || '—'],
    ['Role',         worker.role || '—'],
    ['Salary Type',  worker.salary_type === 'fixed' ? 'Fixed Monthly' : 'Daily Wage'],
    ['Month',        month],
  ]
  if (workingDays != null) {
    details.push(['Working Days', `${workingDays} days`])
    details.push(['Rate per Day', `Rs. ${(parseFloat(grossAmount) / workingDays).toFixed(2)}`])
  }

  details.forEach(([label, val], i) => {
    doc.setFillColor(...(i % 2 === 0 ? B.white : B.blue50))
    doc.rect(10, y, W - 20, 9, 'F')
    doc.setDrawColor(...B.slate200); doc.setLineWidth(0.3)
    doc.line(10, y, W - 10, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...B.slate500)
    doc.text(label, 14, y + 6)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...B.slate900)
    doc.text(val, 65, y + 6)
    y += 9
  })
  
  y += 10

  doc.setFillColor(...B.blue700)
  doc.rect(10, y, 1.5, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...B.slate900)
  doc.text('PAYMENT BREAKDOWN', 14, y + 4.5)
  doc.setDrawColor(...B.slate200)
  doc.setLineWidth(0.4)
  doc.line(10, y + 8, W - 10, y + 8)
  y += 14

  const payRows = [
    { label: workingDays ? `Gross Salary (${workingDays} days × Rs.${(parseFloat(grossAmount)/workingDays).toFixed(2)})` : 'Gross Salary', val: parseFloat(grossAmount), color: B.slate900, bold: false },
    { label: 'Deductions',       val: 0,                                                                                           color: B.slate500, bold: false },
    { label: 'Net Payable',      val: parseFloat(grossAmount),                                                                     color: B.white,    bold: true,  blue: true },
    { label: 'Amount Paid',      val: parseFloat(paidAmount),                                                                      color: B.green700, bold: true  },
    { label: 'Balance Remaining',val: parseFloat(remainingAmount || 0),   color: parseFloat(remainingAmount || 0) > 0 ? B.red700 : B.green700, bold: false },
  ]

  payRows.forEach(row => {
    doc.setFillColor(...(row.blue ? B.blue700 : B.white))
    doc.rect(10, y, W - 20, 10, 'F')
    doc.setDrawColor(...B.slate200); doc.setLineWidth(0.3)
    doc.line(10, y, W - 10, y)
    doc.setFont('helvetica', row.bold ? 'bold' : 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...(row.blue ? B.white : B.slate500))
    doc.text(row.label, 14, y + 7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(row.blue ? B.white : row.color))
    doc.text(`Rs. ${row.val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, W - 12, y + 7, { align: 'right' })
    y += 10
  })
  
  y += 12

  const statusColor = paymentStatus === 'paid' ? B.green700 : paymentStatus === 'partial' ? [146, 64, 14] : B.red700
  const statusLabel = paymentStatus === 'paid' ? 'PAID IN FULL  ✓' : paymentStatus === 'partial' ? 'PARTIAL PAYMENT' : 'PAYMENT PENDING'
  doc.setFillColor(...statusColor)
  doc.roundedRect(W / 2 - 35, y, 70, 13, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...B.white)
  doc.text(statusLabel, W / 2, y + 9, { align: 'center' })
  
  y += 22

  doc.setDrawColor(...B.slate500)
  doc.setLineWidth(0.5)
  doc.line(12, y + 18, 72, y + 18)
  doc.line(W - 72, y + 18, W - 12, y + 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...B.slate500)
  doc.text('Employee Signature', 42, y + 24, { align: 'center' })
  doc.text(worker.name || '', 42, y + 29, { align: 'center' })
  doc.text('Authorised Signatory', W - 42, y + 24, { align: 'center' })
  doc.text('MilkyFeast Management', W - 42, y + 29, { align: 'center' })

  doc.setDrawColor(...B.slate200)
  doc.setLineWidth(0.4)
  doc.line(10, H - 16, W - 10, H - 16)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...B.slate500)
  doc.text('MilkyFeast', 10, H - 11)
  doc.text('Computer generated receipt — Valid without signature', W / 2, H - 11, { align: 'center' })
  doc.text('Page 1 of 1', W - 10, H - 11, { align: 'right' })

  return doc
}

// ══════════════════════════════════════════════════════════════
// PAYMENT RECEIPT (unchanged)
// ══════════════════════════════════════════════════════════════
export async function generatePaymentReceiptPDF({
  receiptNo, date, distributor,
  amount, paymentMode, referenceNo, notes,
}) {
  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W        = doc.internal.pageSize.getWidth()
  const H        = doc.internal.pageSize.getHeight()

  const colW = (W - 30) / 2

  // FROM box
  doc.setFillColor(...B.slate100)
  doc.roundedRect(12, 30, colW, 26, 1.5, 1.5, 'F')
  doc.setDrawColor(...B.slate200); doc.setLineWidth(0.4)
  doc.roundedRect(12, 30, colW, 26, 1.5, 1.5, 'S')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...B.blue700)
  doc.text('RECEIVED BY', 16, 35)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...B.slate900)
  doc.text('MilkyFeast Dairy', 16, 41)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...B.slate700)
  doc.text('Korti, Maharashtra', 16, 46)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...B.slate500)
  doc.text('GSTIN: 27XXXXX1234Z1', 16, 51)

  // TO box
  const bx = 18 + colW
  doc.setFillColor(...B.blue50)
  doc.roundedRect(bx, 30, colW, 26, 1.5, 1.5, 'F')
  doc.setDrawColor(...B.blue100); doc.setLineWidth(0.4)
  doc.roundedRect(bx, 30, colW, 26, 1.5, 1.5, 'S')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...B.blue700)
  doc.text('RECEIVED FROM', bx + 5, 35)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...B.slate900)
  doc.text(distributor?.name || '—', bx + 5, 41)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...B.slate700)
  if (distributor?.route) doc.text(`Route: ${distributor.route}`, bx + 5, 46)
  if (distributor?.phone) doc.text(`Phone: ${distributor.phone}`, bx + 5, 51)

  let y = 70

  doc.setFillColor(...B.blue700)
  doc.rect(10, y, 1.5, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...B.slate900)
  doc.text('PAYMENT DETAILS', 14, y + 4.5)
  doc.setDrawColor(...B.slate200)
  doc.setLineWidth(0.4)
  doc.line(10, y + 8, W - 10, y + 8)
  y += 14

  const details = [
    ['Payment Mode',   paymentMode ? paymentMode.charAt(0).toUpperCase() + paymentMode.slice(1) : '—'],
    ['Reference No.',  referenceNo || '—'],
    ['Notes',          notes || '—'],
    ['Receipt Date',   date],
  ]

  details.forEach(([label, val], i) => {
    doc.setFillColor(...(i % 2 === 0 ? B.white : B.slate100))
    doc.rect(12, y, W - 24, 9, 'F')
    doc.setDrawColor(...B.slate200); doc.setLineWidth(0.3)
    doc.line(12, y, W - 12, y)
    doc.line(12, y + 9, W - 12, y + 9)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...B.slate500)
    doc.text(label, 16, y + 6)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...B.slate900)
    doc.text(String(val), 65, y + 6)
    y += 9
  })

  y += 10

  doc.setFillColor(...B.blue700)
  doc.rect(10, y, 1.5, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...B.slate900)
  doc.text('AMOUNT RECEIVED', 14, y + 4.5)
  doc.setDrawColor(...B.slate200)
  doc.setLineWidth(0.4)
  doc.line(10, y + 8, W - 10, y + 8)
  y += 14

  doc.setFillColor(...B.green700)
  doc.roundedRect(12, y, W - 24, 22, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...B.white)
  doc.text('AMOUNT RECEIVED', W / 2, y + 7, { align: 'center' })
  doc.setFontSize(22)
  doc.text(
    `Rs. ${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    W / 2, y + 17, { align: 'center' }
  )

  y += 30

  doc.setFillColor(...B.blue50)
  doc.roundedRect(12, y, W - 24, 20, 1.5, 1.5, 'F')
  doc.setDrawColor(...B.blue100); doc.setLineWidth(0.4)
  doc.roundedRect(12, y, W - 24, 20, 1.5, 1.5, 'S')
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(...B.slate700)
  doc.text(
    `We acknowledge receipt of Rs. ${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    W / 2, y + 7, { align: 'center' }
  )
  doc.text(
    `from ${distributor?.name || 'the distributor'} towards outstanding dues.`,
    W / 2, y + 12.5, { align: 'center' }
  )
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...B.slate500)
  doc.text('For queries: accounts@milkyfeast.com', W / 2, y + 17, { align: 'center' })

  const sigY = H - 35 
  doc.setDrawColor(...B.slate500)
  doc.setLineWidth(0.4)
  doc.line(14, sigY, 74, sigY)
  doc.line(W - 74, sigY, W - 14, sigY)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...B.slate700)
  doc.text('Distributor Signature', 44, sigY + 5, { align: 'center' })
  doc.setFont('helvetica', 'italic'); doc.setTextColor(...B.slate500)
  doc.text(distributor?.name || '', 44, sigY + 10, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...B.slate700)
  doc.text('Authorised Signatory', W - 44, sigY + 5, { align: 'center' })
  doc.setFont('helvetica', 'italic'); doc.setTextColor(...B.slate500)
  doc.text('MilkyFeast Management', W - 44, sigY + 10, { align: 'center' })

  doc.setDrawColor(...B.slate200)
  doc.setLineWidth(0.4)
  doc.line(10, H - 16, W - 10, H - 16)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...B.slate500)
  doc.text('MilkyFeast', 10, H - 11)
  doc.text('Computer generated receipt — Valid without signature', W / 2, H - 11, { align: 'center' })
  doc.text('Page 1 of 1', W - 10, H - 11, { align: 'right' })

  return doc
}

// ── Invoice number ────────────────────────────────────────────
export function generateInvoiceNo(prefix = 'MF') {
  const now  = new Date()
  const dd   = String(now.getDate()).padStart(2, '0')
  const mm   = String(now.getMonth() + 1).padStart(2, '0')
  const yy   = String(now.getFullYear()).slice(-2)
  const rand = Math.floor(Math.random() * 900) + 100
  return `${prefix}-${yy}${mm}${dd}-${rand}`
}

// ── Share via WhatsApp ────────────────────────────────────────
export function sharePDFViaWhatsApp(doc, phone, filename, distributorName) {
  doc.save(filename)

  if (phone) {
    const cleaned = phone.replace(/\D/g, '')
    const number  = cleaned.startsWith('91') ? cleaned : `91${cleaned}`
    const msg     = encodeURIComponent(
      `Dear ${distributorName || 'Sir/Ma\'am'},\n\nPlease find your invoice from MilkyFeast attached.\n\nThank you for your business!\n— MilkyFeast Team`
    )
    setTimeout(() => {
      window.open(`https://wa.me/${number}?text=${msg}`, '_blank')
    }, 600)
  }
}

// ── Open PDF in new tab (preview) ────────────────────────────
export function openPDFInTab(doc) {
  const blob = doc.output('blob')
  const url  = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 120000)
}

// ── Download PDF ──────────────────────────────────────────────
export function downloadPDF(doc, filename) {
  doc.save(filename)
}

// ── Open and Share ──────────────────────────────────────────────
export function openPDFAndShareWhatsApp(doc, phone, title) {
  openPDFInTab(doc)
  if (phone) {
    const cleaned = phone.replace(/\D/g, '')
    const number  = cleaned.startsWith('91') ? cleaned : `91${cleaned}`
    const msg     = encodeURIComponent(`${title} from MilkyFeast`)
    setTimeout(() => {
      window.open(`https://wa.me/${number}?text=${msg}`, '_blank')
    }, 800)
  }
}

// Kept for backwards compatibility
export async function shareOrDownloadPDF(doc, filename) {
  const blob = doc.output('blob')
  const file = new File([blob], filename, { type: 'application/pdf' })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'MilkyFeast' })
      return
    } catch (err) {
      if (err.name === 'AbortError') return
    }
  }
  doc.save(filename)
}