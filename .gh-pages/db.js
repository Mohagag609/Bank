// طبقة IndexedDB: فتح القاعدة، المتاجر، عمليات CRUD مع وعود

const DB_NAME = 'bank-ledger-db';
const DB_VERSION = 1;

function openDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = (event) => {
			const db = request.result;
			// banks store
			if (!db.objectStoreNames.contains('banks')) {
				const banks = db.createObjectStore('banks', { keyPath: 'id', autoIncrement: true });
				banks.createIndex('name', 'name', { unique: false });
			}
			// entries store
			if (!db.objectStoreNames.contains('entries')) {
				const entries = db.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
				entries.createIndex('bankId', 'bankId', { unique: false });
				entries.createIndex('date', 'date', { unique: false });
				entries.createIndex('type', 'type', { unique: false });
			}
			// settings store
			if (!db.objectStoreNames.contains('settings')) {
				db.createObjectStore('settings', { keyPath: 'key' });
			}
		};
		request.onsuccess = async () => {
			const db = request.result;
			try {
				await seedIfEmpty(db);
				resolve(db);
			} catch (e) {
				reject(e);
			}
		};
		request.onerror = () => reject(request.error);
	});
}

async function seedIfEmpty(db) {
	// seed settings defaults
	await writeSetting(db, { key: 'fiscalStartMonth', value: 7 });
	await writeSetting(db, { key: 'fiscalEndMonth', value: 6 });
	const fixed = await readSetting(db, 'fixedDate');
	if (!fixed) {
		await writeSetting(db, { key: 'fixedDate', value: null });
	}
	// seed banks if none
	const hasBanks = await countStore(db, 'banks');
	if (hasBanks === 0) {
		const bank1 = await addBankInternal(db, { name: 'البنك الأهلي', iban: '', openingBalance: 0, createdAt: new Date().toISOString() });
		const bank2 = await addBankInternal(db, { name: 'بنك مصر', iban: '', openingBalance: 0, createdAt: new Date().toISOString() });
		// seed entries July/August current fiscal year
		const now = new Date();
		const currentYear = now.getFullYear();
		const julyYear = (now.getMonth() + 1) >= 7 ? currentYear : currentYear - 1;
		const sample = [
			{ bankId: bank1.id, type: 'debit', description: 'إيداع نقدي', date: `${julyYear}-07-05`, amount: 1500.00 },
			{ bankId: bank1.id, type: 'credit', description: 'سحب شيك', date: `${julyYear}-07-10`, amount: 500.00 },
			{ bankId: bank1.id, type: 'debit', description: 'تحويل وارد', date: `${julyYear}-08-02`, amount: 2200.00 },
			{ bankId: bank2.id, type: 'credit', description: 'رسوم بنك', date: `${julyYear}-07-15`, amount: 75.50 },
			{ bankId: bank2.id, type: 'debit', description: 'حصيلة مبيعات', date: `${julyYear}-08-07`, amount: 3200.00 },
			{ bankId: bank2.id, type: 'credit', description: 'تحويل صادر', date: `${julyYear}-08-12`, amount: 1200.00 }
		];
		for (const e of sample) { await addEntryInternal(db, e); }
	}
}

function tx(db, storeNames, mode = 'readonly') {
	return db.transaction(storeNames, mode);
}

function countStore(db, storeName) {
	return new Promise((resolve, reject) => {
		const t = tx(db, [storeName]);
		const req = t.objectStore(storeName).count();
		req.onsuccess = () => resolve(req.result || 0);
		req.onerror = () => reject(req.error);
	});
}

function addBankInternal(db, bank) {
	return new Promise((resolve, reject) => {
		const t = tx(db, ['banks'], 'readwrite');
		const req = t.objectStore('banks').add(bank);
		req.onsuccess = () => resolve({ ...bank, id: req.result });
		req.onerror = () => reject(req.error);
	});
}

function addEntryInternal(db, entry) {
	return new Promise((resolve, reject) => {
		const t = tx(db, ['entries'], 'readwrite');
		const req = t.objectStore('entries').add(entry);
		req.onsuccess = () => resolve({ ...entry, id: req.result });
		req.onerror = () => reject(req.error);
	});
}

function writeSetting(db, setting) {
	return new Promise((resolve, reject) => {
		const t = tx(db, ['settings'], 'readwrite');
		const req = t.objectStore('settings').put(setting);
		req.onsuccess = () => resolve(setting);
		req.onerror = () => reject(req.error);
	});
}

function readSetting(db, key) {
	return new Promise((resolve, reject) => {
		const t = tx(db, ['settings']);
		const req = t.objectStore('settings').get(key);
		req.onsuccess = () => resolve(req.result || null);
		req.onerror = () => reject(req.error);
	});
}

