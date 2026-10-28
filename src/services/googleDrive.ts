import type { PaymentSlip } from '../types'
import { calculatePaymentTotals, currencies, formatCurrency } from '../utils/currency'
import { numberToWords } from '../utils/amountInWords'
import { getDocumentHeading, getDocumentTypeLabel, getPaymentMethodLabel } from '../utils/documentIdentity'
import { createPdfBlob, pdfFilename } from '../utils/pdf'
import { apiFetch } from './api/client'
import { cloudDataEnabled } from './cloud'

type CodeResponse = { code?: string; error?: string; error_description?: string }
type CodeClient = { requestCode(): void }
declare global { interface Window { google?: { accounts: { oauth2: { initCodeClient(config: Record<string, unknown>): CodeClient } } } } }

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim()
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
/** Drive runs through the Slipy API (Pro only); it needs the API, the HSClogic sign-in and the Google OAuth client id. */
export const driveConfigured = Boolean(CLIENT_ID) && cloudDataEnabled
export type DriveFolder = { id: string; name: string }
export type DriveFile = { id: string; url: string }

const loadScript = () => new Promise<void>((resolve, reject) => {
  if (window.google?.accounts?.oauth2?.initCodeClient) return resolve()
  const fail = () => reject(new Error('Could not load Google sign-in. Check your connection and try again.'))
  const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]')
  if (existing) { existing.addEventListener('load', () => resolve()); existing.addEventListener('error', fail); return }
  const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.dataset.googleIdentity = 'true'; script.onload = () => resolve(); script.onerror = fail; document.head.appendChild(script)
})
const json = (body: unknown) => JSON.stringify(body)

/** Whether the signed-in customer has a stored Drive connection. */
export async function getDriveConnection(): Promise<boolean> { return Boolean((await apiFetch<{ connected?: boolean }>('/drive/connection'))?.connected) }

/** Opens Google's consent popup and hands the one-time code to the API, which stores the refresh token. The browser never holds a Google token. */
export async function connectDrive(): Promise<void> {
  if (!CLIENT_ID) throw new Error('Google Drive setup is required. Add VITE_GOOGLE_CLIENT_ID to your environment.')
  await loadScript()
  const code = await new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initCodeClient({
      client_id: CLIENT_ID, scope: SCOPE, ux_mode: 'popup',
      callback: (response: CodeResponse) => response.code ? resolve(response.code) : reject(new Error(response.error === 'access_denied' ? 'Google Drive access was not granted.' : 'Google authorization failed. Try again.')),
      error_callback: (error: { type?: string }) => reject(new Error(error?.type === 'popup_failed_to_open' ? 'The Google sign-in popup was blocked. Allow popups for this site and try again.' : 'Google authorization was cancelled.')),
    })
    client.requestCode()
  })
  await apiFetch('/drive/connection', { method: 'POST', body: json({ code }) })
}
export const disconnectDrive = async () => { await apiFetch('/drive/connection', { method: 'DELETE' }) }

export const listFolders = async () => (await apiFetch<DriveFolder[]>('/drive/folders')) ?? []
export const createFolder = (name: string) => apiFetch<DriveFolder>('/drive/folders', { method: 'POST', body: json({ name }) })

/** The editable Google Doc text, built here so document wording stays in one place. */
export function documentTitle(slip: PaymentSlip) { return `${getDocumentTypeLabel(slip)} - ${slip.payment.reference}` }
export function documentText(slip: PaymentSlip) {
  const calculation = calculatePaymentTotals(slip.items, slip.payment.adjustment, slip.adjustments)
  const base = calculation.subtotal; const total = calculation.final
  const currency = currencies[slip.payment.currency] || currencies.LKR
  const lines = [slip.company.name, slip.company.address, '', getDocumentHeading(slip), `Reference: ${slip.payment.reference}`, `Date: ${slip.payment.date}`, '', `Payment to: ${slip.recipient.name}`, `Role: ${slip.recipient.role}`, slip.recipient.identification ? `NIC / ID: ${slip.recipient.identification}` : '', `Purpose: ${slip.payment.title}`, '', ...slip.items.map((x, i) => `${i + 1}. ${x.description} — ${x.quantity} × ${formatCurrency(x.rate, slip.payment.currency)} = ${formatCurrency(calculation.itemAmounts[i], slip.payment.currency)}`), '', `Subtotal: ${formatCurrency(base, slip.payment.currency)}`, ...slip.adjustments.map((entry, index) => `${entry.label}${entry.mode === 'percentage' ? ` (${entry.value || 0}%)` : ''}: ${formatCurrency(calculation.adjustmentAmounts[index], slip.payment.currency)}`), `Final amount: ${formatCurrency(total, slip.payment.currency)}`, numberToWords(total, currency.major, currency.minor), `Payment method: ${getPaymentMethodLabel(slip)}`, slip.payment.bankName ? `Bank: ${slip.payment.bankName}` : '', slip.payment.transactionReference ? `Transaction reference: ${slip.payment.transactionReference}` : '', slip.payment.notes ? `Notes: ${slip.payment.notes}` : '', slip.payment.sealText ? `Seal: ${slip.payment.sealText}` : '', '', 'I acknowledge receipt of the payment stated above.', '', 'Prepared By: ____________________    Recipient Signature: ____________________    Date: __________'].filter(Boolean).join('\n')
  return lines
}
export const createGoogleDoc = (slip: PaymentSlip, folderId: string) => apiFetch<DriveFile>('/drive/files/document', { method: 'POST', body: json({ folderId, title: documentTitle(slip), text: documentText(slip) }) })
export async function uploadPdfToDrive(slip: PaymentSlip, folderId: string) {
  const form = new FormData()
  form.append('file', new Blob([createPdfBlob(slip)], { type: 'application/pdf' }), pdfFilename(slip))
  form.append('folderId', folderId); form.append('name', pdfFilename(slip))
  return apiFetch<DriveFile>('/drive/files/pdf', { method: 'POST', body: form })
}
