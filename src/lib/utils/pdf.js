// src/lib/utils/pdf.js
// Professional blue-themed PDF generator for MilkyFeast
// Matches the demo PDFs exactly (no orange anywhere)
// Uses jsPDF + jspdf-autotable (already in package.json)

import jsPDF from 'jspdf'
import 'jspdf-autotable'

// ── Brand colours (blue theme) ────────────────────────────────
const B = {
  blue900:  [30,  58,  138],   // #1e3a8a — header dark navy
  blue700:  [29,  78,  216],   // #1d4ed8 — primary
  blue500:  [37,  99,  235],   // #2563eb — accent
  blue100:  [219, 234, 254],   // #dbeafe — light bg
  blue50:   [239, 246, 255],   // #eff6ff — alt row
  slate900: [15,  23,  42],    // #0f172a — dark text
  slate700: [51,  65,  85],    // #334155 — body text
  slate500: [100, 116, 139],   // #64748b — muted
  slate200: [226, 232, 240],   // #e2e8f0 — border
  slate100: [241, 245, 249],   // #f1f5f9 — light bg
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
      r.onerror  = () => resolve(null)
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

  // Dark navy header band at the TOP of the page
  doc.setFillColor(...B.blue900)
  doc.rect(0, 0, W, 35, 'F')

  // Accent stripe directly underneath the navy band
  doc.setFillColor(...B.blue500)
  doc.rect(0, 35, W, 1.5, 'F')

  // Logo box (white rect so transparent logo shows correctly)
  if (logoData) {
    doc.setFillColor(...B.white)
    doc.roundedRect(12, 8, 22, 18, 1, 1, 'F')
    doc.addImage(logoData, 'PNG', 14, 10, 18, 14)
  } else {
    // Fallback: white box with MF initials
    doc.setFillColor(...B.white)
    doc.roundedRect(12, 8, 22, 18, 1, 1, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...B.blue700)
    doc.text('MF', 23, 20, { align: 'center' })
  }

  // Company name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...B.white)
  doc.text('MilkyFeast', 40, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...B.blue100)
  doc.text('Fresh Dairy Products  |  milkyfeast.com', 40, 24)

  // Invoice type + number (right aligned)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...B.white)
  doc.text(title, W - 12, 16, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...B.blue100)
  doc.text(`No: ${invoiceNo}`, W - 12, 22, { align: 'right' })
  doc.text(`Date: ${dateStr}`, W - 12, 27, { align: 'right' })

  return 48  // starting Y position for content underneath header
}

// ── Section title ─────────────────────────────────────────────
function sectionTitle(doc, text, y) {
  const W = doc.internal.pageSize.getWidth()
  
  // Left border indicator bar
  doc.setFillColor(...B.blue700)
  doc.rect(12, y, 2.5, 5, 'F')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...B.slate900)
  doc.text(text.toUpperCase(), 18, y + 4)
  
  // Clean underline divider
  doc.setDrawColor(...B.slate200)
  doc.setLineWidth(0.5)
  doc.line(12, y + 7, W - 12, y + 7)
  
  return y + 13
}

