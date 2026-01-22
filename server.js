import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";
import { randomUUID } from "crypto";

// ===================== CONFIG =====================
dotenv.config();

const { Pool } = pkg;
const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

// ===================== NEON CONNECTION =====================
console.log("DATABASE_URL =", process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// testa conexão
pool.query("SELECT 1")
  .then(() => console.log(">>> CONEXÃO COM NEON OK"))
  .catch(err => console.error(">>> ERRO NA CONEXÃO NEON:", err.message));

// ===================== ROOT =====================
app.get("/", (req, res) => {
  res.send("API Estoque rodando");
});

// ===================== INSUMOS =====================

// listar insumos
app.get("/insumos", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT cod, nome, un, custo, ativo FROM insumos ORDER BY cod"
    );
    res.json(r.rows);
  } catch (err) {
    console.error("Erro ao buscar insumos:", err);
    res.status(500).json({ erro: "Erro ao buscar insumos" });
  }
});

// cadastrar insumo
app.post("/insumos", async (req, res) => {
  try {
    const { cod, nome, un, custo } = req.body;

    if (!cod || !nome || !un || custo === undefined) {
      return res.status(400).json({ erro: "Dados incompletos" });
    }

    await pool.query(
      `INSERT INTO insumos (cod, nome, un, custo, ativo)
       VALUES ($1, $2, $3, $4, true)`,
      [cod, nome, un, custo]
    );

    res.sendStatus(201);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ erro: "COD já existe" });
    }
    console.error("Erro ao salvar insumo:", err);
    res.status(500).json({ erro: "Erro ao salvar insumo" });
  }
});

// atualizar custo / ativo
app.patch("/insumos/:cod", async (req, res) => {
  try {
    const { cod } = req.params;
    const { custo, ativo } = req.body;

    await pool.query(
      `UPDATE insumos
       SET custo = $1,
           ativo = $2
       WHERE cod = $3`,
      [custo, ativo, cod]
    );

    res.sendStatus(204);
  } catch (err) {
    console.error("Erro ao atualizar insumo:", err);
    res.status(500).json({ erro: "Erro ao atualizar insumo" });
  }
});

// ===================== BALANÇOS =====================

// listar balanços
app.get("/balancos", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT
         id,
         data_hora,
         cmv,
         compras,
         faturamento,
         estoque_final,
         snapshot
       FROM balancos
       ORDER BY data_hora DESC`
    );

    res.json(r.rows);
  } catch (err) {
    console.error("Erro ao buscar balanços:", err);
    res.status(500).json({ erro: "Erro ao buscar balanços" });
  }
});

// salvar balanço
app.post("/balancos", async (req, res) => {
  try {
    const {
      cmv,
      compras,
      faturamento,
      estoque_final,
      snapshot
    } = req.body;

    if (
      cmv === undefined ||
      compras === undefined ||
      faturamento === undefined ||
      estoque_final === undefined ||
      !snapshot
    ) {
      return res.status(400).json({ erro: "Dados incompletos do balanço" });
    }

    const id = randomUUID();

    await pool.query(
      `INSERT INTO balancos
       (id, data_hora, cmv, compras, faturamento, estoque_final, snapshot)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6::jsonb)`,
      [id, cmv, compras, faturamento, estoque_final, JSON.stringify(snapshot)]
    );

    res.status(201).json({ sucesso: true });
  } catch (err) {
    console.error("ERRO POST /balancos:", err);
    res.status(500).json({ erro: err.message });
  }
});

// ===================== START =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("API rodando na porta", PORT);
});

