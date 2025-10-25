const { generateTodayImage } = require('../utils/imageGenerator');
const { AttachmentBuilder } = require('discord.js');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = 'Asia/Tokyo';

function now() {
  return dayjs().tz(TIMEZONE);
}

function getDateKey(date) {
  return date.format('YYYY-MM-DD');
}

/**
 * /today 명령어 핸들러
 * @param {Interaction} interaction - Discord interaction
 * @param {Object} supabase - Supabase 클라이언트
 */
async function handleTodayCommand(interaction, supabase) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const username = interaction.user.globalName || interaction.user.displayName || interaction.user.username;
    const nowDate = now();
    const dateKey = getDateKey(nowDate);

    // 오늘 공부 시간 조회 (시간대 표시를 위해 start_time, end_time도 조회)
    const { data: todayData, error: todayError } = await supabase
      .from('study_records')
      .select('total_minutes, start_time, end_time')
      .eq('user_id', userId)
      .eq('date', dateKey)
      .order('start_time', { ascending: true });

    if (todayError) throw todayError;

    const todayTotal = todayData ? todayData.reduce((sum, row) => sum + row.total_minutes, 0) : 0;
    const studySessions = todayData || [];

    // 오늘 완료한 태스크 조회 (completed_at이 오늘인 것만)
    const todayStart = nowDate.startOf('day').toISOString();
    const todayEnd = nowDate.endOf('day').toISOString();

    const { data: completedTasks, error: tasksError } = await supabase
      .from('todos')
      .select('task')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('completed_at', todayStart)
      .lte('completed_at', todayEnd);

    if (tasksError) throw tasksError;

    const taskList = completedTasks ? completedTasks.map(t => t.task) : [];

    // 유저 정보 조회 (레벨, 티어)
    const { data: userData, error: userError } = await supabase
      .from('discord_users')
      .select('level')
      .eq('user_id', userId)
      .maybeSingle();

    if (userError) throw userError;

    const userLevel = userData?.level || 1;

    // 티어 계산 (간단히 레벨 기반으로)
    let tier = 'Bronze 5';
    if (userLevel >= 245) tier = 'Challenger';
    else if (userLevel >= 239) tier = 'Champion';
    else if (userLevel >= 226) tier = 'Master';
    else if (userLevel >= 201) tier = 'Diamond';
    else if (userLevel >= 151) tier = 'Platinum';
    else if (userLevel >= 101) tier = 'Gold';
    else if (userLevel >= 51) tier = 'Silver';

    // 이미지 생성
    const imageBuffer = await generateTodayImage({
      username: username,
      date: nowDate.format('YYYY年MM月DD日 (ddd)'),
      todayTotal: todayTotal,
      completedTasks: taskList,
      tier: tier,
      level: userLevel,
      studySessions: studySessions
    });

    // Discord에 전송
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'today-summary.png' });

    await interaction.editReply({
      content: '📊 今日の学習要約',
      files: [attachment]
    });

  } catch (error) {
    console.error('handleTodayCommand에서 에러 발생:', error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '이미지 생성 중 오류가 발생했습니다.', ephemeral: true });
    } else {
      await interaction.editReply({ content: '이미지 생성 중 오류가 발생했습니다.' });
    }
  }
}

module.exports = { handleTodayCommand };
