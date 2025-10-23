require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function listAllUsers() {
  try {
    console.log('\n📋 全ユーザー一覧:\n');

    const { data: users, error } = await supabase
      .from('discord_users')
      .select('user_id, username, display_name, level')
      .order('level', { ascending: false });

    if (error) throw error;

    if (!users || users.length === 0) {
      console.log('❌ ユーザーが見つかりませんでした');
      return;
    }

    console.log(`✅ ${users.length}人のユーザーが登録されています:\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. Level ${user.level} - ${user.display_name || user.username || 'N/A'}`);
      console.log(`   Username: ${user.username || 'N/A'}`);
      console.log(`   User ID: ${user.user_id}\n`);
    });

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

listAllUsers().then(() => process.exit(0));
