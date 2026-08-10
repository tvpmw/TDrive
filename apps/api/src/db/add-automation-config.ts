import postgres from "postgres";

const sql = postgres("postgresql://postgres:postgres@localhost:5432/tdrive");

async function main() {
  console.log("Applying migration...");
  await sql`
    ALTER TABLE automation_rules
    ADD COLUMN IF NOT EXISTS config JSONB;
  `;
  console.log("SUCCESS: Column automation_rules.config added!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
