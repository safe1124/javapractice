require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function calculateLevel(totalMinutes) {
  if (totalMinutes < 5) return 1;

  // Level 1-150: 5分/レベル (累積: 0-745分)
  if (totalMinutes < 745) {
    return Math.min(150, 1 + Math.floor(totalMinutes / 5));
  }

  // Level 150-160: 6分/レベル (累積: 745-805分)
  if (totalMinutes < 805) {
    return 150 + Math.floor((totalMinutes - 745) / 6);
  }

  // Level 160-170: 7分/レベル (累積: 805-875分)
  if (totalMinutes < 875) {
    return 160 + Math.floor((totalMinutes - 805) / 7);
  }

  // Level 170-180: 9分/レベル (累積: 875-965分)
  if (totalMinutes < 965) {
    return 170 + Math.floor((totalMinutes - 875) / 9);
  }

  // Level 180-200: 10分/レベル (累積: 965-1165分)
  if (totalMinutes < 1165) {
    return 180 + Math.floor((totalMinutes - 965) / 10);
  }

  // Level 200-210: 15分/レベル (累積: 1165-1315分)
  if (totalMinutes < 1315) {
    return 200 + Math.floor((totalMinutes - 1165) / 15);
  }

  // Level 210-220: 20分/レベル (累積: 1315-1515分)
  if (totalMinutes < 1515) {
    return 210 + Math.floor((totalMinutes - 1315) / 20);
  }

  // Level 220-250: 30分/レベル (累積: 1515-2415分)
  if (totalMinutes < 2415) {
    return 220 + Math.floor((totalMinutes - 1515) / 30);
  }

  return 250; // 最大レベル
}

async function recalculateAllLevels() {
  try {
    console.log('\n🔄 全ユーザーのレベルを再計算します...\n');

    // 全ユーザーの総勉強時間を取得
    const { data: studyData, error: studyError } = await supabase
      .from('user_total_study_time')
      .select('user_id, total_minutes');

    if (studyError) throw studyError;

    if (!studyData || studyData.length === 0) {
      console.log('❌ ユーザーデータが見つかりません');
      return;
    }

    console.log(`✅ ${studyData.length}人のユーザーを処理します\n`);

    for (const user of studyData) {
      const newLevel = await calculateLevel(user.total_minutes);

      // discord_usersテーブルを更新
      const { error: updateError } = await supabase
        .from('discord_users')
        .update({
          level: newLevel,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.user_id);

      if (updateError) {
        console.error(`❌ ${user.user_id} の更新に失敗:`, updateError);
      } else {
        console.log(`✅ ${user.user_id}: ${user.total_minutes}分 → Level ${newLevel}`);
      }
    }

    console.log('\n🎉 全ユーザーのレベル再計算が完了しました！\n');
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

recalculateAllLevels().then(() => process.exit(0));
