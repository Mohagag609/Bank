// --- IndexedDB Setup ---
const DB_NAME = 'bank-ledger-db';
const DB_VERSION = 1;
const STORES = {
    BANKS: 'banks',
    ENTRIES: 'entries',
    SETTINGS: 'settings'
};

let db;

/**
 * Opens and initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
 */
export function openDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("Database error:", event.target.error);
            reject("Database error: " + event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("Database opened successfully.");
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            console.log("Database upgrade needed.");
            const tempDb = event.target.result;

            // 1. Create 'banks' Object Store
            if (!tempDb.objectStoreNames.contains(STORES.BANKS)) {
                const banksStore = tempDb.createObjectStore(STORES.BANKS, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                banksStore.createIndex('name', 'name', { unique: true });
                console.log(`Object store '${STORES.BANKS}' created.`);
            }

            // 2. Create 'entries' Object Store
            if (!tempDb.objectStoreNames.contains(STORES.ENTRIES)) {
                const entriesStore = tempDb.createObjectStore(STORES.ENTRIES, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                entriesStore.createIndex('bankId', 'bankId', { unique: false });
                entriesStore.createIndex('date', 'date', { unique: false });
                entriesStore.createIndex('type', 'type', { unique: false });
                console.log(`Object store '${STORES.ENTRIES}' created.`);
            }

            // 3. Create 'settings' Object Store
            if (!tempDb.objectStoreNames.contains(STORES.SETTINGS)) {
                const settingsStore = tempDb.createObjectStore(STORES.SETTINGS, {
                    keyPath: 'key'
                });
                console.log(`Object store '${STORES.SETTINGS}' created.`);
            }

            // Seed data after stores are created
            const transaction = event.target.transaction;
            transaction.oncomplete = () => {
                seedDatabase(tempDb);
            };
        };
    });
}

/**
 * Seeds the database with initial data if it's empty.
 * @param {IDBDatabase} tempDb The database instance from onupgradeneeded.
 */
async function seedDatabase(tempDb) {
    console.log("Seeding database...");
    // Use a single transaction for all seeding operations
    const tx = tempDb.transaction([STORES.BANKS, STORES.ENTRIES], 'readwrite');
    const bankStore = tx.objectStore(STORES.BANKS);
    const entryStore = tx.objectStore(STORES.ENTRIES);

    const banks = [
        { name: "البنك الأهلي", iban: "", openingBalance: 10000, createdAt: new Date().toISOString() },
        { name: "بنك مصر", iban: "", openingBalance: 5000, createdAt: new Date().toISOString() }
    ];

    const addBankRequest = banks.map(bank => {
        return new Promise((resolve, reject) => {
            const request = bankStore.add(bank);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });

    Promise.all(addBankRequest).then(bankIds => {
        console.log("Banks seeded with IDs:", bankIds);
        const entries = [
            // Entries for البنك الأهلي (id: bankIds[0])
            { bankId: bankIds[0], type: "debit", description: "راتب شهر يوليو", date: "2024-07-25", amount: 7500 },
            { bankId: bankIds[0], type: "credit", description: "إيجار المكتب", date: "2024-07-26", amount: 2500 },
            { bankId: bankIds[0], type: "credit", description: "فاتورة كهرباء", date: "2024-07-28", amount: 450 },
            { bankId: bankIds[0], type: "debit", description: "تحويل من عميل", date: "2024-08-05", amount: 3000 },
            { bankId: bankIds[0], type: "credit", description: "مصروفات شراء بضاعة", date: "2024-08-10", amount: 4000 },
            // Entries for بنك مصر (id: bankIds[1])
            { bankId: bankIds[1], type: "debit", description: "دفعة مقدمة من مشروع", date: "2024-07-20", amount: 2000 },
            { bankId: bankIds[1], type: "credit", description: "شراء مستلزمات مكتبية", date: "2024-07-22", amount: 350 },
            { bankId: bankIds[1], type: "credit", description: "تأمينات اجتماعية", date: "2024-08-15", amount: 1200 },
        ];

        entries.forEach(entry => entryStore.add(entry));
        console.log("Entries seeded.");
    }).catch(err => {
        console.error("Error seeding banks:", err);
    });
}

// --- CRUD Helper Functions ---
function getAll(storeName) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject("Error fetching all from " + storeName + ": " + event.target.error);
    });
}

