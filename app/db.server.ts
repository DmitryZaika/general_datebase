import mysql, { PoolOptions } from "mysql2/promise";

const access: PoolOptions = {
  user: process.env.DB_USER,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
};

export const db = mysql.createPool(access);
