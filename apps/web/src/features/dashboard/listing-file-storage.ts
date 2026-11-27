let database: Promise<IDBDatabase> | undefined;
function mediaDatabase() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("tpp-listing-media", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
  });
  return database;
}
export type LocalFiles = Array<[string, File]>;
export async function storeListingFiles(key: string, files: LocalFiles) {
  const db = await mediaDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    const store = tx.objectStore("drafts");
    if (files.length) store.put(files, key);
    else store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}
export async function readFiles(key: string) {
  const db = await mediaDatabase();
  return new Promise<LocalFiles>((resolve, reject) => {
    const req = db.transaction("drafts").objectStore("drafts").get(key);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export function removeListingDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Storage may be blocked in private browsing. */
  }
  return storeListingFiles(key, []).catch(() => {});
}