function add(storeName, item) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject("Error adding to " + storeName + ": " + event.target.error);
    });
}

function update(storeName, item) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject("Error updating in " + storeName + ": " + event.target.error);
    });
}

function remove(storeName, key) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject("Error deleting from " + storeName + ": " + event.target.error);
    });
}


// --- Bank Specific Functions ---
export const getBanks = () => getAll(STORES.BANKS);
export const addBank = (bank) => add(STORES.BANKS, bank);
export const updateBank = (bank) => update(STORES.BANKS, bank);
export const deleteBank = (id) => remove(STORES.BANKS, id);

// --- Entry Specific Functions ---
export const addEntry = (entry) => add(STORES.ENTRIES, entry);
export const updateEntry = (entry) => update(STORES.ENTRIES, entry);
export const deleteEntry = (id) => remove(STORES.ENTRIES, id);

/**
 * Gets all entries for a specific bank, optionally within a date range.
 * @param {object} options - The query options.
 * @param {number} options.bankId - The ID of the bank.
 * @param {string} [options.from] - ISO start date (inclusive).
 * @param {string} [options.to] - ISO end date (inclusive).
 * @returns {Promise<any[]>} A promise that resolves with an array of entries.
 */
export function getEntriesForBank({ bankId, from, to }) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(STORES.ENTRIES, 'readonly');
        const store = transaction.objectStore(STORES.ENTRIES);
        const index = store.index('bankId');

        const entries = [];
        const request = index.openCursor(IDBKeyRange.only(bankId));

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const entry = cursor.value;
                const inRange = (!from || entry.date >= from) && (!to || entry.date <= to);
                if (inRange) {
                    entries.push(entry);
                }
                cursor.continue();
            } else {
                resolve(entries);
            }
        };
        request.onerror = (event) => {
            reject("Error fetching entries for bank: " + event.target.error);
        };
    });
}

/**
 * Gets all entries across all banks within a date range.
 * @param {object} options - The query options.
 * @param {string} options.from - ISO start date (inclusive).
 * @param {string} options.to - ISO end date (inclusive).
 * @returns {Promise<any[]>} A promise that resolves with an array of entries.
 */
export function getAllEntries({ from, to }) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(STORES.ENTRIES, 'readonly');
        const store = transaction.objectStore(STORES.ENTRIES);
        const index = store.index('date');

        const range = IDBKeyRange.bound(from, to);
        const request = index.getAll(range);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject("Error fetching all entries: " + event.target.error);
    });
}

/**
 * Deletes all entries associated with a specific bank ID.
 * @param {number} bankId The ID of the bank.
 * @returns {Promise<void>}
 */
export function deleteEntriesForBank(bankId) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(STORES.ENTRIES, 'readwrite');
        const store = transaction.objectStore(STORES.ENTRIES);
        const index = store.index('bankId');
        const request = index.openCursor(IDBKeyRange.only(bankId));

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                store.delete(cursor.primaryKey);
                cursor.continue();
            } else {
                resolve();
            }
        };
        request.onerror = (event) => reject("Error deleting entries: " + event.target.error);
    });
}


// --- Settings Specific Functions ---
export const getSetting = (key) => {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(STORES.SETTINGS, 'readonly');
        const store = transaction.objectStore(STORES.SETTINGS);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ? request.result.value : undefined);
        request.onerror = (event) => reject("Error getting setting: " + event.target.error);
    });
};

export const setSetting = (key, value) => update(STORES.SETTINGS, { key, value });
export const getAllSettings = () => getAll(STORES.SETTINGS);

export function applyBackup(backupData) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        // Use all stores in the transaction
        const transaction = db.transaction([STORES.BANKS, STORES.ENTRIES, STORES.SETTINGS], 'readwrite');
        transaction.onerror = (event) => reject("Backup transaction failed: " + event.target.error);
        transaction.oncomplete = () => resolve();

        const banksStore = transaction.objectStore(STORES.BANKS);
        const entriesStore = transaction.objectStore(STORES.ENTRIES);
        const settingsStore = transaction.objectStore(STORES.SETTINGS);

        // Clear all stores
        banksStore.clear();
        entriesStore.clear();
        settingsStore.clear();

        // Add all new data
        backupData.banks.forEach(bank => banksStore.add(bank));
        backupData.entries.forEach(entry => entriesStore.add(entry));
        backupData.settings.forEach(setting => settingsStore.add(setting));
    });
}
