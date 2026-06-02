// src/lib/utils/pdf.js
// Professional blue-themed PDF generator for MilkyFeast
// Matches the demo PDFs exactly (no orange anywhere)
// Uses jsPDF + jspdf-autotable (already in package.json)

import jsPDF from 'jspdf'
import 'jspdf-autotable'

// ── Brand colours (blue theme) ────────────────────────────────
const B = {
  blue900:  [30,  58,  138],   // #1e3a8a  — header dark navy
  blue700:  [29,  78,  216],   // #1d4ed8  — primary
  blue500:  [37,  99,  235],   // #2563eb  — accent
  blue100:  [219, 234, 254],   // #dbeafe  — light bg
  blue50:   [239, 246, 255],   // #eff6ff  — alt row
  slate900: [15,  23,  42],    // #0f172a  — dark text
  slate700: [51,  65,  85],    // #334155  — body text
  slate500: [100, 116, 139],   // #64748b  — muted
  slate200: [226, 232, 240],   // #e2e8f0  — border
  slate100: [241, 245, 249],   // #f1f5f9  — light bg
  green700: [21,  128, 61],    // #15803d
  red700:   [185, 28,  28],    // #b91c1c
  white:    [255, 255, 255],
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

// ── Draw header ───────────────────────────────────────────────
async function drawHeader(doc, logoData, title, invoiceNo, dateStr) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // White page background
  doc.setFillColor(...B.white)
  doc.rect(0, 0, W, H, 'F')

  // Blue accent stripe at top
  doc.setFillColor(...B.blue500)
  doc.rect(0, H - 3, W, 3, 'F')

  // Dark navy header band
  doc.setFillColor(...B.blue900)
  doc.rect(0, H - 30, W, 27, 'F')

  // Logo box (white rect so transparent logo shows correctly)
  if (logoData) {
    doc.setFillColor(...B.white)
    doc.roundedRect(10, H - 24, 18, 14, 2, 2, 'F')
    doc.addImage(logoData, 'PNG', 11, H - 23, 16, 12)
  } else {
    // Fallback: white box with MF initials
    doc.setFillColor(...B.white)
    doc.roundedRect(10, H - 24, 18, 14, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...B.blue700)
    doc.text('MF', 19, H - 14, { align: 'center' })
  }

  // Company name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...B.white)
  doc.text('MilkyFeast', 33, H - 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...B.blue100)
  doc.text('Fresh Dairy Products  |  milkyfeast.com', 33, H - 13)

  // Invoice type + number (right)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...B.white)
  doc.text(title, W - 10, H - 20, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...B.blue100)
  doc.text(`Invoice No: ${invoiceNo}    Date: ${dateStr}`, W - 10, H - 13, { align: 'right' })

  // Separator line
  doc.setDrawColor(...B.blue500)
  doc.setLineWidth(1)
  doc.line(0, H - 30, W, H - 30)

  return H - 38  // starting Y for content
}

// ── Section title ─────────────────────────────────────────────
function sectionTitle(doc, text, y) {
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(...B.blue700)
  doc.rect(10, y - 1, 1.5, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...B.slate900)
  doc.text(text.toUpperCase(), 14, y + 3.5)
  doc.setDrawColor(...B.slate200)
  doc.setLineWidth(0.4)
  doc.line(10, y - 2, W - 10, y - 2)
  return y - 10
}

// ── Footer ────────────────────────────────────────────────────
function drawFooter(doc, note) {
  const W = doc.internal.pageSize.getWidth()
  doc.setDrawColor(...B.slate200)
  doc.setLineWidth(0.4)
  doc.line(10, 16, W - 10, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...B.slate500)
  doc.text('MilkyFeast', 10, 11)
  doc.text(note, W / 2, 11, { align: 'center' })
  doc.text('Page 1 of 1', W - 10, 11, { align: 'right' })
}

