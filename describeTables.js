const mysql = require('mysql2/promise');

const connectionConfig = {
  host: 'srv1649.hstgr.io',
  port: 3306,
  user: 'u610704689_tamayaz123',
  password: '0d&DBSEb',
  database: 'u610704689_tamayazsecond'
};

async function describeAllTables() {
  const connection = await mysql.createConnection(connectionConfig);
  const [tables] = await connection.query('SHOW TABLES');

  for (let row of tables) {
    const tableName = Object.values(row)[0];
    console.log(`\n Table: ${tableName}`);
    const [columns] = await connection.query(`DESCRIBE \`${tableName}\``);
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type}`);
    });
  }

  await connection.end();
}

describeAllTables().catch(console.error);