// ── Footer ────────────────────────────────────────────────────
function drawFooter(doc, note) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  
  doc.setDrawColor(...B.slate200)
  doc.setLineWidth(0.5)
  doc.line(12, H - 18, W - 12, H - 18)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...B.slate700)
  doc.text('MilkyFeast', 12, H - 12)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...B.slate500)
  doc.text(note, W / 2, H - 12, { align: 'center' })
  doc.text('Page 1 of 1', W - 12, H - 12, { align: 'right' })
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
  const colW = (W - 30) / 2

  // FROM box
  doc.setFillColor(...B.slate100)
  doc.roundedRect(12, y, colW, 26, 1.5, 1.5, 'F')
  doc.setDrawColor(...B.slate200); doc.setLineWidth(0.4)
  doc.roundedRect(12, y, colW, 26, 1.5, 1.5, 'S')
  
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...B.blue700)
  doc.text('FROM', 16, y + 5)
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
  doc.text('BILL TO', bx + 5, y + 5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...B.slate900)
  doc.text(distributor.name || '—', bx + 5, y + 11)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...B.slate700)
  if (distributor.route) doc.text(`Route: ${distributor.route}`, bx + 5, y + 16)
  if (distributor.phone) doc.text(`Phone: ${distributor.phone}`, bx + 5, y + 21)
  
  y += 34

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
    theme: 'striped',
    margin: { left: 12, right: 12 },
    styles: {
      fontSize: 9, cellPadding: 4,
      textColor: B.slate700, font: 'helvetica',
      lineColor: B.slate200, lineWidth: 0.1,
    },
    headStyles: {
      fillColor: B.blue700, textColor: B.white,
      fontStyle: 'bold', fontSize: 9, lineWidth: 0,
    },
    alternateRowStyles: { fillColor: B.blue50 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 68 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'right',  cellWidth: 28 },
      5: { halign: 'right',  cellWidth: 36 },
    },
  })

  y = doc.lastAutoTable.finalY + 6

  // ── PAYMENT SUMMARY BOX ───────────────────────────────
  y = sectionTitle(doc, 'Payment Summary', y)

  const summaryRows = [
    { label: "Today's Invoice Amount",  val: todayTotal,            bg: B.white    },
    { label: 'Previous Outstanding',    val: parseFloat(previousOutstanding || 0), bg: B.slate100 },
    { label: 'Total Amount Due',        val: tOut,                        bg: B.blue700, white: true },
  ]
  
  const boxWidth = 85
  const bxS = W - 12 - boxWidth
  
  summaryRows.forEach(row => {
    doc.setFillColor(...row.bg)
    doc.rect(bxS, y, boxWidth, 9, 'F')
    doc.setDrawColor(...B.slate200); doc.setLineWidth(0.4)
    doc.rect(bxS, y, boxWidth, 9, 'S')
    
    doc.setFont('helvetica', row.white ? 'bold' : 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...(row.white ? B.white : B.slate700))
    doc.text(row.label, bxS + 4, y + 6)
    
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(row.white ? B.white : B.slate900))
    doc.text(`Rs. ${row.val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, bxS + boxWidth - 4, y + 6, { align: 'right' })
    y += 9
  })
  
  y += 10

  // ── NOTE ──────────────────────────────────────────────
  doc.setFillColor(...B.blue50)
  doc.roundedRect(12, y, W - 24, 16, 1.5, 1.5, 'F')
  doc.setDrawColor(...B.blue100); doc.setLineWidth(0.4)
  doc.roundedRect(12, y, W - 24, 16, 1.5, 1.5, 'S')
  
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(...B.slate700)
  doc.text('Payment due within 7 days. Thank you for your business!', W / 2, y + 6.5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...B.slate500)
  doc.text('For queries: accounts@milkyfeast.com', W / 2, y + 11.5, { align: 'center' })

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
    doc.setFillColor(...(i % 2 === 0 ? B.white : B.slate100))
    doc.rect(12, y, W - 24, 9, 'F')
    doc.setDrawColor(...B.slate200); doc.setLineWidth(0.3)
    doc.line(12, y, W - 12, y)
    doc.line(12, y + 9, W - 12, y + 9)
    
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...B.slate500)
    doc.text(label, 16, y + 6)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...B.slate900)
    doc.text(val, 65, y + 6)
    y += 9
  })
  
  y += 12

  // ── PAYMENT BREAKDOWN ─────────────────────────────────
  y = sectionTitle(doc, 'Payment Breakdown', y)

  const payRows = [
    { label: workingDays ? `Gross Salary (${workingDays} days × Rs.${(parseFloat(grossAmount)/workingDays).toFixed(2)})` : 'Gross Salary', val: parseFloat(grossAmount), color: B.slate900, bold: false },
    { label: 'Deductions',       val: 0,                                  color: B.slate500, bold: false },
    { label: 'Net Payable',      val: parseFloat(grossAmount),            color: B.white,    bold: true,  blue: true },
    { label: 'Amount Paid',      val: parseFloat(paidAmount),              color: B.green700, bold: true  },
    { label: 'Balance Remaining',val: parseFloat(remainingAmount || 0),   color: parseFloat(remainingAmount || 0) > 0 ? B.red700 : B.green700, bold: true },
  ]

  payRows.forEach(row => {
    doc.setFillColor(...(row.blue ? B.blue700 : B.white))
    doc.rect(12, y, W - 24, 10, 'F')
    doc.setDrawColor(...B.slate200); doc.setLineWidth(0.3)
    doc.line(12, y, W - 12, y)
    doc.line(12, y + 10, W - 12, y + 10)
    
    doc.setFont('helvetica', row.bold ? 'bold' : 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...(row.blue ? B.white : B.slate700))
    doc.text(row.label, 16, y + 6.5)
    
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(row.blue ? B.white : row.color))
    doc.text(`Rs. ${row.val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, W - 16, y + 6.5, { align: 'right' })
    y += 10
  })
  
  y += 14

  // ── STATUS BADGE ──────────────────────────────────────
  const statusColor = paymentStatus === 'paid' ? B.green700 : paymentStatus === 'partial' ? [146, 64, 14] : B.red700
  const statusLabel = paymentStatus === 'paid' ? 'PAID IN FULL  ✓' : paymentStatus === 'partial' ? 'PARTIAL PAYMENT' : 'PAYMENT PENDING'
  
  doc.setFillColor(...statusColor)
  doc.roundedRect(W / 2 - 35, y, 70, 11, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...B.white)
  doc.text(statusLabel, W / 2, y + 7.5, { align: 'center' })
  
  y += 20

  // ── SIGNATURE BLOCK ───────────────────────────────────
  const H = doc.internal.pageSize.getHeight()
  const sigY = H - 55
  
  doc.setDrawColor(...B.slate500)
  doc.setLineWidth(0.4)
  doc.line(14, sigY, 74, sigY)
  doc.line(W - 74, sigY, W - 14, sigY)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...B.slate700)
  doc.text('Employee Signature', 44, sigY + 5, { align: 'center' })
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(...B.slate500)
  doc.text(worker.name || '', 44, sigY + 10, { align: 'center' })
  
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...B.slate700)
  doc.text('Authorised Signatory', W - 44, sigY + 5, { align: 'center' })
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(...B.slate500)
  doc.text('MilkyFeast Management', W - 44, sigY + 10, { align: 'center' })

  drawFooter(doc, 'This is a computer-generated salary receipt. Valid without physical signature.')
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