export const db = {
	open: openDB,
	async addBank(bank) {
		const database = await openDB();
		const toAdd = {
			name: bank.name,
			iban: bank.iban || '',
			openingBalance: Number(bank.openingBalance || 0),
			createdAt: new Date().toISOString()
		};
		return addBankInternal(database, toAdd);
	},
	async updateBank(bank) {
		const database = await openDB();
		return new Promise((resolve, reject) => {
			const t = tx(database, ['banks'], 'readwrite');
			const req = t.objectStore('banks').put(bank);
			req.onsuccess = () => resolve(bank);
			req.onerror = () => reject(req.error);
		});
	},
	async deleteBank(id) {
		const database = await openDB();
		// تحقق من وجود قيود
		const hasEntries = await new Promise((resolve, reject) => {
			const t = tx(database, ['entries']);
			const idx = t.objectStore('entries').index('bankId');
			const range = IDBKeyRange.only(Number(id));
			let found = false;
			const req = idx.openCursor(range);
			req.onsuccess = (e) => {
				const cursor = e.target.result;
				if (cursor) { found = true; resolve(true); }
				else resolve(false);
			};
			req.onerror = () => reject(req.error);
		});
		if (hasEntries) {
			throw new Error('لا يمكن حذف البنك لوجود قيود مرتبطة به.');
		}
		return new Promise((resolve, reject) => {
			const t = tx(database, ['banks'], 'readwrite');
			const req = t.objectStore('banks').delete(Number(id));
			req.onsuccess = () => resolve(true);
			req.onerror = () => reject(req.error);
		});
	},
	async listBanks() {
		const database = await openDB();
		return new Promise((resolve, reject) => {
			const t = tx(database, ['banks']);
			const req = t.objectStore('banks').getAll();
			req.onsuccess = () => resolve(req.result || []);
			req.onerror = () => reject(req.error);
		});
	},
	async addEntry(entry) {
		const database = await openDB();
		const toAdd = {
			bankId: Number(entry.bankId),
			type: entry.type,
			description: entry.description,
			date: entry.date,
			amount: Number(entry.amount)
		};
		return addEntryInternal(database, toAdd);
	},
	async updateEntry(entry) {
		const database = await openDB();
		return new Promise((resolve, reject) => {
			const t = tx(database, ['entries'], 'readwrite');
			const req = t.objectStore('entries').put(entry);
			req.onsuccess = () => resolve(entry);
			req.onerror = () => reject(req.error);
		});
	},
	async deleteEntry(id) {
		const database = await openDB();
		return new Promise((resolve, reject) => {
			const t = tx(database, ['entries'], 'readwrite');
			const req = t.objectStore('entries').delete(Number(id));
			req.onsuccess = () => resolve(true);
			req.onerror = () => reject(req.error);
		});
	},
	async getEntries({ bankId, from, to, type } = {}) {
		const database = await openDB();
		return new Promise((resolve, reject) => {
			const t = tx(database, ['entries']);
			const store = t.objectStore('entries');
			let req;
			if (bankId != null) {
				const idx = store.index('bankId');
				req = idx.openCursor(IDBKeyRange.only(Number(bankId)));
			} else {
				req = store.openCursor();
			}
			const results = [];
			req.onsuccess = (e) => {
				const cursor = e.target.result;
				if (cursor) {
					const value = cursor.value;
					const okType = type ? value.type === type : true;
					const okFrom = from ? value.date >= from : true;
					const okTo = to ? value.date <= to : true;
					if (okType && okFrom && okTo) results.push(value);
					cursor.continue();
				} else {
					resolve(results);
				}
			};
			req.onerror = () => reject(req.error);
		});
	},
	async getSettings(keys = []) {
		const database = await openDB();
		return new Promise((resolve, reject) => {
			const t = tx(database, ['settings']);
			const store = t.objectStore('settings');
			if (!keys.length) {
				const req = store.getAll();
				req.onsuccess = () => resolve(Object.fromEntries((req.result || []).map(s => [s.key, s.value])));
				req.onerror = () => reject(req.error);
				return;
			}
			const out = {};
			let remaining = keys.length;
			keys.forEach(key => {
				const r = store.get(key);
				r.onsuccess = () => { out[key] = r.result ? r.result.value : null; if (--remaining === 0) resolve(out); };
				r.onerror = () => reject(r.error);
			});
		});
	},
	async setSetting(key, value) {
		const database = await openDB();
		return writeSetting(database, { key, value });
	}
};

export default db;

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
