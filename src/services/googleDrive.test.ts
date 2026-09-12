// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBasicSlip } from '../test/fixtures/paymentSlips'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('Google Drive integration', () => {
  it('creates a dedicated Sliply folder when drive.file exposes no folders', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'browser-client-id')
    const requestAccessToken = vi.fn(function (this: unknown) {
      tokenConfig.callback({ access_token: 'session-token' })
    })
    let tokenConfig: { callback(response: { access_token: string }): void }
    Object.defineProperty(window, 'google', {
      configurable: true,
      value: {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn((config) => {
              tokenConfig = config
              return { requestAccessToken }
            }),
            revoke: vi.fn(),
          },
        },
      },
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'folder-1', name: 'Sliply' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'pdf-1', name: 'payment-slip-PAY-001.pdf', webViewLink: 'https://drive.google.com/file/d/pdf-1/view' }) })
    vi.stubGlobal('fetch', fetchMock)

    const drive = await import('./googleDrive')
    await drive.connectDrive()
    await expect(drive.chooseFolder()).resolves.toEqual({ id: 'folder-1', name: 'Sliply' })
    await expect(drive.uploadPdfToDrive(createBasicSlip(), 'folder-1')).resolves.toEqual({ id: 'pdf-1', name: 'payment-slip-PAY-001.pdf', url: 'https://drive.google.com/file/d/pdf-1/view' })
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('uploadType=multipart'), expect.objectContaining({ method: 'POST', body: expect.any(Blob), headers: expect.objectContaining({ Authorization: 'Bearer session-token', 'Content-Type': expect.stringContaining('multipart/related') }) }))
  })
})
