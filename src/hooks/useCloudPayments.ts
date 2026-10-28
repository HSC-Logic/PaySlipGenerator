import { useCallback, useEffect, useRef, useState } from 'react'
import type { CloudPaymentRecord, PaymentSlipFilters } from '../types'
import { ApiPaymentRepository } from '../services/repositories/apiRepository'
const repository = new ApiPaymentRepository()
/** Loads the first page for the filters and appends further pages by keyset cursor. */
export function useCloudPayments(filters: PaymentSlipFilters = {}) {
  const [records, setRecords] = useState<CloudPaymentRecord[]>([]); const [cursor, setCursor] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [loadingMore, setLoadingMore] = useState(false); const [error, setError] = useState('')
  const key = JSON.stringify(filters); const filtersRef = useRef(filters); filtersRef.current = filters; const generation = useRef(0)
  const load = useCallback(async (silent = false) => {
    const current = ++generation.current
    if (!silent) setLoading(true)
    setError('')
    try { const page = await repository.listPage(filtersRef.current); if (current !== generation.current) return; setRecords(page.items); setCursor(page.nextCursor) }
    catch (reason) { if (current === generation.current) setError(reason instanceof Error ? reason.message : 'Could not load payments.') }
    finally { if (current === generation.current) setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [key, load])
  const loadMore = async () => {
    if (!cursor || loadingMore) return
    const current = generation.current; setLoadingMore(true)
    try { const page = await repository.listPage(filtersRef.current, cursor); if (current !== generation.current) return; setRecords(existing => [...existing, ...page.items]); setCursor(page.nextCursor) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load more payments.') }
    finally { setLoadingMore(false) }
  }
  return { records, loading, loadingMore, error, hasMore: cursor !== null, loadMore, reload: () => load(true) }
}
