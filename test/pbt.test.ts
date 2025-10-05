// tests/pbt.test.ts
import fc from "fast-check";
import axios from "axios";
import express from "express";
import type { Server } from "http";

import { createDb } from "../src/db/sqlite";
import { createProduceRepository } from "../src/repository/produceRepository";
import { Type } from "../src/types";
import type { Produce } from "../src/types";

const buildAppWithRepo = (repo: ReturnType<typeof createProduceRepository>) => {
    const app = express();
    app.use(express.json());

    // CREATE
    app.post("/produce", async (req, res) => {
        try {
            const { name, type, pricePerKg } = req.body;
            if (!name || !type || pricePerKg === undefined) return res.status(400).json({ error: "Missing fields" });
            if (!Object.values(Type).includes(type)) return res.status(400).json({ error: "Invalid type" });
            const created = await repo.createProduce({ name, type, pricePerKg });
            res.status(201).json(created);
        } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // READ by id
    app.get("/produce/:id", async (req, res) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
        const item = await repo.getProduceById(id);
        if (!item) return res.status(404).json({ error: "Not found" });
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
        if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
        const patch = req.body;
        const updated = await repo.updateProduce(id, patch);
        if (!updated) return res.status(404).json({ error: "Not found" });
        res.json(updated);
    });

    // DELETE
    app.delete("/produce/:id", async (req, res) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
        const ok = await repo.deleteProduce(id);
        if (!ok) return res.status(404).json({ error: "Not found" });
        res.status(204).send();
    });

    // test-only reset endpoint
    app.post("/__test/reset", async (_req, res) => {
        await repo.clearAll();
        res.status(200).json({ ok: true });
    });

    return app;
};

describe("Property-based lifecycle test (create → read → list → update → delete)", () => {
    let server: Server;
    let baseUrl: string;

    beforeAll((done) => {
        // create in-memory DB and repository
        const db = createDb(":memory:");
        const repo = createProduceRepository(db);
        const app = buildAppWithRepo(repo);

        server = app.listen(0, () => {
            // determine port
            // @ts-ignore - address can be string or object
            const addr = server.address();
            let port: number;
            if (typeof addr === "string") {
                // unlikely for TCP, but handle just in case
                port = Number(addr.split(":").pop() || 3000);
            } else {
                port = addr ? (addr as any).port : 3000;
            }
            baseUrl = `http://127.0.0.1:${port}`;
            done();
        });
    });

    afterAll((done) => {
        server.close(() => done());
    });

    test(
        "produce lifecycle property (create -> read -> list -> update -> read -> delete -> not found)",
        async () => {
            // property: generate name, type, initial price, new price
            await fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 40 }), // name
                    fc.constantFrom(Type.FRUIT, Type.VEGETABLE), // type
                    fc.float({ min: 0, max: 1000 }).map(n => Math.round(n * 100) / 100), // pricePerKg initial
                    fc.float({ min: 0, max: 2000 }).map(n => Math.round(n * 100) / 100), // pricePerKg update
                    async (name, type, priceInitial, priceUpdated) => {
                        // reset server DB for isolation
                        await axios.post(`${baseUrl}/__test/reset`);

                        // 1) CREATE
                        const createResp = await axios.post<Produce>(`${baseUrl}/produce`, {
                            name,
                            type,
                            pricePerKg: priceInitial
                        });
                        expect(createResp.status).toBe(201);
                        const created = createResp.data;
                        expect(created.id).toBeDefined();
                        expect(created.name).toBe(name);
                        expect(created.type).toBe(type);
                        expect(created.pricePerKg).toBeCloseTo(priceInitial, 4);

                        const id = created.id!;

                        // 2) READ by id
                        const getResp = await axios.get<Produce>(`${baseUrl}/produce/${id}`);
                        expect(getResp.status).toBe(200);
                        const fetched = getResp.data;
                        expect(fetched.id).toBe(id);
                        expect(fetched.name).toBe(name);
                        expect(fetched.type).toBe(type);
                        expect(fetched.pricePerKg).toBeCloseTo(priceInitial, 4);

                        // 3) LIST includes the created entry
                        const listResp = await axios.get<Produce[]>(`${baseUrl}/produce`);
                        expect(Array.isArray(listResp.data)).toBe(true);
                        expect(listResp.data.some(p => p.id === id)).toBeTruthy();

                        // 4) UPDATE (change price)
                        const updResp = await axios.put<Produce>(`${baseUrl}/produce/${id}`, { pricePerKg: priceUpdated });
                        expect(updResp.status).toBe(200);
                        const updated = updResp.data;
                        expect(updated.id).toBe(id);
                        expect(updated.pricePerKg).toBeCloseTo(priceUpdated, 4);
                        // ensure name & type unchanged
                        expect(updated.name).toBe(name);
                        expect(updated.type).toBe(type);

                        // 5) READ again -> reflects updated value
                        const get2 = await axios.get<Produce>(`${baseUrl}/produce/${id}`);
                        expect(get2.data.pricePerKg).toBeCloseTo(priceUpdated, 4);

                        // 6) DELETE
                        const del = await axios.delete(`${baseUrl}/produce/${id}`);
                        expect(del.status).toBe(204);

                        // 7) READ after delete -> 404
                        let got404 = false;
                        try {
                            await axios.get(`${baseUrl}/produce/${id}`);
                        } catch (err: any) {
                            const status = err?.response?.status;
                            if (status === 404) got404 = true;
                        }
                        expect(got404).toBeTruthy();
                    }
                ),
                { numRuns: 100 } // ajusta segun tu paciencia/CI
            );
        },
        120_000 // timeout máximo del test en ms (aumenta si quieres más runs)
    );
});