// ══════════════════════════════════════════════════════════════
// SALE INVOICE
// ══════════════════════════════════════════════════════════════
export async function generateSaleBillPDF({
  invoiceNo, date, distributor, items,
  previousOutstanding = 0, totalOutstanding,
}) {
  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W        = doc.internal.pageSize.getWidth()
  const logoData = await loadLogo()

  let y = await drawHeader(doc, logoData, 'SALE INVOICE', invoiceNo, date)

  // ── FROM / TO ─────────────────────────────────────────
  const colW = (W - 28) / 2

  // FROM box
  doc.setFillColor(...B.blue50)
  doc.roundedRect(10, y - 22, colW, 24, 2, 2, 'F')
  doc.setDrawColor(...B.slate200); doc.setLineWidth(0.3)
  doc.roundedRect(10, y - 22, colW, 24, 2, 2, 'S')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...B.blue700)
  doc.text('FROM', 14, y - 17)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...B.slate900)
  doc.text('MilkyFeast Dairy', 14, y - 11)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...B.slate500)
  doc.text('Korti, Maharashtra', 14, y - 6)
  doc.text('GSTIN: 27XXXXX1234Z1', 14, y - 1)

  // TO box
  const bx = 18 + colW
  doc.setFillColor(...B.blue50)
  doc.roundedRect(bx, y - 22, colW, 24, 2, 2, 'F')
  doc.roundedRect(bx, y - 22, colW, 24, 2, 2, 'S')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...B.blue700)
  doc.text('BILL TO', bx + 4, y - 17)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...B.slate900)
  doc.text(distributor.name || '—', bx + 4, y - 11)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...B.slate500)
  if (distributor.route) doc.text(`Route: ${distributor.route}`, bx + 4, y - 6)
  if (distributor.phone) doc.text(`Phone: ${distributor.phone}`, bx + 4, y - 1)
  y -= 30

  // ── ITEMS TABLE ───────────────────────────────────────
  y = sectionTitle(doc, 'Items', y)

  const todayTotal = items.reduce((s, i) => s + parseFloat(i.quantity) * parseFloat(i.unit_price), 0)
  const tOut       = totalOutstanding ?? todayTotal + parseFloat(previousOutstanding || 0)

  doc.autoTable({
    startY: y,
    head: [['#', 'Product / Description', 'Qty', 'Unit', 'Unit Price', 'Amount']],
    body: items.map((item, i) => [
      i + 1,
      item.product_name || '—',
      parseFloat(item.quantity).toLocaleString('en-IN'),
      item.unit || '',
      `Rs. ${parseFloat(item.unit_price).toFixed(2)}`,
      `Rs. ${(parseFloat(item.quantity) * parseFloat(item.unit_price)).toFixed(2)}`,
    ]),
    foot: [['', '', '', '', 'Subtotal', `Rs. ${todayTotal.toFixed(2)}`]],
    theme: 'plain',
    margin: { left: 10, right: 10 },
    styles: {
      fontSize: 9, cellPadding: 3.5,
      textColor: B.slate700, font: 'helvetica',
      lineColor: B.slate200, lineWidth: 0.3,
    },
    headStyles: {
      fillColor: B.blue700, textColor: B.white,
      fontStyle: 'bold', fontSize: 9, lineWidth: 0,
    },
    alternateRowStyles: { fillColor: B.blue50 },
    footStyles: {
      fillColor: B.slate100, textColor: B.slate900,
      fontStyle: 'bold', fontSize: 9,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 68 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'right',  cellWidth: 28 },
      5: { halign: 'right',  cellWidth: 30 },
    },
  })

  y = doc.lastAutoTable.finalY + 6

  // Grand total row (full width blue)
  doc.setFillColor(...B.blue700)
  doc.rect(10, y, W - 20, 9, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...B.white)
  doc.text('TOTAL DUE', W - 46, y + 6, { align: 'right' })
  doc.text(`Rs. ${todayTotal.toFixed(2)}`, W - 11, y + 6, { align: 'right' })
  y += 14

  // ── PAYMENT SUMMARY BOX ───────────────────────────────
  y = sectionTitle(doc, 'Payment Summary', y)

  const summaryRows = [
    { label: "Today's Invoice Amount",  val: todayTotal,                    bg: B.white    },
    { label: 'Previous Outstanding',    val: parseFloat(previousOutstanding || 0), bg: B.blue50 },
    { label: 'Total Amount Due',        val: tOut,                          bg: B.blue700, white: true },
  ]
  const bxS = W - 10 - 82
  summaryRows.forEach(row => {
    doc.setFillColor(...row.bg)
    doc.rect(bxS, y, 82, 9, 'F')
    doc.setDrawColor(...B.slate200); doc.setLineWidth(0.3)
    doc.line(bxS, y, bxS + 82, y)
    doc.setFont('helvetica', row.white ? 'bold' : 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...(row.white ? B.white : B.slate700))
    doc.text(row.label, bxS + 3, y + 6)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(row.white ? B.white : B.slate900))
    doc.text(`Rs. ${row.val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, bxS + 79, y + 6, { align: 'right' })
    y += 9
  })
  y += 8

  // ── NOTE ──────────────────────────────────────────────
  doc.setFillColor(...B.blue50)
  doc.roundedRect(10, y, W - 20, 14, 2, 2, 'F')
  doc.setDrawColor(...B.slate200); doc.setLineWidth(0.3)
  doc.roundedRect(10, y, W - 20, 14, 2, 2, 'S')
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(...B.slate500)
  doc.text('Payment due within 7 days. Thank you for your business!', W / 2, y + 5.5, { align: 'center' })
  doc.text('For queries: accounts@milkyfeast.com', W / 2, y + 10.5, { align: 'center' })

  drawFooter(doc, 'This is a computer-generated invoice and is valid without a physical signature.')
  return doc
}



// ══════════════════════════════════════════════════════════════
// SALARY RECEIPT
// ══════════════════════════════════════════════════════════════
export async function generateSalaryReceiptPDF({
  receiptNo, month, worker,
  workingDays, grossAmount, paidAmount,
  remainingAmount, paymentStatus,
}) {
  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W        = doc.internal.pageSize.getWidth()
  const logoData = await loadLogo()

  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  let y = await drawHeader(doc, logoData, 'SALARY RECEIPT', receiptNo, dateStr)

  // ── WORKER DETAILS ────────────────────────────────────
  y = sectionTitle(doc, 'Worker Details', y)

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

  // ── PAYMENT BREAKDOWN ─────────────────────────────────
  y = sectionTitle(doc, 'Payment Breakdown', y)

  const payRows = [
    { label: workingDays ? `Gross Salary (${workingDays} days × Rs.${(parseFloat(grossAmount)/workingDays).toFixed(2)})` : 'Gross Salary', val: parseFloat(grossAmount), color: B.slate900, bold: false },
    { label: 'Deductions',       val: 0,                                  color: B.slate500, bold: false },
    { label: 'Net Payable',      val: parseFloat(grossAmount),            color: B.white,    bold: true,  blue: true },
    { label: 'Amount Paid',      val: parseFloat(paidAmount),             color: B.green700, bold: true  },
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

  // ── STATUS BADGE ──────────────────────────────────────
  const statusColor = paymentStatus === 'paid' ? B.green700 : paymentStatus === 'partial' ? [146, 64, 14] : B.red700
  const statusLabel = paymentStatus === 'paid' ? 'PAID IN FULL  ✓' : paymentStatus === 'partial' ? 'PARTIAL PAYMENT' : 'PAYMENT PENDING'
  doc.setFillColor(...statusColor)
  doc.roundedRect(W / 2 - 35, y, 70, 13, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...B.white)
  doc.text(statusLabel, W / 2, y + 9, { align: 'center' })
  y += 22

  // ── SIGNATURE BLOCK ───────────────────────────────────
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

  drawFooter(doc, 'This is a computer-generated salary receipt. Valid without physical signature.')
  return doc
}

// ══════════════════════════════════════════════════════════════
// PAYMENT RECEIPT  — add this to src/lib/utils/pdf.js
// (paste after the generateSaleBillPDF export, before generateInvoiceNo)
// ══════════════════════════════════════════════════════════════
export async function generatePaymentReceiptPDF({
  receiptNo, date, distributor,
  amount, paymentMode, referenceNo, notes,
}) {
  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W        = doc.internal.pageSize.getWidth()
  const logoData = await loadLogo()

  let y = await drawHeader(doc, logoData, 'PAYMENT RECEIPT', receiptNo, date)

  // ── FROM / TO boxes ───────────────────────────────────
  const colW = (W - 30) / 2

  // FROM box
  doc.setFillColor(...B.slate100)
  doc.roundedRect(12, y, colW, 26, 1.5, 1.5, 'F')
  doc.setDrawColor(...B.slate200); doc.setLineWidth(0.4)
  doc.roundedRect(12, y, colW, 26, 1.5, 1.5, 'S')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...B.blue700)
  doc.text('RECEIVED BY', 16, y + 5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...B.slate900)
  doc.text('MilkyFeast Dairy', 16, y + 11)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...B.slate700)
  doc.text('Korti, Maharashtra', 16, y + 16)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...B.slate500)
  doc.text('GSTIN: 27XXXXX1234Z1', 16, y + 21)

  // TO box
  const bx = 18 + colW
  doc.setFillColor(...B.blue50)
  doc.roundedRect(bx, y, colW, 26, 1.5, 1.5, 'F')
  doc.setDrawColor(...B.blue100); doc.setLineWidth(0.4)
  doc.roundedRect(bx, y, colW, 26, 1.5, 1.5, 'S')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...B.blue700)
  doc.text('RECEIVED FROM', bx + 5, y + 5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...B.slate900)
  doc.text(distributor?.name || '—', bx + 5, y + 11)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...B.slate700)
  if (distributor?.route) doc.text(`Route: ${distributor.route}`, bx + 5, y + 16)
  if (distributor?.phone) doc.text(`Phone: ${distributor.phone}`, bx + 5, y + 21)

  y += 34

  // ── PAYMENT DETAILS ───────────────────────────────────
  y = sectionTitle(doc, 'Payment Details', y)

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

  // ── AMOUNT BOX — large, prominent ─────────────────────
  y = sectionTitle(doc, 'Amount Received', y)

  // Big green amount banner
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

  // ── ACKNOWLEDGEMENT NOTE ──────────────────────────────
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

  y += 28

  // ── SIGNATURE BLOCK ───────────────────────────────────
  const H   = doc.internal.pageSize.getHeight()
  const sigY = H - 55
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

  drawFooter(doc, 'This is a computer-generated payment receipt. Valid without physical signature.')
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
// WhatsApp Web/App does NOT support sending files programmatically.
// The best approach is:
//   1. Download PDF to device
//   2. Open WhatsApp chat with phone number
//   3. User manually attaches the downloaded PDF
// This function does exactly that in one click.
export function sharePDFViaWhatsApp(doc, phone, filename, distributorName) {
  // Step 1: trigger PDF download
  doc.save(filename)

  // Step 2: after short delay, open WhatsApp with instruction message
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

  // Desktop fallback
  doc.save(filename)
}
    
