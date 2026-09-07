// config/db.js — pool de conexões MySQL (mysql2), única porta de entrada para o banco.
import mysql from 'mysql2/promise';
import { env } from './env.js';

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  // Colunas DECIMAL (uso no estoque/doações) retornam como Number, não string.
  decimalNumbers: true,
});

export { pool };