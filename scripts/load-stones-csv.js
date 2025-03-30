import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const access = {
  user: process.env.DB_USER,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
};

export const db = mysql.createPool(access);

const __dirname = fileURLToPath(new URL(".", import.meta.url)).replace(
  /\/$/,
  ""
);

const getCsvData = () => {
  const filePath = path.join(__dirname, "data.csv");

  // 2. Read the CSV file
  const csvContent = fs.readFileSync(filePath, "utf8");

  // 3. Split into lines
  const lines = csvContent.trim().split(/\r?\n/);

  // 4. The first line should be the header row
  const headers = lines[0].split(",");

  // 5. Parse each subsequent line into an object
  return lines.slice(1).map((line) => {
    // Split the current line by commas
    const values = line.split(",");

    // Combine header names with their corresponding values
    return headers.reduce((obj, header, index) => {
      // If there's no value (like with id=94 retail_price), it becomes ""
      obj[header] = values[index] || "";
      return obj;
    }, {});
  });
};

function convertData(data) {
  // вспомогательная функция для преобразования строк в целые числа (int)
  function toInt(str) {
    if (!str) return 0; // если пусто, возвращаем 0
    // убираем '$' и приводим к целому
    return parseInt(str.replace("$", ""), 10) || 0;
  }

  // вспомогательная функция для преобразования строк в число с плавающей точкой (float)
  function toFloat(str) {
    if (!str) return 0;
    return parseFloat(str) || 0;
  }

  return data.map((item) => ({
    id: toInt(item.id),
    retail_price: toInt(item.retail_price),
    cost_per_sqft: toInt(item.cost_per_sqft),
    length: toFloat(item.length),
    width: toFloat(item.width),
    supplier_id: toInt(item.supplier_id),
  }));
}

async function saveData(data) {
  for (const item of data) {
    await db.execute(
      `UPDATE main.stones SET retail_price = ?, cost_per_sqft = ?, length = ?, width = ?, supplier_id = ? WHERE id = ?`,
      [
        item.retail_price,
        item.cost_per_sqft,
        item.length,
        item.width,
        item.supplier_id,
        item.id,
      ]
    );
  }
}

const data = getCsvData();
const cleanData = convertData(data);
const updateData = await saveData(cleanData);
console.log(updateData);
