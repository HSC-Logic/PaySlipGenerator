// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api/client'

let cloudAccess = false
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ cloudAccess }) }))
const repo = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }))
vi.mock('../../services/repositories/apiRepository', () => ({ ApiDesignRepository: class { list = repo.list; create = repo.create; update = repo.update; remove = repo.remove } }))
const { useDesignLibrary } = await import('./useDesignLibrary')

const design = { name: 'Mine', layout: 'modern', color: '#123456', font: 'times' } as const
const stored = (extra = {}) => ({ ...design, id: 'd1', version: 1, createdAt: 0, updatedAt: 0, ...extra })
beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
  Object.values(repo).forEach(mock => mock.mockReset()); cloudAccess = false
})

describe('useDesignLibrary', () => {
  it('keeps designs in browser storage for accounts without cloud access and never calls the API', async () => {
    const { result } = renderHook(() => useDesignLibrary())
    await act(async () => { expect(await result.current.save(design)).toBe('') })
    expect(result.current.designs).toEqual([design]); expect(JSON.parse(localStorage.getItem('payment-slip-custom-designs')!)).toEqual([design])
    await act(async () => { expect(await result.current.remove('Mine')).toBe('') })
    expect(result.current.designs).toEqual([]); expect(Object.values(repo).every(mock => mock.mock.calls.length === 0)).toBe(true)
  })

  it('reads and writes /designs for Pro, creating then replacing with the stored version', async () => {
    cloudAccess = true; repo.list.mockResolvedValue([]); repo.create.mockResolvedValue(stored()); repo.update.mockResolvedValue(stored({ version: 2, color: '#654321' }))
    const { result } = renderHook(() => useDesignLibrary())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { expect(await result.current.save(design)).toBe('') })
    expect(repo.create).toHaveBeenCalledWith(design); expect(localStorage.getItem('payment-slip-custom-designs')).toBeNull()
    await act(async () => { expect(await result.current.save({ ...design, name: 'mine', color: '#654321' })).toBe('') })
    expect(repo.update).toHaveBeenCalledWith('d1', { ...design, name: 'mine', color: '#654321' }, 1)
    await act(async () => { await result.current.remove('mine') })
    expect(repo.remove).toHaveBeenCalledWith('d1'); expect(result.current.designs).toEqual([])
  })

  it('returns the server message and reloads when the name is taken', async () => {
    cloudAccess = true; repo.list.mockResolvedValueOnce([]).mockResolvedValueOnce([stored()])
    repo.create.mockRejectedValue(new ApiError('A design with this name already exists. Choose a different name.', 409, 'name-taken'))
    const { result } = renderHook(() => useDesignLibrary())
    await waitFor(() => expect(result.current.loading).toBe(false))
    let message = ''; await act(async () => { message = await result.current.save(design) })
    expect(message).toContain('already exists'); await waitFor(() => expect(result.current.designs).toEqual([design]))
  })

  it('reports a load failure without throwing', async () => {
    cloudAccess = true; repo.list.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useDesignLibrary())
    await waitFor(() => expect(result.current.loadError).toContain('offline')); expect(result.current.designs).toEqual([])
  })
})
