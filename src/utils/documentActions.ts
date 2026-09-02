import type jsPDF from 'jspdf'
import type { PaymentSlip } from '../types'

export type DocumentAction = 'download' | 'print'
type Notice = (kind: 'success' | 'error', message: string) => void

type DocumentActionOptions = {
  action: DocumentAction
  slip: PaymentSlip
  build: (slip: PaymentSlip) => jsPDF
  download: (document: jsPDF, slip: PaymentSlip) => Promise<void>
  print: (document: jsPDF) => Promise<void>
  setBusy: (value: string) => void
  notify: Notice
  reportError?: (error: unknown) => void
}

const messages: Record<DocumentAction, { success: string; error: string }> = {
  download: { success: 'Your PDF download has started.', error: 'The PDF could not be generated. Check the document details and try again.' },
  print: { success: 'Your PDF is ready in the print dialog.', error: 'The printable PDF could not be prepared. Download the PDF and print it from your PDF viewer instead.' },
}

/** One application boundary owns busy state and notifications for both output
 * actions. It never mutates or replaces the supplied payment state. */
export async function runDocumentAction({ action, slip, build, download, print, setBusy, notify, reportError }: DocumentActionOptions) {
  setBusy(action)
  try {
    const document = build(slip)
    if (action === 'download') await download(document, slip)
    else await print(document)
    notify('success', messages[action].success)
  } catch (error) {
    reportError?.(error)
    notify('error', messages[action].error)
  } finally {
    setBusy('')
  }
}
