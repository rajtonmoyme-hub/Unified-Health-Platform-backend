const fs = require('fs');
const path = require('path');
const { query, testDatabaseConnection } = require('../config/db');

async function runMigrations() {
  await testDatabaseConnection();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await query(sql);
  console.log('✅ Database schema migration completed successfully.');
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err.message);
      process.exit(1);
    });
}

module.exports = { runMigrations };

