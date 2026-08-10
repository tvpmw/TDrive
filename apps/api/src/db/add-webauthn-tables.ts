import postgres from "postgres";

const sql = postgres("postgresql://postgres:postgres@localhost:5432/tdrive");

async function main() {
  console.log("Applying migration...");
  await sql`
    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      credential_id VARCHAR(1024) NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter INTEGER DEFAULT 0 NOT NULL,
      transports TEXT DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT now() NOT NULL
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      challenge TEXT NOT NULL,
      kind VARCHAR(32) DEFAULT 'registration' NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now() NOT NULL
    );
  `;
  console.log("SUCCESS: webauthn_credentials + webauthn_challenges tables created!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
