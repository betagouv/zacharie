const pg = require("pg");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.PGBASEURL || !process.env.PGDATABASE) {
  console.log("PGBASEURL and PGDATABASE env variables not set");
  process.exit(1);
}

if (process.env.PGDATABASE !== "zacharietest") {
  console.log("PGDATABASE must be set to zacharietest");
  process.exit(1);
}

async function createDb() {
  const client = new pg.Client({
    connectionString: `${process.env.PGBASEURL}/postgres`,
  });
  await client.connect();
  await client.query("DROP DATABASE IF EXISTS zacharietest");
  await client.query("CREATE DATABASE zacharietest");
  await client.end();
}

(async () => {
  try {
    await createDb();
    console.log("Database initialized successfully!");
    process.exit(0);
  } catch (err) {
    console.error(err);
  }
})();
