import postgres from "postgres";

const sql = postgres("postgresql://postgres:postgres@localhost:5432/tdrive");

async function main() {
  console.log("Applying migration...");
  await sql`
    ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS num_value INTEGER;
  `;
  console.log("SUCCESS: Column app_settings.num_value added!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
