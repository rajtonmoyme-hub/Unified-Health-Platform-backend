const { Pool, Client } = require('pg');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const pool = new Pool({
  ...dbConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

function ensureLocalPostgresRunning() {
  const localPgRoot = path.join(
    process.env.LOCALAPPDATA || '',
    'Programs',
    'PostgreSQL'
  );
  const pgCtl = path.join(localPgRoot, 'bin', 'pg_ctl.exe');
  const dataDir = path.join(localPgRoot, 'data');
  const logFile = path.join(localPgRoot, 'postgres.log');

  if (!fs.existsSync(pgCtl) || !fs.existsSync(dataDir)) {
    return;
  }

  try {
    execFileSync(pgCtl, ['-D', dataDir, 'status'], { stdio: 'ignore' });
  } catch {
    console.log('🔄 Starting local PostgreSQL server...');
    execFileSync(pgCtl, ['-D', dataDir, '-l', logFile, 'start'], { stdio: 'ignore' });
  }
}

async function ensureDatabaseExists() {
  ensureLocalPostgresRunning();

  const adminClient = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: 'postgres',
  });

  await adminClient.connect();
  try {
    const checkRes = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbConfig.database]
    );
    if (checkRes.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE "${dbConfig.database}"`);
      console.log(`✅ Created PostgreSQL database "${dbConfig.database}"`);
    }
  } finally {
    await adminClient.end();
  }
}

async function testDatabaseConnection() {
  await ensureDatabaseExists();
  const client = await pool.connect();
  try {
    const res = await client.query(
      'SELECT current_database() AS db, inet_server_port() AS port, NOW() AS server_time'
    );
    console.log(`✅ PostgreSQL connected successfully`);
    return res.rows[0];
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  testDatabaseConnection,
};
