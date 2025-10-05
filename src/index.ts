// src/index.ts
import express from "express";
import { createDb } from "./db/sqlite";
import { createProduceRepository } from "./repository/produceRepository";
import type { Produce } from "./types";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// crea DB en archivo por defecto; en desarrollo puedes usar :memory:
const db = createDb(); // o createDb(":memory:") para no persistir
const repo = createProduceRepository(db);

const app = express();
app.use(express.json());

// CREATE
app.post("/produce", async (req, res) => {
    try {
        const { name, type, pricePerKg } = req.body;
        if (!name || !type || pricePerKg === undefined) return res.status(400).json({ error: "Campos faltantes" });
        if (!Object.values(type).includes(type)) return res.status(400).json({ error: "type inválido" });
        const created = await repo.createProduce({ name, type, pricePerKg });
        res.status(201).json(created);
    } catch (err) { res.status(500).json({ error: String(err) }); }
});

// READ (by id)
app.get("/produce/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "id inválido" });
    const item = await repo.getProduceById(id);
    if (!item) return res.status(404).json({ error: "No encontrado" });
    res.json(item);
});

// LIST
app.get("/produce", async (_req, res) => {
    const all = await repo.listProduces();
    res.json(all);
});

// UPDATE
app.put("/produce/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "id inválido" });
    const patch = req.body;
    const updated = await repo.updateProduce(id, patch);
    if (!updated) return res.status(404).json({ error: "No encontrado" });
    res.json(updated);
});

// DELETE
app.delete("/produce/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "id inválido" });
    const ok = await repo.deleteProduce(id);
    if (!ok) return res.status(404).json({ error: "No encontrado" });
    res.status(204).send();
});

// endpoint auxiliar para tests / reset (solo en dev)
app.post("/__test/reset", async (_req, res) => {
    await repo.clearAll();
    res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
