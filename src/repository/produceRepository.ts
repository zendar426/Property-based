// src/repository/produceRepository.ts
import type {Produce} from "../types";

type AnyDb = any; // bun:sqlite no trae types en TS por defecto; usar `any` para evitar fricción.

export function createProduceRepository(db: AnyDb) {
    return {
        async createProduce(item: Omit<Produce, "id">): Promise<Produce> {
            const stmt = db.prepare("INSERT INTO produce (name, type, pricePerKg) VALUES (?, ?, ?)");
            const info = stmt.run(item.name, item.type, item.pricePerKg);
            const id = info.lastInsertRowid as number;
            return { ...item, id };
        },

        async getProduceById(id: number): Promise<Produce | null> {
            // db.query(...).all() o .first() según la API
            const row = db.query("SELECT id, name, type, pricePerKg FROM produce WHERE id = ? LIMIT 1", [id]).first();
            if (!row) return null;
            const [rid, name, type, pricePerKg] = row;
            return { id: Number(rid), name: String(name), type: String(type) as any, pricePerKg: Number(pricePerKg) };
        },

        async listProduces(): Promise<Produce[]> {
            const rows = db.query("SELECT id, name, type, pricePerKg FROM produce").all();
            return rows.map((r: any[]) => ({ id: Number(r[0]), name: String(r[1]), type: String(r[2]) as any, pricePerKg: Number(r[3]) }));
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
            db.run(sql, values);
            return this.getProduceById(id);
        },

        async deleteProduce(id: number): Promise<boolean> {
            const info = db.run("DELETE FROM produce WHERE id = ?", [id]);
            return (info.changes ?? 0) > 0;
        },

        // utilidad para tests: limpiar tabla
        async clearAll(): Promise<void> {
            db.run("DELETE FROM produce");
            // reset autoincrement (opcional)
            db.run("DELETE FROM sqlite_sequence WHERE name='produce'");
        }
    };
}
