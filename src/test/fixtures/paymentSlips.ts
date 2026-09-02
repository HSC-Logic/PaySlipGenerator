import type { PageOrientation, PaperSize, PaymentSlip } from '../../types'

export const contentMarkers = {
  company: 'COMPANYENDMARKER',
  address: 'ADDRESSENDMARKER',
  registration: 'REGISTRATIONMARKER',
  recipient: 'RECIPIENTENDMARKER',
  identification: 'NICMARKER',
  role: 'ROLEENDMARKER',
  recipientAddress: 'RECIPIENTADDRESSMARKER',
  phone: 'PHONEMARKER',
  purpose: 'PURPOSEENDMARKER',
  transaction: 'TRANSACTIONENDMARKER',
  notes: 'NOTESENDMARKER',
  authorizedName: 'AUTHNAMEMARKER',
  authorizedRole: 'AUTHROLEMARKER',
  finalAdjustment: 'ADJ6MARKER',
} as const

export function createBasicSlip(): PaymentSlip {
  return {
    company: { name: 'Example Company', address: 'Colombo', telephone: '', email: '', registrationNumber: '', logo: '', authorizedName: '', authorizedDesignation: '', themeColor: '#123456' },
    recipient: { name: 'Test Recipient', identification: '', role: '', address: '', email: '', telephone: '' },
    payment: { date: '2026-08-31', reference: 'PAY/001', title: 'Consulting services', method: 'Cash', bankName: '', transactionReference: '', notes: '', adjustment: 0, currency: 'LKR', sealText: '', paperSize: 'a4', orientation: 'portrait' },
    items: [{ id: 'item-1', description: 'Consulting service', quantity: 2, rate: 1500 }],
    adjustments: [],
  }
}

export function createTypicalSlip(): PaymentSlip {
  const slip = createBasicSlip()
  return {
    ...slip,
    company: { ...slip.company, telephone: '+94 11 234 5678', email: 'accounts@example.com', registrationNumber: 'PV-12345', authorizedName: 'Authorized Person', authorizedDesignation: 'Finance Manager' },
    recipient: { ...slip.recipient, identification: '901234567V', role: 'Consultant', address: 'Kandy, Sri Lanka', email: 'recipient@example.com', telephone: '+94 77 123 4567' },
    payment: { ...slip.payment, method: 'Bank Transfer', bankName: 'Example Bank', transactionReference: 'TXN-123456', notes: 'Please retain this slip as acknowledgement of payment.', adjustment: -50, sealText: 'Thank You' },
    items: [{ id: 'item-1', description: 'Consulting services', quantity: 2, rate: 1500 }, { id: 'item-2', description: 'Travel reimbursement', quantity: 1, rate: 500 }],
    adjustments: [{ id: 'discount', label: 'Discount', kind: 'discount', mode: 'percentage', value: 5 }, { id: 'vat', label: 'VAT', kind: 'tax', mode: 'percentage', value: 18 }, { id: 'delivery', label: 'Delivery', kind: 'delivery', mode: 'fixed', value: 250 }],
  }
}

export function createLongContentSlip(paperSize: PaperSize = 'a4', orientation: PageOrientation = 'portrait'): PaymentSlip {
  const slip = createTypicalSlip()
  return {
    ...slip,
    company: { ...slip.company, name: `Very Long Company Name ${contentMarkers.company}`, address: `Address line one\nAddress line two\nAddress line three\n${contentMarkers.address}`, registrationNumber: contentMarkers.registration, authorizedName: `Very Long Authorized Person Name ${contentMarkers.authorizedName}`, authorizedDesignation: `Very Long Authorized Professional Designation ${contentMarkers.authorizedRole}` },
    recipient: { name: `Very Long Recipient Name ${contentMarkers.recipient}`, identification: contentMarkers.identification, role: `A very long professional role ${contentMarkers.role}`, address: `Recipient address ${contentMarkers.recipientAddress}`, email: 'recipient-marker@example.com', telephone: contentMarkers.phone },
    payment: { ...slip.payment, paperSize, orientation, title: `A very long payment purpose ${contentMarkers.purpose}`, transactionReference: `A-LONG-TRANSACTION-${contentMarkers.transaction}`, notes: `${'Long payment note content. '.repeat(80)}${contentMarkers.notes}` },
    items: Array.from({ length: 12 }, (_, index) => ({ id: `item-${index + 1}`, description: `Long item ${index + 1} description ITEM${index + 1}ENDMARKER`, quantity: index + 1, rate: 1250.5 })),
    adjustments: Array.from({ length: 6 }, (_, index) => ({ id: `adjustment-${index + 1}`, label: `A deliberately long adjustment label ${index + 1} ${index === 5 ? contentMarkers.finalAdjustment : `ADJ${index + 1}MARKER`}`, kind: 'charge' as const, mode: 'fixed' as const, value: index + 1 })),
  }
}

export function createMultiPageSlip(itemCount = 45, paperSize: PaperSize = 'a4', orientation: PageOrientation = 'portrait'): PaymentSlip {
  const slip = createTypicalSlip()
  return {
    ...slip,
    payment: { ...slip.payment, paperSize, orientation, reference: 'PS-2026-MULTIPAGE' },
    items: Array.from({ length: itemCount }, (_, index) => ({ id: `item-${index + 1}`, description: `Service line ${index + 1} ITEM${index + 1}MARKER with a long description that must wrap safely`, quantity: index + 1, rate: 9999.99 })),
  }
}
