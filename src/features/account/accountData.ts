import { apiDownload, apiFetch } from '../../services/api/client'

export const SUPPORT_EMAIL = 'info@hsclogic.com'

const stamp = (date = new Date()) => date.toISOString().slice(0, 10).replaceAll('-', '')
const safeFilename = (name: string, fallback: string) => /^[\w.-]+$/.test(name) ? name : fallback

/** GET /account/export: the one call a lapsed customer may make. Saves the JSON file the server streams. */
export async function downloadAccountExport(save: (blob: Blob, filename: string) => void = saveBlob, now = new Date()) {
  const { blob, filename } = await apiDownload('/account/export', { allowLapsed: true })
  const name = safeFilename(filename, `slipy-export-${stamp(now)}.json`)
  save(blob, name)
  return name
}

/** DELETE /account: removes the Slipy data only; the shared HSClogic (Cognito) account is never touched. */
export const deleteSlipyData = () => apiFetch<void>('/account', { method: 'DELETE' })

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type SupportRequest = 'archived-data' | 'delete-data'
const requests: Record<SupportRequest, { subject: string; ask: string }> = {
  'archived-data': { subject: 'Slipy: request my archived data', ask: 'Please send me a copy of my archived Slipy data.' },
  'delete-data': { subject: 'Slipy: delete my Slipy data', ask: 'Please delete all of my Slipy data. My HSClogic account is to be kept.' },
}
/** Support verifies the request through the account's Cognito-verified email, so the message only needs the user ID. */
export const supportMailto = (kind: SupportRequest, userId: string) =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(requests[kind].subject)}&body=${encodeURIComponent(`${requests[kind].ask}\n\nSlipy user ID: ${userId}\n`)}`
