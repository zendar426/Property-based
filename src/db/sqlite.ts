// src/db/sqlite.ts
import path from "path";
import fs from "fs";

// Detectar si estamos en Bun o Node.js y cargar la librería apropiada
function getDatabase() {
    if (typeof Bun !== 'undefined') {
        // Estamos en Bun - usar bun:sqlite
        // @ts-ignore - bun:sqlite solo existe en Bun runtime
        return require("bun:sqlite");
    } else {
        // Estamos en Node.js (Jest) - usar better-sqlite3
        return require("better-sqlite3");
    }
}

export function createDb(filePath?: string) {
    const Database = getDatabase();
    
    let dbFile = filePath;
    if (!dbFile) {
        // por defecto usa data/db.sqlite
        const dataDir = path.resolve(process.cwd(), "data");
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        dbFile = path.join(dataDir, "db.sqlite");
    }

    const db = new Database(dbFile === ":memory:" ? ":memory:" : dbFile);

    // Crear tabla si no existe
    // better-sqlite3 usa .exec() para SQL sin retorno, bun:sqlite usa .run()
    const createTableSQL = `
    CREATE TABLE IF NOT EXISTS produce (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      pricePerKg REAL NOT NULL
    )
  `;
    
    if (typeof db.exec === 'function') {
        db.exec(createTableSQL);
    } else {
        db.run(createTableSQL);
    }

    return db;
}
