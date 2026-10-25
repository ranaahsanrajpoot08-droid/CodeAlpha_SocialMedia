// Database connection (MySQL via XAMPP) using a connection pool.
// A pool keeps several connections open and re-uses them, which is faster
// than opening a new connection for every request.
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'social_media_app',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

// Called once when the server starts, so we get a clear message if MySQL is off.
export const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    connection.release();
    console.log('✅ Connected to MySQL database:', process.env.DB_NAME);
    return true;
  } catch (error) {
    console.error('❌ Could not connect to MySQL.');
    console.error('   Reason:', error.code || error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   -> Open the XAMPP Control Panel and click "Start" next to MySQL.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error(`   -> The database "${process.env.DB_NAME}" does not exist. Import database.sql in phpMyAdmin.`);
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   -> Wrong DB_USER / DB_PASSWORD in backend/.env');
    }
    return false;
  }
};

export default pool;
