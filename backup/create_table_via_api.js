require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function createTable() {
  console.log('📝 user_customizations テーブルを作成しています...');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS user_customizations (
          id BIGSERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          item_name TEXT NOT NULL,
          item_type TEXT NOT NULL,
          item_value TEXT NOT NULL,
          purchased_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, item_id)
        );

        CREATE INDEX IF NOT EXISTS idx_user_customizations_user_id ON user_customizations(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_customizations_item_type ON user_customizations(item_type);
      `
    });

    if (error) throw error;
    console.log('✅ テーブル作成完了！');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
  }
}

createTable();
