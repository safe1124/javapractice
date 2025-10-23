require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const isoWeek = require('dayjs/plugin/isoWeek');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

const TIMEZONE = 'Asia/Seoul';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function now() {
  return dayjs().tz(TIMEZONE);
}

function getDateKey(date) {
  return date.format('YYYY-MM-DD');
}

function getWeekKey(date) {
  const isoWeekNumber = date.isoWeek();
  const isoWeekYearValue = typeof date.isoWeekYear === 'function' ? date.isoWeekYear() : date.year();
  const paddedWeek = String(isoWeekNumber).padStart(2, '0');
  return `${isoWeekYearValue}-W${paddedWeek}`;
}

function getMonthKey(date) {
  return date.format('YYYY-MM');
}

async function getUserStats(username) {
  try {
    console.log(`\n🔍 検索中: ${username}`);

    // ユーザー情報を検索
    const { data: users, error: userError } = await supabase
      .from('discord_users')
      .select('user_id, username, display_name, level')
      .or(`username.ilike.%${username}%,display_name.ilike.%${username}%`);

    if (userError) throw userError;

    if (!users || users.length === 0) {
      console.log('❌ ユーザーが見つかりませんでした');
      return;
    }

    console.log(`\n✅ ${users.length}人のユーザーを見つけました:\n`);

    for (const user of users) {
      const userId = user.user_id;
      console.log(`\n📊 ユーザー: ${user.display_name || user.username}`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Level: ${user.level}`);

      const nowDate = now();
      const dateKey = getDateKey(nowDate);
      const weekKey = getWeekKey(nowDate);
      const monthKey = getMonthKey(nowDate);

      // 総勉強時間
      const { data: totalData } = await supabase
        .from('user_total_study_time')
        .select('total_minutes')
        .eq('user_id', userId)
        .maybeSingle();

      // 今日
      const { data: todayData } = await supabase
        .from('study_records')
        .select('total_minutes')
        .eq('user_id', userId)
        .eq('date', dateKey);

      const todayTotal = todayData ? todayData.reduce((sum, row) => sum + row.total_minutes, 0) : 0;

      // 今週
      const { data: weekData } = await supabase
        .from('study_records')
        .select('total_minutes')
        .eq('user_id', userId)
        .eq('week', weekKey);

      const weekTotal = weekData ? weekData.reduce((sum, row) => sum + row.total_minutes, 0) : 0;

      // 今月
      const { data: monthData } = await supabase
        .from('study_records')
        .select('total_minutes')
        .eq('user_id', userId)
        .eq('month', monthKey);

      const monthTotal = monthData ? monthData.reduce((sum, row) => sum + row.total_minutes, 0) : 0;

      console.log(`   総勉強時間: ${totalData?.total_minutes || 0}分`);
      console.log(`   今日: ${todayTotal}分`);
      console.log(`   今週: ${weekTotal}分`);
      console.log(`   今月: ${monthTotal}分`);
    }

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

// 実行
getUserStats('yuruyuchan44').then(() => process.exit(0));
