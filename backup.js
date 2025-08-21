import * as db from './db.js';

console.log("backup.js loaded");

/**
 * Fetches all data from the database and triggers a download as a JSON file.
 */
export async function exportBackup() {
    try {
        console.log("Starting backup process...");
        const banks = await db.getBanks();
        // We need all entries, not just for a specific date range.
        const entries = await db.getAllEntries({ from: '1970-01-01', to: '9999-12-31' });
        const settings = await db.getAllSettings();

        const backupData = {
            exportedAt: new Date().toISOString(),
            data: {
                banks,
                entries,
                settings,
            }
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `bank-ledger-backup-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log("Backup successful.");
        alert("تم تصدير النسخة الاحتياطية بنجاح.");

    } catch (error) {
        console.error("Backup failed:", error);
        alert("فشل تصدير النسخة الاحتياطية.");
    }
}

/**
 * Reads a JSON backup file, validates it, and applies it to the database.
 * @param {File} file The .json file selected by the user.
 */
export function importBackup(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            return reject("No file selected.");
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const backupData = JSON.parse(event.target.result);

                // Basic validation
                if (!backupData.data || !backupData.data.banks || !backupData.data.entries || !backupData.data.settings) {
                    throw new Error("Invalid backup file structure.");
                }

                await db.applyBackup(backupData.data);
                resolve();

            } catch (error) {
                console.error("Import failed:", error);
                reject(error);
            }
        };
        reader.onerror = () => {
            reject(new Error("Failed to read the file."));
        };
        reader.readAsText(file);
    });
}
