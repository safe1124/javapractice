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

async function testStatsPerformance() {
  console.log('\n⏱️  /stats コマンドのパフォーマンステスト\n');

  const userId = '1018863671126016041'; // Pumseong
  const startTime = Date.now();

  const nowDate = now();
  const dateKey = getDateKey(nowDate);
  const weekKey = getWeekKey(nowDate);
  const monthKey = getMonthKey(nowDate);

  console.log('📅 日付情報計算:', Date.now() - startTime, 'ms');

  // 今週の範囲を計算
  const weekStart = nowDate.startOf('isoWeek');
  const weekEnd = weekStart.add(6, 'day');
  const weekStartKey = getDateKey(weekStart);
  const weekEndKey = getDateKey(weekEnd);

  const lastWeekDate = nowDate.subtract(1, 'week');
  const lastWeekKey = getWeekKey(lastWeekDate);

  console.log('📅 週範囲計算:', Date.now() - startTime, 'ms');

  const queryStartTime = Date.now();

  // すべてのクエリを並列実行
  const [
    todayResult,
    weeklyResult,
    weekResult,
    lastWeekResult,
    monthResult,
    userResult,
    totalStudyResult,
    customizationsResult
  ] = await Promise.all([
    supabase.from('study_records').select('total_minutes, start_time, end_time').eq('user_id', userId).eq('date', dateKey),
    supabase.from('study_records').select('date, total_minutes').eq('user_id', userId).gte('date', weekStartKey).lte('date', weekEndKey),
    supabase.from('study_records').select('total_minutes').eq('user_id', userId).eq('week', weekKey),
    supabase.from('study_records').select('total_minutes').eq('user_id', userId).eq('week', lastWeekKey),
    supabase.from('study_records').select('total_minutes').eq('user_id', userId).eq('month', monthKey),
    supabase.from('discord_users').select('level, display_name').eq('user_id', userId).maybeSingle(),
    supabase.from('user_total_study_time').select('total_minutes').eq('user_id', userId).maybeSingle(),
    supabase.from('user_customizations').select('item_type, item_value').eq('user_id', userId).eq('is_active', true)
  ]);

  const queryEndTime = Date.now();
  console.log('🔍 並列クエリ完了:', queryEndTime - queryStartTime, 'ms');

  // データ処理
  const processingStartTime = Date.now();

  const todayData = todayResult.data || [];
  const weeklyData = weeklyResult.data || [];
  const weekData = weekResult.data || [];
  const lastWeekData = lastWeekResult.data || [];
  const monthData = monthResult.data || [];
  const userData = userResult.data;
  const totalStudyData = totalStudyResult.data;
  const customizations = customizationsResult.data || [];

  const todayTotal = todayData.reduce((sum, row) => sum + row.total_minutes, 0);
  let maxFocusMinutes = 0;
  if (todayData.length > 0) {
    maxFocusMinutes = Math.max(...todayData.map(row => row.total_minutes));
  }

  // 曜日ごとに集計
  const weeklyGraph = [];
  for (let i = 0; i < 7; i++) {
    const targetDate = weekStart.add(i, 'day');
    const targetDateKey = getDateKey(targetDate);
    const dayTotal = weeklyData.filter(row => row.date === targetDateKey).reduce((sum, row) => sum + row.total_minutes, 0);
    weeklyGraph.push({ day: i, minutes: dayTotal });
  }

  const weekTotal = weekData.reduce((sum, row) => sum + row.total_minutes, 0);
  const lastWeekTotal = lastWeekData.reduce((sum, row) => sum + row.total_minutes, 0);
  const monthTotal = monthData.reduce((sum, row) => sum + row.total_minutes, 0);

  const userLevel = userData?.level || 1;
  const totalMinutes = totalStudyData?.total_minutes || 0;

  console.log('📊 データ処理完了:', Date.now() - processingStartTime, 'ms');

  const totalTime = Date.now() - startTime;

  console.log('\n📈 結果:');
  console.log('  - 今日:', todayTotal, '分');
  console.log('  - 今週:', weekTotal, '分');
  console.log('  - 今月:', monthTotal, '分');
  console.log('  - レベル:', userLevel);
  console.log('  - 総時間:', totalMinutes, '分');
  console.log('  - 最高集中力:', maxFocusMinutes, '分');
  console.log('  - 週間グラフ:', weeklyGraph.map(d => d.minutes).join(', '), '分');

  console.log('\n⏱️  総処理時間:', totalTime, 'ms');

  if (totalTime > 3000) {
    console.log('❌ 3秒を超えています！最適化が必要です。');
  } else {
    console.log('✅ 3秒以内に完了しました。');
  }
}

testStatsPerformance().then(() => process.exit(0));