// ── Share PDF via WhatsApp ────────────────────────────────────
// On mobile: opens native share sheet → user picks WhatsApp → PDF attaches directly
// On desktop: downloads PDF + opens WhatsApp chat with pre-filled message (manual attach)
export async function openPDFAndShareWhatsApp(doc, phone, label) {
  const filename = `MilkyFeast_${label.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  const blob     = doc.output('blob')
  const file     = new File([blob], filename, { type: 'application/pdf' })

  // ✅ Mobile (Android/iOS): native share sheet — PDF attaches directly in WhatsApp
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'MilkyFeast Invoice',
        text:  `Dear Sir/Ma'am,\n\nPlease find your invoice from MilkyFeast attached.\n\nThank you for your business!\n— MilkyFeast Team`,
      })
      return  // done — user shared via sheet
    } catch (err) {
      if (err.name === 'AbortError') return  // user dismissed the sheet, do nothing
      // any other error → fall through to desktop fallback below
    }
  }

  // ⬇️ Desktop fallback: download PDF + open WhatsApp chat with pre-filled text
  doc.save(filename)

  if (phone) {
    const cleaned = phone.replace(/\D/g, '')
    const number  = cleaned.startsWith('91') ? cleaned : `91${cleaned}`
    const msg     = encodeURIComponent(
      `Dear Sir/Ma'am,\n\nPlease find your invoice from MilkyFeast attached.\n\nThank you for your business!\n— MilkyFeast Team`
    )
    setTimeout(() => {
      window.open(`https://wa.me/${number}?text=${msg}`, '_blank')
    }, 600)
  }
}