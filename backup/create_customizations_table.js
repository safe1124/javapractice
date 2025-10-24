require('dotenv').config();
const { Client } = require('pg');

async function createTable() {
  console.log('📝 user_customizations テーブルを作成しています...');

  // Supabase URLからホスト名を抽出
  const supabaseUrl = process.env.SUPABASE_URL;
  const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)[1];

  const client = new Client({
    host: `db.${projectId}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ データベースに接続しました');

    const sql = `
      -- user_customizations テーブル (購入したアイテムを保存)
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

      -- インデックス作成
      CREATE INDEX IF NOT EXISTS idx_user_customizations_user_id ON user_customizations(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_customizations_item_type ON user_customizations(item_type);
    `;

    await client.query(sql);
    console.log('✅ テーブル作成完了！');

    // 確認
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_customizations'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 作成されたカラム:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    console.log('\n💡 ヒント: データベースパスワードが必要です。');
    console.log('Supabase Dashboard → Project Settings → Database → Connection String (URI) からパスワードを確認してください。');
    console.log('\n.envファイルに以下を追加してください:');
    console.log('SUPABASE_DB_PASSWORD=your_database_password');
  } finally {
    await client.end();
  }
}

createTable();
