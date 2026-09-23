import type { PaymentSlip } from '../types'
import { calculatePaymentTotals, currencies, formatCurrency } from '../utils/currency'
import { numberToWords } from '../utils/amountInWords'

declare global { interface Window { google?: { accounts: { oauth2: { initTokenClient(config: Record<string, unknown>): { requestAccessToken(options?: Record<string, unknown>): void }, revoke(token: string, callback: () => void): void } } } } }
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
let accessToken = ''
export const driveConfigured = Boolean(CLIENT_ID)
const loadScript = () => new Promise<void>((resolve, reject) => {
  if (window.google) return resolve()
  const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]'); if (existing) { existing.addEventListener('load', () => resolve()); return }
  const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.dataset.googleIdentity = 'true'; script.onload = () => resolve(); script.onerror = () => reject(new Error('Could not load Google Identity Services.')); document.head.appendChild(script)
})
export async function connectDrive(): Promise<void> {
  if (!CLIENT_ID) throw new Error('Google Drive setup is required. Add VITE_GOOGLE_CLIENT_ID to your environment.')
  await loadScript()
  await new Promise<void>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPE, callback: (response: { access_token?: string; error?: string }) => response.access_token ? (accessToken = response.access_token, resolve()) : reject(new Error(response.error || 'Authorization was cancelled.')), error_callback: () => reject(new Error('Authorization was cancelled.')) })
    client.requestAccessToken({ prompt: '' })
  })
}
const api = async (url: string, init: RequestInit = {}) => {
  if (!accessToken) throw new Error('Connect Google Drive first.')
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...init.headers } })
  if (!response.ok) throw new Error((await response.json()).error?.message || 'Google API request failed.')
  return response.json()
}
export async function chooseFolder() {
  const data = await api("https://www.googleapis.com/drive/v3/files?q=mimeType%3D'application%2Fvnd.google-apps.folder'%20and%20trashed%3Dfalse&fields=files(id,name)&orderBy=name&pageSize=100")
  const folders = data.files as { id: string; name: string }[]
  if (!folders.length) throw new Error('No Google Drive folders are available. Create one in Drive first.')
  const choice = window.prompt(`Enter a folder number:\n${folders.map((f, i) => `${i + 1}. ${f.name}`).join('\n')}`, '1')
  if (choice === null) throw new Error('Folder selection was cancelled.')
  const folder = folders[Number(choice) - 1]; if (!folder) throw new Error('Please enter a valid folder number.')
  return folder
}
export async function createGoogleDoc(slip: PaymentSlip, folderId: string) {
  const title = `Payment Slip - ${slip.payment.reference}`
  const file = await api('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', { method: 'POST', body: JSON.stringify({ name: title, mimeType: 'application/vnd.google-apps.document', parents: folderId ? [folderId] : undefined }) })
  const calculation = calculatePaymentTotals(slip.items, slip.payment.adjustment, slip.adjustments)
  const base = calculation.subtotal; const total = calculation.final
  const currency = currencies[slip.payment.currency] || currencies.LKR
  const lines = [slip.company.name, slip.company.address, '', 'PAYMENT SLIP', `Reference: ${slip.payment.reference}`, `Date: ${slip.payment.date}`, '', `Payment to: ${slip.recipient.name}`, `Role: ${slip.recipient.role}`, slip.recipient.identification ? `NIC / ID: ${slip.recipient.identification}` : '', `Purpose: ${slip.payment.title}`, '', ...slip.items.map((x, i) => `${i + 1}. ${x.description} — ${x.quantity} × ${formatCurrency(x.rate, slip.payment.currency)} = ${formatCurrency(calculation.itemAmounts[i], slip.payment.currency)}`), '', `Subtotal: ${formatCurrency(base, slip.payment.currency)}`, ...slip.adjustments.map((entry, index) => `${entry.label}${entry.mode === 'percentage' ? ` (${entry.value || 0}%)` : ''}: ${formatCurrency(calculation.adjustmentAmounts[index], slip.payment.currency)}`), `Final amount: ${formatCurrency(total, slip.payment.currency)}`, numberToWords(total, currency.major, currency.minor), `Payment method: ${slip.payment.method}`, slip.payment.bankName ? `Bank: ${slip.payment.bankName}` : '', slip.payment.transactionReference ? `Transaction reference: ${slip.payment.transactionReference}` : '', slip.payment.notes ? `Notes: ${slip.payment.notes}` : '', slip.payment.sealText ? `Seal: ${slip.payment.sealText}` : '', '', 'I acknowledge receipt of the payment stated above.', '', 'Prepared By: ____________________    Recipient Signature: ____________________    Date: __________'].filter(Boolean).join('\n')
  await api(`https://docs.googleapis.com/v1/documents/${file.id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: lines } }] }) })
  return { id: file.id as string, url: `https://docs.google.com/document/d/${file.id}/edit` }
}
export const disconnectDrive = () => { if (accessToken && window.google) window.google.accounts.oauth2.revoke(accessToken, () => undefined); accessToken = '' }
