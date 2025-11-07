import { useEffect } from 'react'
import { set, get, del, keys } from 'idb-keyval'

type QueueItem = {
  id: string
  request: {
    url: string
    method: 'POST' | 'PUT'
    headers: Record<string, string>
    credentials: RequestCredentials
    formDataPairs: Array<[string, string]>
  }
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function addToQueue(item: QueueItem) {
  await set(item.id, item)
}

export async function flushQueueFromTab() {
  const allKeys = await keys()
  for (const k of allKeys) {
    const item = await get<QueueItem>(k)
    if (!item) continue
    try {
      const fd = new FormData()
      for (const pair of item.request.formDataPairs) fd.append(pair[0], pair[1])
      const resp = await fetch(item.request.url, {
        method: item.request.method,
        credentials: item.request.credentials,
        body: fd,
        headers: item.request.headers,
      })
      if (resp.ok) await del(k)
      else if (resp.status >= 400 && resp.status < 500) await del(k)
    } catch {}
  }
}

type Options = {
  url?: string
  onQueued?: () => void
  onFlushed?: () => void
}

export function useOfflineSubmit({ url, onQueued, onFlushed }: Options = {}) {
  useEffect(() => {
    const handler = () => {
      flushQueueFromTab().then(() => onFlushed?.())
    }
    window.addEventListener('online', handler)
    return () => window.removeEventListener('online', handler)
  }, [onFlushed])

  return async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (navigator.onLine) return
    e.preventDefault()
    const form = e.currentTarget
    const actionUrl = url ?? form.action ?? window.location.pathname
    const fd = new FormData(form)
    const pairs: Array<[string, string]> = []
    for (const entry of fd.entries()) {
      pairs.push([entry[0], String(entry[1])])
    }
    const item: QueueItem = {
      id: uid(),
      request: {
        url: actionUrl,
        method: 'POST',
        headers: {},
        credentials: 'same-origin',
        formDataPairs: pairs,
      },
    }
    await addToQueue(item)
    onQueued?.()
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready
      try {
        await reg.sync.register('checklist-sync')
      } catch {}
    }
  }
}


