import mysql, { PoolOptions } from 'mysql2/promise';

const access: PoolOptions = {
  user: 'root',
  database: 'test',
  password: 'password',
  host: 'localhost',
};

export const db = mysql.createPool(access);