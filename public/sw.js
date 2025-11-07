const DB = 'offline-queue-db';
const STORE = 'queue';
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbTx(mode, fn) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const st = tx.objectStore(STORE);
    const res = fn(st);
    tx.oncomplete = () => resolve(res);
    tx.onerror = () => reject(tx.error);
  });
}
async function getAll() {
  return idbTx('readonly', st => st.getAll());
}
async function remove(id) {
  return idbTx('readwrite', st => st.delete(id));
}
async function flushQueue() {
  const items = await getAll();
  for (const item of items) {
    try {
      const { url, method, headers, formDataPairs, credentials } = item.request;
      const fd = new FormData();
      for (const pair of formDataPairs) fd.append(pair[0], pair[1]);
      const resp = await fetch(url, { method, body: fd, headers, credentials });
      if (resp.ok) {
        await remove(item.id);
      } else if (resp.status >= 400 && resp.status < 500) {
        await remove(item.id);
      }
    } catch {}
  }
}
self.addEventListener('sync', event => {
  if (event.tag === 'checklist-sync') {
    event.waitUntil(flushQueue());
  }
});
self.addEventListener('online', () => {
  flushQueue();
});
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());

