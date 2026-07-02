import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../db/schema.js";
import { purgeArchivedAllTenants } from "./purge-archived-runner.js";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run purge-archived-records");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  try {
    const results = await purgeArchivedAllTenants(db);
    const totals = results.reduce(
      (acc, r) => ({
        studentsPurged: acc.studentsPurged + r.studentsPurged,
        studentsSkipped: acc.studentsSkipped + r.studentsSkipped,
        staffPurged: acc.staffPurged + r.staffPurged,
        staffSkipped: acc.staffSkipped + r.staffSkipped
      }),
      { studentsPurged: 0, studentsSkipped: 0, staffPurged: 0, staffSkipped: 0 }
    );
    return { tenants: results.length, ...totals, results };
  } finally {
    await pool.end();
  }
}

main()
  .then((result) => {
    console.log(JSON.stringify(result));
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
