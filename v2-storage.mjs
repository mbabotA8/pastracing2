const DATABASE = 'pastracing2-v4';
const STORE = 'last-work';

export function openWorkDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

export function readLastWork(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, 'readonly');
        const request = transaction.objectStore(STORE).get('current');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

export function writeLastWork(db, work) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, 'readwrite');
        const timer = setTimeout(() => {
            try {
                transaction.abort();
            } catch {}
        }, 15000);
        transaction.objectStore(STORE).put(work, 'current');
        transaction.oncomplete = () => {
            clearTimeout(timer);
            resolve();
        };
        transaction.onerror = () => {
            clearTimeout(timer);
            reject(transaction.error);
        };
        transaction.onabort = () => {
            clearTimeout(timer);
            reject(transaction.error || Error('El almacenamiento no respondió.'));
        };
    });
}

export function readLegacyWork() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('passtracing-v3');
        let absent = false;
        // Abort creation: importing must never create or change the old database.
        request.onupgradeneeded = () => {
            absent = true;
            request.transaction.abort();
        };
        request.onerror = () => (absent ? resolve(null) : reject(request.error));
        request.onsuccess = async () => {
            const db = request.result;
            try {
                resolve(db.objectStoreNames.contains(STORE) ? await readLastWork(db) : null);
            } catch (error) {
                reject(error);
            } finally {
                db.close();
            }
        };
    });
}
