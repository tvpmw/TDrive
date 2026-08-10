import postgres from "postgres";

const sql = postgres("postgresql://postgres:postgres@localhost:5432/tdrive");

async function main() {
  console.log("Applying bot migrations...");
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS telegram_bot_token_encrypted VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS telegram_allowed_ids VARCHAR(2048);
  `;
  console.log("OK: users columns added");

  await sql`
    CREATE TABLE IF NOT EXISTS bot_links (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL REFERENCES users(id),
      telegram_user_id VARCHAR(64) NOT NULL,
      telegram_username VARCHAR(255),
      telegram_first_name VARCHAR(255),
      linked_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  console.log("OK: bot_links table");
  await sql`CREATE INDEX IF NOT EXISTS idx_bot_links_user_id ON bot_links(user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bot_links_tg_user_id ON bot_links(telegram_user_id);`;

  await sql`
    CREATE TABLE IF NOT EXISTS bot_chat_states (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL REFERENCES users(id),
      telegram_user_id VARCHAR(64) NOT NULL,
      chat_id VARCHAR(64) NOT NULL,
      state VARCHAR(64) NOT NULL DEFAULT 'idle',
      state_data TEXT,
      last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  console.log("OK: bot_chat_states table");
  await sql`CREATE INDEX IF NOT EXISTS idx_bot_chat_states_user_id ON bot_chat_states(user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bot_chat_states_tg_user_id ON bot_chat_states(telegram_user_id);`;

  console.log("SUCCESS: bot migrations applied");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
