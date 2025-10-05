// src/repository/produceRepository.ts
import type {Produce} from "../types";

type AnyDb = any; // bun:sqlite no trae types en TS por defecto; usar `any` para evitar fricción.

export function createProduceRepository(db: AnyDb) {
    // Helper para ejecutar queries - better-sqlite3 usa .prepare().run() mientras bun:sqlite usa .run()
    const runQuery = (sql: string, params: any[]) => {
        if (typeof db.prepare === 'function') {
            // better-sqlite3
            return db.prepare(sql).run(...params);
        } else {
            // bun:sqlite
            return db.run(sql, params);
        }
    };
    
    const getQuery = (sql: string, params: any[]) => {
        if (typeof db.prepare === 'function') {
            // better-sqlite3
            return db.prepare(sql).get(...params);
        } else {
            // bun:sqlite
            return db.query(sql).get(...params);
        }
    };
    
    const allQuery = (sql: string, params: any[] = []) => {
        if (typeof db.prepare === 'function') {
            // better-sqlite3
            return db.prepare(sql).all(...params);
        } else {
            // bun:sqlite
            return db.query(sql).all(...params);
        }
    };

    return {
        async createProduce(item: Omit<Produce, "id">): Promise<Produce> {
            const info = runQuery(
                "INSERT INTO produce (name, type, pricePerKg) VALUES (?, ?, ?)",
                [item.name, item.type, item.pricePerKg]
            );
            const id = info.lastInsertRowid as number;
            return { ...item, id };
        },

        async getProduceById(id: number): Promise<Produce | null> {
            const row = getQuery(
                "SELECT id, name, type, pricePerKg FROM produce WHERE id = ? LIMIT 1",
                [id]
            );
            if (!row) return null;
            
            // better-sqlite3 devuelve objetos, bun:sqlite devuelve arrays
            if (Array.isArray(row)) {
                const [rid, name, type, pricePerKg] = row;
                return { id: Number(rid), name: String(name), type: String(type) as any, pricePerKg: Number(pricePerKg) };
            } else {
                return {
                    id: Number(row.id),
                    name: String(row.name),
                    type: String(row.type) as any,
                    pricePerKg: Number(row.pricePerKg)
                };
            }
        },

        async listProduces(): Promise<Produce[]> {
            const rows = allQuery("SELECT id, name, type, pricePerKg FROM produce");
            
            return rows.map((r: any) => {
                if (Array.isArray(r)) {
                    return { id: Number(r[0]), name: String(r[1]), type: String(r[2]) as any, pricePerKg: Number(r[3]) };
                } else {
                    return {
                        id: Number(r.id),
                        name: String(r.name),
                        type: String(r.type) as any,
                        pricePerKg: Number(r.pricePerKg)
                    };
                }
            });
        },

        async updateProduce(id: number, patch: Partial<Produce>): Promise<Produce | null> {
            const fields: string[] = [];
            const values: any[] = [];
            if (patch.name !== undefined) { fields.push("name = ?"); values.push(patch.name); }
            if (patch.type !== undefined) { fields.push("type = ?"); values.push(patch.type); }
            if (patch.pricePerKg !== undefined) { fields.push("pricePerKg = ?"); values.push(patch.pricePerKg); }

            if (fields.length === 0) return this.getProduceById(id);
            values.push(id);
            const sql = `UPDATE produce SET ${fields.join(", ")} WHERE id = ?`;
            runQuery(sql, values);
            return this.getProduceById(id);
        },

        async deleteProduce(id: number): Promise<boolean> {
            const info = runQuery("DELETE FROM produce WHERE id = ?", [id]);
            return (info.changes ?? 0) > 0;
        },

        // utilidad para tests: limpiar tabla
        async clearAll(): Promise<void> {
            runQuery("DELETE FROM produce", []);
            // reset autoincrement (opcional)
            runQuery("DELETE FROM sqlite_sequence WHERE name='produce'", []);
        }
    };
}
