// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBasicSlip } from '../test/fixtures/paymentSlips'

vi.mock('./cognito/auth', () => ({ cognitoConfigured: true, getAccessContext: async () => ({ token: 'api-token', pro: true, lapsed: false }) }))

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules() })

const problem = (slug: string, status: number, detail = '') => new Response(JSON.stringify({ type: `https://slipy.hsclogic.link/problems/${slug}`, detail }), { status })
type Call = [string, RequestInit]
const setup = async (...responses: Response[]) => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'browser-client-id'); vi.stubEnv('VITE_API_BASE_URL', 'https://api.test/api/v1')
  const fetchMock = vi.fn(async () => responses.shift() ?? Response.json({})); vi.stubGlobal('fetch', fetchMock)
  const calls = () => fetchMock.mock.calls as unknown as Call[]
  return { drive: await import('./googleDrive'), calls }
}
const stubGoogle = (respond: (config: any) => void) => Object.defineProperty(window, 'google', { configurable: true, value: { accounts: { oauth2: { initCodeClient: vi.fn((config: any) => ({ requestCode: () => respond(config) })) } } } })

describe('Google Drive through the API', () => {
  it('is configured only when the client id and the cloud API are present', async () => {
    const { drive } = await setup(); expect(drive.driveConfigured).toBe(true)
    vi.resetModules(); vi.stubEnv('VITE_GOOGLE_CLIENT_ID', ''); expect((await import('./googleDrive')).driveConfigured).toBe(false)
  })

  it('connects with a popup authorization code, sending only the code to the API', async () => {
    stubGoogle(config => config.callback({ code: 'one-time-code' }))
    const { drive, calls } = await setup(Response.json({ connected: true, scope: 'drive.file' }))
    await drive.connectDrive()
    const init = (window.google!.accounts.oauth2.initCodeClient as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(init).toMatchObject({ client_id: 'browser-client-id', scope: 'https://www.googleapis.com/auth/drive.file', ux_mode: 'popup' })
    const [url, request] = calls()[0]
    expect(url).toBe('https://api.test/api/v1/drive/connection'); expect(request.method).toBe('POST'); expect(JSON.parse(String(request.body))).toEqual({ code: 'one-time-code' })
    expect(new Headers(request.headers).get('Authorization')).toBe('Bearer api-token')
  })

  it('explains popup problems and rejected codes', async () => {
    stubGoogle(config => config.error_callback({ type: 'popup_failed_to_open' }))
    const { drive } = await setup()
    await expect(drive.connectDrive()).rejects.toThrow(/popup was blocked/)
    stubGoogle(config => config.callback({ error: 'access_denied' }))
    await expect(drive.connectDrive()).rejects.toThrow(/not granted/)
    stubGoogle(config => config.callback({ code: 'bad' }))
    const second = await setup(problem('drive-code-rejected', 400, 'raw'))
    await expect(second.drive.connectDrive()).rejects.toMatchObject({ kind: 'drive-code-rejected', message: 'Google did not accept the authorization. Start the connection again.' })
  })

  it('reads the connection, lists and creates folders, and disconnects', async () => {
    const { drive, calls } = await setup(Response.json({ connected: true, scope: 's' }), Response.json([{ id: 'f1', name: 'Slips' }]), Response.json({ id: 'f2', name: 'Sliply' }), Response.json({ connected: false }))
    await expect(drive.getDriveConnection()).resolves.toBe(true)
    await expect(drive.listFolders()).resolves.toEqual([{ id: 'f1', name: 'Slips' }])
    await expect(drive.createFolder('Sliply')).resolves.toEqual({ id: 'f2', name: 'Sliply' })
    await drive.disconnectDrive()
    expect(calls().map(([url, init]) => `${init.method ?? 'GET'} ${url.replace('https://api.test/api/v1', '')}`)).toEqual(['GET /drive/connection', 'GET /drive/folders', 'POST /drive/folders', 'DELETE /drive/connection'])
    expect(JSON.parse(String(calls()[2][1].body))).toEqual({ name: 'Sliply' })
  })

  it('uploads the PDF as multipart without a JSON content type', async () => {
    const { drive, calls } = await setup(Response.json({ id: 'pdf-1', url: 'https://drive.google.com/file/d/pdf-1/view' }))
    await expect(drive.uploadPdfToDrive(createBasicSlip(), 'folder-1')).resolves.toEqual({ id: 'pdf-1', url: 'https://drive.google.com/file/d/pdf-1/view' })
    const [url, request] = calls()[0]
    expect(url).toBe('https://api.test/api/v1/drive/files/pdf'); expect(request.method).toBe('POST')
    const form = request.body as FormData
    expect(form).toBeInstanceOf(FormData); expect(form.get('folderId')).toBe('folder-1'); expect(String(form.get('name'))).toMatch(/\.pdf$/)
    expect((form.get('file') as File).type).toBe('application/pdf')
    expect(new Headers(request.headers).has('Content-Type')).toBe(false)
  })

  it('creates a Google Doc from text built in the browser', async () => {
    const { drive, calls } = await setup(Response.json({ id: 'doc-1', url: 'https://docs.google.com/document/d/doc-1/edit' }))
    const slip = createBasicSlip()
    await expect(drive.createGoogleDoc(slip, 'folder-1')).resolves.toEqual({ id: 'doc-1', url: 'https://docs.google.com/document/d/doc-1/edit' })
    expect(calls()[0][0]).toBe('https://api.test/api/v1/drive/files/document')
    const body = JSON.parse(String(calls()[0][1].body))
    expect(body).toMatchObject({ folderId: 'folder-1', title: drive.documentTitle(slip) }); expect(body.text).toContain(slip.company.name); expect(body.text).toContain(`Reference: ${slip.payment.reference}`)
  })

  it.each([
    ['drive-not-connected', 409, 'Google Drive is not connected. Connect it and try again.'],
    ['drive-reconnect-required', 409, 'Google Drive access expired or was revoked. Reconnect Google Drive to continue.'],
    ['drive-folder-not-found', 404, 'That Drive folder no longer exists or is not accessible. Choose another folder.'],
    ['drive-unavailable', 502, 'Google Drive is temporarily unavailable. Try again in a moment.'],
    ['drive-not-configured', 503, 'Google Drive is not available on this server yet. Try again later.'],
  ])('surfaces %s from an upload', async (slug, status, message) => {
    const { drive } = await setup(problem(slug, status))
    await expect(drive.uploadPdfToDrive(createBasicSlip(), 'folder-1')).rejects.toMatchObject({ kind: slug, message })
  })

  it('keeps the server detail when the request is invalid or too large', async () => {
    const { drive } = await setup(problem('drive-invalid-request', 413, 'The PDF must be between 1 byte and 10 MB.'))
    await expect(drive.uploadPdfToDrive(createBasicSlip(), 'folder-1')).rejects.toMatchObject({ kind: 'drive-invalid-request', status: 413, message: 'The PDF must be between 1 byte and 10 MB.' })
  })
})
