const app = require('./app');
const env = require('./config/env');
const { testDatabaseConnection } = require('./config/db');
const { runMigrations } = require('./database/migrate');

async function startServer() {
  try {
    await testDatabaseConnection();
    await runMigrations();
  } catch (error) {
    console.error(
      `⚠️ Could not connect to PostgreSQL on ${env.db.host}:${env.db.port}: ${error.message}`
    );
  }

  app.listen(env.port, () => {
    console.log(`🚀 Express backend running on http://localhost:${env.port}`);
  });
}

startServer();

