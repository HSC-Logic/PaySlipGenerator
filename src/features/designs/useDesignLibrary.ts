import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CustomDesign } from '../../types'
import { useAuth } from '../auth/AuthProvider'
import { ApiError } from '../../services/api/client'
import { ApiDesignRepository } from '../../services/repositories/apiRepository'
import { loadCustomDesigns, saveCustomDesigns } from '../../utils/customDesigns'

type Entry = { design: CustomDesign; id?: string; version?: number }
const repository = new ApiDesignRepository()
const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Try again.'

/**
 * The saved-design library. Pro accounts read and write `/designs` on the Slipy API; everyone else keeps using
 * the browser's `payment-slip-custom-designs` storage. Components only see plain `CustomDesign` values.
 */
export function useDesignLibrary() {
  const { cloudAccess } = useAuth()
  const [entries, setEntries] = useState<Entry[]>(() => cloudAccess ? [] : loadCustomDesigns().map(design => ({ design })))
  const [loading, setLoading] = useState(cloudAccess)
  const [loadError, setLoadError] = useState('')

  const reload = useCallback(async () => {
    if (!cloudAccess) { setEntries(loadCustomDesigns().map(design => ({ design }))); setLoading(false); setLoadError(''); return }
    setLoading(true)
    try {
      const list = await repository.list()
      setEntries(list.map(({ id, version, createdAt, updatedAt, ...design }) => ({ design, id, version })))
      setLoadError('')
    } catch (error) { setEntries([]); setLoadError(`Could not load your saved designs. ${messageOf(error)}`) } finally { setLoading(false) }
  }, [cloudAccess])
  useEffect(() => { void reload() }, [reload])

  const designs = useMemo(() => entries.map(entry => entry.design), [entries])

  /** Creates or replaces (by name, case-insensitive) a saved design. Returns an error message, or '' on success. */
  const save = useCallback(async (design: CustomDesign): Promise<string> => {
    const existing = entries.find(entry => sameName(entry.design.name, design.name))
    if (!cloudAccess) {
      const next = existing ? entries.map(entry => entry === existing ? { design } : entry) : [...entries, { design }]
      const error = saveCustomDesigns(next.map(entry => entry.design)); if (!error) setEntries(next)
      return error
    }
    try {
      const stored = existing?.id && existing.version !== undefined ? await repository.update(existing.id, design, existing.version) : await repository.create(design)
      const entry: Entry = { design: { ...design }, id: stored.id, version: stored.version }
      setEntries(current => existing ? current.map(item => item === existing ? entry : item) : [...current, entry])
      return ''
    } catch (error) {
      // A stale version or a name saved elsewhere means this list is out of date: show the server's copy.
      if (error instanceof ApiError && (error.kind === 'conflict' || error.kind === 'name-taken' || error.kind === 'not-found')) void reload()
      return messageOf(error)
    }
  }, [cloudAccess, entries, reload])

  /** Deletes a saved design by name. Returns an error message, or '' on success. */
  const remove = useCallback(async (name: string): Promise<string> => {
    const existing = entries.find(entry => entry.design.name === name)
    if (!existing) return ''
    if (!cloudAccess) {
      const next = entries.filter(entry => entry !== existing); const error = saveCustomDesigns(next.map(entry => entry.design)); if (!error) setEntries(next)
      return error
    }
    try { if (existing.id) await repository.remove(existing.id); setEntries(current => current.filter(entry => entry !== existing)); return '' } catch (error) {
      if (error instanceof ApiError && error.kind === 'not-found') { setEntries(current => current.filter(entry => entry !== existing)); return '' }
      return messageOf(error)
    }
  }, [cloudAccess, entries])

  return { designs, cloud: cloudAccess, loading, loadError, save, remove }
}
