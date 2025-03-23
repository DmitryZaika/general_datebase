import fs from "fs";
import csv from "csv-parser";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const { DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE } = process.env;
if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_DATABASE) {
  throw new Error("Missing DB environment variables!");
}

const db = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE,
});

export async function selectMany(db, query, params = []) {
  try {
    const [rows] = await db.query(query, params);
    return rows;
  } catch {
    return [];
  }
}

export async function selectId(db, query, id) {
  try {
    const [rows] = await db.query(query, [id]);
    if (!rows.length) return undefined;
    return rows[0];
  } catch {
    return undefined;
  }
}

export async function updateRow(db, query, params) {
  try {
    const [result] = await db.query(query, params);
    return result.affectedRows;
  } catch {
    return 0;
  }
}

async function updateRecordsFromCsv(csvPath) {
  const rows = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (row) => {
        rows.push(row);
      })
      .on("end", async () => {
        for (const r of rows) {
          const { id } = r;
          if (!id) continue;
          const retail_price = r.retail_price
            ? r.retail_price.replace(/\$/g, "")
            : null;
          const cost_per_sqft = r.cost_per_sqft
            ? r.cost_per_sqft.replace(/\$/g, "")
            : null;
          const height = r.height ? Number(r.height) : null;
          const width = r.width ? Number(r.width) : null;
          const supplier_id = r.supplier_id ? Number(r.supplier_id) : null;
          const q = `
            UPDATE my_table
            SET retail_price = ?, cost_per_sqft = ?, height = ?, width = ?, supplier_id = ?
            WHERE id = ?
          `;
          await updateRow(db, q, [
            retail_price,
            cost_per_sqft,
            height,
            width,
            supplier_id,
            id,
          ]);
        }
        resolve();
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

(async function main() {
  try {
    await db.query("SELECT 1");
    await updateRecordsFromCsv("path/to/your-csv.csv");
    await db.end();
  } catch (e) {
    process.exit(1);
  }
})();
