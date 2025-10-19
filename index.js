require('dotenv').config();

const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const isoWeek = require('dayjs/plugin/isoWeek');
const http = require('http');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

const TIMEZONE = 'Asia/Seoul';
const COLOR_PRIMARY = 0x5865f2;
const COLOR_SUCCESS = 0x57f287;
const COLOR_DANGER = 0xed4245;
const GUILD_ID = '1428937053554348064';

// Supabase 初期化
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log('☁️ Supabaseデータベースを使用します');

// この関数は分数でティアを決定します
function getTierByMinutes(minutes) {
  const safeMinutes = Math.max(Number(minutes) || 0, 0);
  
  if (safeMinutes >= 70 * 60) return 'チャレンジャー 🔥';
  if (safeMinutes >= 60 * 60) return 'グランドマスター 👑';
  if (safeMinutes >= 50 * 60) return 'マスター ⭐';
  if (safeMinutes >= 40 * 60) return 'ダイヤモンド 💎';
  if (safeMinutes >= 30 * 60) return 'プラチナ 🤍';
  if (safeMinutes >= 20 * 60) return 'ゴールド 🏆';
  if (safeMinutes >= 10 * 60) return 'シルバー 🥈';
  if (safeMinutes >= 5 * 60) return 'ブロンズ 🥉';
  return 'ノービス 🌱';
}

const activeSessions = new Map();
const voiceSessions = new Map();
const pomodoroSessions = new Map();
const chatRateLimits = new Map(); // チャットボットAPI レート制限

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

if (!process.env.DISCORD_TOKEN) {
  console.warn('.envにDISCORD_TOKENを設定してください。');
}

const slashCommands = [
  new SlashCommandBuilder()
    .setName('startstudy')
    .setDescription('勉強開始時間を記録します')
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('pausestudy')
    .setDescription('勉強を一時停止します')
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('stopstudy')
    .setDescription('勉強を終了してセッションを保存します')
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('今月の勉強時間ランキングを表示します')
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('あなたの今日・今週・今月の勉強記録を表示します')
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('globalstats')
    .setDescription('全員分の勉強時間統計を表示します')
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('todoadd')
    .setDescription('ToDoを追加します')
    .addStringOption((option) =>
      option
        .setName('content')
        .setDescription('追加したいToDoの内容')
        .setRequired(true)
        .setMaxLength(200)
    )
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('todolist')
    .setDescription('現在のToDo一覧を表示します')
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('todocomplete')
    .setDescription('指定番号のToDoを完了にします')
    .addIntegerOption((option) =>
      option
        .setName('number')
        .setDescription('/todolistで確認した番号')
        .setRequired(true)
        .setMinValue(1)
    )
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('tododelete')
    .setDescription('指定番号のToDoを削除します')
    .addIntegerOption((option) =>
      option
        .setName('number')
        .setDescription('/todolistで確認した番号')
        .setRequired(true)
        .setMinValue(1)
    )
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('todoend')
    .setDescription('完了したToDoリストをすべて表示します')
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('task')
    .setDescription('他のユーザーのToDoリストを表示します')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('確認したいユーザー')
        .setRequired(true)
    )
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('pomodoro')
    .setDescription('25分間集中タイマーを開始します（ポモドーロテクニック）')
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('pomodorostop')
    .setDescription('進行中のポモドーロセッションを終了します')
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('ボットの使い方ガイドを表示します（GUI形式）')
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('chat')
    .setDescription('チャットボットと会話します')
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('チャットボットに送るメッセージ')
        .setRequired(true)
        .setMaxLength(500)
    )
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('level')
    .setDescription('あなたと全員のレベルを表示します')
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('あなたの所持金を確認します')
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('アイテムショップを表示します')
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('アイテムを購入します')
    .addStringOption((option) =>
      option
        .setName('item')
        .setDescription('購入したいアイテムのID')
        .setRequired(true)
        .addChoices(
          { name: '🔴 赤色 (500円)', value: 'color_red' },
          { name: '🟢 緑色 (500円)', value: 'color_green' },
          { name: '🔵 青色 (500円)', value: 'color_blue' },
          { name: '🟡 黄色 (500円)', value: 'color_yellow' },
          { name: '🟣 紫色 (500円)', value: 'color_purple' },
          { name: '🟠 オレンジ色 (500円)', value: 'color_orange' },
          { name: '⚫ 黒色 (500円)', value: 'color_black' },
          { name: '⚪ 白色 (500円)', value: 'color_white' },
          { name: '🌟 勉強王 (1000円)', value: 'title_king' },
          { name: '🔥 努力家 (1000円)', value: 'title_hard' },
          { name: '💎 天才 (1000円)', value: 'title_genius' },
          { name: '👑 チャンピオン (1000円)', value: 'title_champion' },
          { name: '⚡ スピードスター (1000円)', value: 'title_speed' },
          { name: '🎯 集中マスター (1000円)', value: 'title_focus' }
        )
    )
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('所有しているアイテムを確認します')
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('equip')
    .setDescription('購入したアイテムを装備します')
    .addStringOption((option) =>
      option
        .setName('item')
        .setDescription('装備したいアイテムのID')
        .setRequired(true)
    )
    .setDMPermission(false),
].map((command) => command.toJSON());

let commandsReady = false;

// 色ロール自動作成関数
async function ensureColorRolesExist(guild) {
  const colorRoles = {
    Role_Red: '0xFF0000',
    Role_Green: '0x00FF00',
    Role_Blue: '0x0000FF',
    Role_Yellow: '0xFFFF00',
    Role_Purple: '0x9B59B6',
    Role_Orange: '0xFF8C00',
    Role_Black: '0x000000',
    Role_White: '0xFFFFFF'
  };

  const titleRoles = {
    Role_Title_King: '0x FFD700',      // ゴールド
    Role_Title_Hard: '0xFF6347',       // トマト赤
    Role_Title_Genius: '0x9370DB',     // 中紫
    Role_Title_Champion: '0x1E90FF',   // ドジャーブルー
    Role_Title_Speed: '0x00CED1',      // ダークターコイズ
    Role_Title_Focus: '0x32CD32'       // ライムグリーン
  };

  console.log('🔍 色ロールを確認中...');

  for (const [roleName, colorHex] of Object.entries(colorRoles)) {
    const existingRole = guild.roles.cache.find(r => r.name === roleName);
    
    if (!existingRole) {
      try {
        const color = parseInt(colorHex.replace('0x', ''), 16);
        const newRole = await guild.roles.create({
          name: roleName,
          color: color,
          reason: '色アイテム用ロール'
        });
        console.log(`✅ ロール "${roleName}" を作成しました`);
      } catch (error) {
        console.error(`❌ ロール "${roleName}" の作成に失敗しました:`, error.message);
      }
    } else {
      console.log(`✅ ロール "${roleName}" は既に存在します`);
    }
  }

  console.log('🔍 称号ロールを確認中...');

  for (const [roleName, colorHex] of Object.entries(titleRoles)) {
    const existingRole = guild.roles.cache.find(r => r.name === roleName);
    
    if (!existingRole) {
      try {
        const color = parseInt(colorHex.replace('0x', ''), 16);
        const newRole = await guild.roles.create({
          name: roleName,
          color: color,
          reason: '称号アイテム用ロール'
        });
        console.log(`✅ ロール "${roleName}" を作成しました`);
      } catch (error) {
        console.error(`❌ ロール "${roleName}" の作成に失敗しました:`, error.message);
      }
    } else {
      console.log(`✅ ロール "${roleName}" は既に存在します`);
    }
  }
}

client.once('clientReady', async () => {
  console.log(`ログイン完了：${client.user.tag}`);
  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (guild) {
      // 色ロールを自動作成
      await ensureColorRolesExist(guild);
      
      const existingCommands = await guild.commands.fetch();
      console.log(`🔍 既存のスラッシュコマンド数: ${existingCommands.size}`);
      
      // 명령어가 이미 등록되어 있으면 삭제하지 않음
      const needsUpdate = existingCommands.size !== slashCommands.length;
      
      if (needsUpdate) {
        console.log('🔄 명령어 업데이트 필요, 재등록 중...');
        const registered = await guild.commands.set(slashCommands);
        console.log(`✅ ${registered.size}個のスラッシュコマンドをGuild（${GUILD_ID}）に登録しました`);
        
        registered.forEach((cmd) => {
          console.log(`  - /${cmd.name}: ${cmd.description}`);
        });
      } else {
        console.log('✅ 명령어가 이미 등록되어 있습니다 (업데이트 불필요)');
        existingCommands.forEach((cmd) => {
          console.log(`  - /${cmd.name}: ${cmd.description}`);
        });
      }
      
      commandsReady = true;
      console.log('🎯 봇이 명령어를 받을 준비가 되었습니다!');
    } else {
      console.warn(`❌ ギルド（${GUILD_ID}）が見つかりません`);
      console.warn(`利用可能なギルド:`);
      client.guilds.cache.forEach((g) => {
        console.warn(`  - ${g.name} (${g.id})`);
      });
    }
  } catch (error) {
    console.error('❌ コマンド登録に失敗しました', error.message);
    console.error('エラーの詳細:', error);
  }
});

// ユーザーがサーバーに参加したときのウェルカムメッセージ
client.on('guildMemberAdd', async (member) => {
  try {
    // 1. #漂流所 채널에 환영 메시지와 가이드 전송
    const guild = member.guild;
    const welcomeChannel = guild.channels.cache.find(
      (ch) => ch.name === '漂流所'
    );

    if (welcomeChannel && welcomeChannel.isTextBased()) {
      // 간단한 환영 메시지
      const welcomeText = `${member.user.username}さん、こんにちは！　勉強、課題、タスクなどに活用してください。　使い方は使い方チャンネルをご覧ください`;
      await welcomeChannel.send(welcomeText);
      console.log(`✅ ${member.user.tag}のウェルカムメッセージを${welcomeChannel.name}に送信しました`);

      // 상세 가이드 임베드
      const guideEmbed = new EmbedBuilder()
        .setColor(COLOR_PRIMARY)
        .setTitle('📚 ボット使い方ガイド')
        .setDescription(`${member.user.username}さんへようこそ！\n\n勉強時間を記録して、ランキングで競争するボットです。\n以下のコマンドで様々な機能が使えます！`)
        .addFields(
          {
            name: '⏱️ 勉強記録',
            value: '`/startstudy` - 勉強開始\n`/pausestudy` - 一時停止\n`/stopstudy` - 勉強終了（記録に保存）',
            inline: false
          },
          {
            name: '📊 統計・ランキング',
            value: '`/stats` - 自分の勉強記録\n`/rank` - ランキング表示\n`/globalstats` - みんなの統計',
            inline: false
          },
          {
            name: '✅ ToDo管理',
            value: '`/todoadd <内容>` - ToDoを追加\n`/todolist` - 一覧表示\n`/todocomplete <番号>` - 完了\n`/tododelete <番号>` - 削除',
            inline: false
          },
          {
            name: '🍅 ポモドーロタイマー',
            value: '`/pomodoro` - 25分集中タイマー開始\n`/pomodorostop` - タイマー停止',
            inline: false
          },
          {
            name: '🏆 ティアシステム',
            value: '🌱 ノービス (5h未満) → 🥉 ブロンズ (5h) → 🥈 シルバー (10h) → 🏆 ゴールド (20h) → 🤍 プラチナ (30h) → 💎 ダイヤモンド (40h) → ⭐ マスター (50h) → 👑 グランドマスター (60h) → 🔥 チャレンジャー (70h)',
            inline: false
          },
          {
            name: '📌 注意事項',
            value: '⏰ 時間はAsia/Seoul (UTC+9) で集計されます\n📝 詳細は使い方チャンネルをご覧ください\n💬 わからないことがあればお気軽にお聞きください！',
            inline: false
          }
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setFooter({ text: 'Happy studying! 頑張ってください！' })
        .setTimestamp(new Date());

      await welcomeChannel.send({ embeds: [guideEmbed] });
      console.log(`✅ ガイドメッセージを${welcomeChannel.name}に送信しました`);
    } else {
      console.log(`⚠️ #漂流所チャンネルが見つかりません`);
    }

    // 2. DM로 간단한 인사 메시지 전송
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(COLOR_SUCCESS)
        .setTitle('ようこそ！👋')
        .setDescription(`${member.user.username}さん、ボットへようこそ！\n\n#漂流所 チャンネルで詳しい使い方を確認できます。\n楽しく勉強しましょう！`)
        .setTimestamp(new Date());

      await member.send({ embeds: [dmEmbed] });
      console.log(`✅ ${member.user.tag}にDMを送信しました`);
    } catch (dmError) {
      console.error(`❌ ${member.user.tag}へのDM送信に失敗しました:`, dmError.message);
    }
  } catch (error) {
    console.error(`❌ ウェルカムメッセージ送信中にエラーが発生しました:`, error);
  }
});

// ユーザーが音声チャンネルに出入りしたときの処理
client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    const userId = newState.id;
    const STUDY_ROOM_NAME = 'studyroom';
    const MANAGEMENT_CHANNEL_NAME = '入退室管理';
    
    const newChannel = newState.channel;
    const oldChannel = oldState.channel;
    const guild = newState.guild;
    
    console.log(`voiceStateUpdate: ${newState.member?.user?.tag} | oldChannel: ${oldChannel?.name || 'null'} | newChannel: ${newChannel?.name || 'null'}`);
    
    const managementChannel = guild.channels.cache.find(
      (ch) => ch.name.toLowerCase() === MANAGEMENT_CHANNEL_NAME.toLowerCase()
    );
    
    if (!managementChannel) {
      console.warn(`⚠️ ${MANAGEMENT_CHANNEL_NAME}チャンネルが見つかりません`);
    } else {
      console.log(`✅ ${MANAGEMENT_CHANNEL_NAME}チャンネルを取得しました: ${managementChannel.id}`);
    }
    
    const isStudyRoom = (channel) => channel && channel.name.toLowerCase().includes('study');
    
    const wasInStudyRoom = isStudyRoom(oldChannel);
    const isInStudyRoom = isStudyRoom(newChannel);
    
    // studyroomに入場した場合
    if (isInStudyRoom && !wasInStudyRoom) {
      voiceSessions.set(userId, {
        startTime: now().toISOString(),
        channelId: newChannel.id,
      });
      console.log(`✅ ${newState.member.user.tag}がstudyroomに入場しました`);
      
      if (managementChannel && managementChannel.isTextBased()) {
        try {
          const enterEmbed = new EmbedBuilder()
            .setColor(COLOR_SUCCESS)
            .setTitle('📱 入場')
            .setDescription(`<@${userId}> がstudyroomに入場しました`)
            .setThumbnail(newState.member.user.displayAvatarURL())
            .setTimestamp(new Date());
          
          await managementChannel.send({ embeds: [enterEmbed] });
          console.log(`✅ 入場メッセージを${MANAGEMENT_CHANNEL_NAME}に送信しました`);
        } catch (msgError) {
          console.error(`❌ メッセージ送信に失敗しました:`, msgError);
        }
      }
    }
    
    // studyroomから退出した場合
    if (wasInStudyRoom && !isInStudyRoom) {
      console.log(`✅ ${newState.member.user.tag}がstudyroomから退出しました`);
      const session = voiceSessions.get(userId);
      
      if (session) {
        const startTime = session.startTime;
        const endTime = now().toISOString();
        const totalMinutes = calculateSessionMinutes(startTime, endTime);
        
        console.log(`📊 勉強時間計算: ${totalMinutes}分`);
        
        if (totalMinutes >= 1) {
          const nowDate = now();
          const dateKey = getDateKey(nowDate);
          const weekKey = getWeekKey(nowDate);
          const monthKey = getMonthKey(nowDate);
          
          try {
            // Supabase에 저장
            const { error } = await supabase
              .from('study_records')
              .insert([{
                user_id: userId,
                start_time: startTime,
                end_time: endTime,
                total_minutes: totalMinutes,
                date: dateKey,
                week: weekKey,
                month: monthKey
              }]);
            
            if (error) throw error;
            
            console.log(`✅ ${newState.member.user.tag}の勉強記録を保存しました: ${formatMinutes(totalMinutes)}`);
            
            // お金を追加（1分=100円）
            const earnedMoney = totalMinutes * 100;
            await addMoney(userId, earnedMoney);
            console.log(`💰 ${earnedMoney.toLocaleString()}円を追加しました`);
          } catch (dbError) {
            console.error(`❌ DB保存に失敗しました:`, dbError);
          }
          
          // 총 공부시간 업데이트
          await updateUserTotalStudyTime(userId, totalMinutes);
          
          // レベル更新
          await updateUserLevel(userId);
          
          // 管理チャンネルに退出メッセージを送信
          if (managementChannel && managementChannel.isTextBased()) {
            try {
              const earnedMoney = totalMinutes * 100;
              const exitEmbed = new EmbedBuilder()
                .setColor(COLOR_PRIMARY)
                .setTitle('📵 退出')
                .setDescription(`<@${userId}> がstudyroomから退出しました`)
                .addFields(
                  {
                    name: '勉強時間',
                    value: formatMinutes(totalMinutes),
                    inline: true
                  },
                  {
                    name: '獲得金額',
                    value: `💰 ${earnedMoney.toLocaleString()}円`,
                    inline: true
                  }
                )
                .setThumbnail(newState.member.user.displayAvatarURL())
                .setTimestamp(new Date());
              
              await managementChannel.send({ embeds: [exitEmbed] });
              console.log(`✅ 退出メッセージを${MANAGEMENT_CHANNEL_NAME}に送信しました`);
            } catch (msgError) {
              console.error(`❌ メッセージ送信に失敗しました:`, msgError);
            }
          }
        }
        
        voiceSessions.delete(userId);
      } else {
        console.warn(`⚠️ ${userId}のセッション情報が見つかりません`);
      }
    }
  } catch (error) {
    console.error('❌ voiceStateUpdateでエラーが発生しました', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  // ボタンクリック処理
  if (interaction.isButton()) {
    try {
      const customId = interaction.customId;
      
      if (customId.startsWith('help_')) {
        await handleHelpButton(interaction, customId);
      } else if (customId.startsWith('todo_complete_')) {
        await handleTodoCompleteButton(interaction, customId);
      }
    } catch (error) {
      console.error('❌ ボタンクリック処理エラー:', error);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  const startTime = Date.now();
  const age = startTime - interaction.createdTimestamp;
  
  console.log(`\n📨 Interaction 수신: /${interaction.commandName} (Age: ${age}ms)`);

  // 명령어 등록이 완료되지 않았으면 대기
  if (!commandsReady) {
    console.log('⏳ 명령어 등록 중...');
    try {
      await interaction.reply({ content: '⏳ 봇이 시작 중입니다. 잠시 후 다시 시도해주세요.', ephemeral: true });
    } catch (err) {
      console.error('응답 실패:', err.message);
    }
    return;
  }

  // todoadd, todolist, todocomplete, tododelete, todoend는 즉시 defer
  if (['todoadd', 'todolist', 'todocomplete', 'tododelete', 'todoend'].includes(interaction.commandName)) {
    try {
      await interaction.deferReply();
      const deferTime = Date.now() - startTime;
      console.log(`✅ deferReply 성공! (${deferTime}ms, Total age: ${Date.now() - interaction.createdTimestamp}ms)`);
    } catch (err) {
      console.error('❌ defer 실패:', err.message, '| Code:', err.code, '| Age:', Date.now() - interaction.createdTimestamp, 'ms');
      return; // defer 실패하면 중단
    }
  }

  try {
    
    switch (interaction.commandName) {
      case 'startstudy':
        await startStudy(interaction);
        break;
      case 'pausestudy':
        await pauseStudy(interaction);
        break;
      case 'stopstudy':
        await stopStudy(interaction);
        break;
      case 'rank':
        await showRank(interaction);
        break;
      case 'stats':
        await showStats(interaction);
        break;
      case 'globalstats':
        await showGlobalStats(interaction);
        break;
      case 'todoadd':
        await addTodo(interaction);
        break;
      case 'todolist':
        await listTodo(interaction);
        break;
      case 'todocomplete':
        await completeTodo(interaction);
        break;
      case 'tododelete':
        await deleteTodo(interaction);
        break;
      case 'todoend':
        await showCompletedTodos(interaction);
        break;
      case 'task':
        await showUserTodos(interaction);
        break;
      case 'pomodoro':
        await startPomodoro(interaction);
        break;
      case 'pomodorostop':
        await stopPomodoro(interaction);
        break;
      case 'help':
        await showHelp(interaction);
        break;
      case 'chat':
        await chatBot(interaction);
        break;
      case 'level':
        await showLevel(interaction);
        break;
      case 'balance':
        await showBalance(interaction);
        break;
      case 'shop':
        await showShop(interaction);
        break;
      case 'buy':
        await buyItem(interaction);
        break;
      case 'inventory':
        await showInventory(interaction);
        break;
      case 'equip':
        await equipItem(interaction);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error('コマンド処理中にエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('コマンドの処理に失敗しました。後ほどお試しください。'));
  }
});

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('ログインに失敗しました', error);
});

// Replit用のWebサーバー（24/7稼働のため）
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Discord Study Bot is running! 🤖\n稼働中です！');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Webサーバーがポート${PORT}で起動しました`);
  console.log('UptimeRobotでこのURLを監視してください');
});

process.on('SIGINT', () => {
  console.log('ボットを終了します');
  server.close();
  process.exit(0);
});

// ==================== ヘルパー関数 ====================

function now() {
  return dayjs().tz(TIMEZONE);
}

function getWeekKey(date) {
  const isoWeekNumber = date.isoWeek();
  const isoWeekYearValue = typeof date.isoWeekYear === 'function' ? date.isoWeekYear() : date.year();
  const paddedWeek = String(isoWeekNumber).padStart(2, '0');
  return `${isoWeekYearValue}-W${paddedWeek}`;
}

function getDateKey(date) {
  return date.format('YYYY-MM-DD');
}

function getMonthKey(date) {
  return date.format('YYYY-MM');
}

function formatMinutes(minutes) {
  const safeMinutes = Math.max(Number(minutes) || 0, 0);
  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;
  if (hours > 0) {
    return `${safeMinutes}分（約${hours}時間${remaining}分）`;
  }
  return `${safeMinutes}分`;
}

async function sendEmbed(interaction, embed, options = {}) {
  const { ephemeral = false } = options;
  try {
    console.log(`📤 sendEmbed: deferred=${interaction.deferred}, replied=${interaction.replied}`);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ embeds: [embed], ephemeral });
      console.log('✅ followUp送信完了');
    } else {
      await interaction.reply({ embeds: [embed], ephemeral });
      console.log('✅ reply送信完了');
    }
  } catch (error) {
    console.error('❌ Embed送信でエラーが発生しました', error);
    console.error('Error details:', error.message);
  }
}

function buildSuccessEmbed(title, description) {
  return new EmbedBuilder().setColor(COLOR_SUCCESS).setTitle(title).setDescription(description).setTimestamp(new Date());
}

function buildInfoEmbed(title, description) {
  return new EmbedBuilder().setColor(COLOR_PRIMARY).setTitle(title).setDescription(description).setTimestamp(new Date());
}

function buildErrorEmbed(description) {
  return new EmbedBuilder().setColor(COLOR_DANGER).setTitle('エラー').setDescription(description).setTimestamp(new Date());
}

function calculateSessionMinutes(startIso, endIso) {
  if (!startIso) {
    return 0;
  }
  const start = dayjs(startIso);
  const end = dayjs(endIso);
  const diff = end.diff(start, 'minute');
  return Math.max(diff, 1);
}

// ==================== Supabase データベース関数 ====================

async function addMoney(userId, amount) {
  const nowIso = now().toISOString();
  
  try {
    // 既存のレコードを確認
    const { data: existing, error: selectError } = await supabase
      .from('money')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (selectError) throw selectError;
    
    if (existing) {
      // 既存レコードを更新
      const { error: updateError } = await supabase
        .from('money')
        .update({
          balance: existing.balance + amount,
          total_earned: existing.total_earned + amount,
          last_updated: nowIso
        })
        .eq('user_id', userId);
      
      if (updateError) throw updateError;
    } else {
      // 新規レコードを作成
      const { error: insertError } = await supabase
        .from('money')
        .insert([{
          user_id: userId,
          balance: amount,
          total_earned: amount,
          last_updated: nowIso
        }]);
      
      if (insertError) throw insertError;
    }
    
    console.log(`💰 ${userId}に${amount.toLocaleString()}円を追加しました`);
  } catch (error) {
    console.error('addMoneyでエラーが発生しました', error);
  }
}

async function updateUserTotalStudyTime(userId, minutes) {
  const nowIso = now().toISOString();
  
  try {
    // 既存のレコードを確認
    const { data: existing, error: selectError } = await supabase
      .from('user_total_study_time')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (selectError) throw selectError;
    
    if (existing) {
      // 既存レコードを更新
      const { error: updateError } = await supabase
        .from('user_total_study_time')
        .update({
          total_minutes: existing.total_minutes + minutes,
          total_sessions: existing.total_sessions + 1,
          last_updated: nowIso
        })
        .eq('user_id', userId);
      
      if (updateError) throw updateError;
    } else {
      // 新規レコードを作成
      const { error: insertError } = await supabase
        .from('user_total_study_time')
        .insert([{
          user_id: userId,
          total_minutes: minutes,
          total_sessions: 1,
          last_updated: nowIso
        }]);
      
      if (insertError) throw insertError;
    }
    
    console.log(`📊 ${userId}の総勉強時間を更新しました: +${minutes}分`);
  } catch (error) {
    console.error('updateUserTotalStudyTimeでエラーが発生しました', error);
  }
}

async function saveDiscordUser(userId, username, displayName, avatarUrl) {
  const nowIso = now().toISOString();
  
  try {
    // displayNameが空の場合はusernameを使用
    const finalDisplayName = displayName && displayName.trim() ? displayName : username;
    
    // 既存ユーザーを確認
    const { data: existingUser, error: checkError } = await supabase
      .from('discord_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existingUser) {
      // 既存ユーザーを更新
      const { error: updateError } = await supabase
        .from('discord_users')
        .update({
          username: username,
          display_name: finalDisplayName,
          avatar_url: avatarUrl,
          updated_at: nowIso
        })
        .eq('user_id', userId);
      
      if (updateError) throw updateError;
    } else {
      // 新規ユーザーを作成
      const { error: insertError } = await supabase
        .from('discord_users')
        .insert([{
          user_id: userId,
          username: username,
          display_name: finalDisplayName,
          avatar_url: avatarUrl,
          level: 1,
          created_at: nowIso,
          updated_at: nowIso
        }]);
      
      if (insertError) throw insertError;
    }
    
    console.log(`👤 ユーザー情報を保存しました: ${finalDisplayName} (${userId})`);
  } catch (error) {
    console.error('saveDiscordUserでエラーが発生しました', error);
  }
}

// ==================== コマンド実装 ====================

async function startStudy(interaction) {
  const userId = interaction.user.id;
  const nowDate = now();
  const nowIso = nowDate.toISOString();
  const state = activeSessions.get(userId);

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }
    
    // ユーザー情報を保存
    await saveDiscordUser(
      userId,
      interaction.user.username,
      interaction.user.globalName || interaction.user.displayName || interaction.user.username,
      interaction.user.displayAvatarURL()
    );
    
    if (state && !state.isPaused) {
      const alreadyEmbed = buildErrorEmbed('すでに勉強中です。`/pausestudy`または`/stopstudy`を使用してください。');
      await sendEmbed(interaction, alreadyEmbed);
      return;
    }

    if (state && state.isPaused) {
      const resumedState = {
        ...state,
        startTime: nowIso,
        isPaused: false,
      };
      activeSessions.set(userId, resumedState);
      const resumeEmbed = buildSuccessEmbed('勉強再開', '集中モードに戻ります！引き続き頑張りましょう✍️');
      await sendEmbed(interaction, resumeEmbed);
      return;
    }

    const sessionState = {
      sessionStartTime: nowIso,
      startTime: nowIso,
      accumulatedMinutes: 0,
      isPaused: false,
    };
    activeSessions.set(userId, sessionState);

    const startEmbed = buildSuccessEmbed('勉強開始', '勉強を開始しました！良いスタートです💪');
    await sendEmbed(interaction, startEmbed);
  } catch (error) {
    console.error('startStudyでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('勉強開始の処理でエラーが発生しました。後ほどお試しください。'));
  }
}

async function pauseStudy(interaction) {
  const userId = interaction.user.id;
  const nowDate = now();
  const nowIso = nowDate.toISOString();
  const state = activeSessions.get(userId);

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }
    
    if (!state) {
      const notStartedEmbed = buildErrorEmbed('現在進行中の勉強はありません。`/startstudy`で開始してください。');
      await sendEmbed(interaction, notStartedEmbed);
      return;
    }

    if (state.isPaused) {
      const alreadyPausedEmbed = buildErrorEmbed('すでに一時停止中です。再開するには`/startstudy`を使ってください。');
      await sendEmbed(interaction, alreadyPausedEmbed);
      return;
    }

    const sessionMinutes = calculateSessionMinutes(state.startTime, nowIso);
    const updatedState = {
      ...state,
      accumulatedMinutes: state.accumulatedMinutes + sessionMinutes,
      startTime: null,
      isPaused: true,
    };

    activeSessions.set(userId, updatedState);

    const pauseEmbed = buildInfoEmbed(
      '一時停止しました',
      `今回の勉強は${formatMinutes(sessionMinutes)}でした。\nこのセッションの合計は${formatMinutes(updatedState.accumulatedMinutes)}です。`
    );
    await sendEmbed(interaction, pauseEmbed);
  } catch (error) {
    console.error('pauseStudyでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('一時停止の処理でエラーが発生しました。後ほどお試しください。'));
  }
}

async function stopStudy(interaction) {
  const userId = interaction.user.id;
  const nowDate = now();
  const nowIso = nowDate.toISOString();
  const state = activeSessions.get(userId);

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }
    
    // ユーザー情報を保存
    await saveDiscordUser(
      userId,
      interaction.user.username,
      interaction.user.globalName || interaction.user.displayName || interaction.user.username,
      interaction.user.displayAvatarURL()
    );
    
    if (!state) {
      const notStartedEmbed = buildErrorEmbed('現在進行中の勉強はありません。`/startstudy`で開始してください。');
      await sendEmbed(interaction, notStartedEmbed);
      return;
    }

    let sessionMinutes = 0;
    let totalMinutes = state.accumulatedMinutes;

    if (state.startTime) {
      sessionMinutes = calculateSessionMinutes(state.startTime, nowIso);
      totalMinutes += sessionMinutes;
    }

    const safeTotal = Math.max(totalMinutes, 1);
    const dateKey = getDateKey(nowDate);
    const weekKey = getWeekKey(nowDate);
    const monthKey = getMonthKey(nowDate);
    const sessionStart = state.sessionStartTime || nowIso;

    // Supabase에 저장
    const { error } = await supabase
      .from('study_records')
      .insert([{
        user_id: userId,
        start_time: sessionStart,
        end_time: nowIso,
        total_minutes: safeTotal,
        date: dateKey,
        week: weekKey,
        month: monthKey
      }]);
    
    if (error) throw error;

    // お金を追加（1分=100円）
    const earnedMoney = safeTotal * 100;
    await addMoney(userId, earnedMoney);

    activeSessions.delete(userId);

    // 총 공부시간 업데이트
    await updateUserTotalStudyTime(userId, safeTotal);

    // レベル更新
    await updateUserLevel(userId);

    // 今日の合計を取得
    const { data: todayData, error: todayError } = await supabase
      .from('study_records')
      .select('total_minutes')
      .eq('user_id', userId)
      .eq('date', dateKey);
    
    if (todayError) throw todayError;
    
    const todayTotal = todayData.reduce((sum, row) => sum + row.total_minutes, 0);

    const stopEmbed = buildSuccessEmbed(
      '勉強終了',
      `今回の勉強は${formatMinutes(safeTotal)}でした。\n今日の合計は${formatMinutes(todayTotal)}です。\n💰 ${earnedMoney.toLocaleString()}円を獲得しました！\nお疲れさまでした☕`
    );
    await sendEmbed(interaction, stopEmbed);
  } catch (error) {
    console.error('stopStudyでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('終了処理でエラーが発生しました。後ほどお試しください。'));
  }
}

async function showRank(interaction) {
  const nowDate = now();
  const monthKey = getMonthKey(nowDate);

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }
    
    console.log(`📊 Rank取得開始: month=${monthKey}`);
    
    // Supabaseから月別データ取得
    const { data, error } = await supabase
      .from('study_records')
      .select('user_id, total_minutes')
      .eq('month', monthKey);
    
    if (error) throw error;
    
    // ユーザー別に集計
    const userTotals = {};
    data.forEach(row => {
      if (!userTotals[row.user_id]) {
        userTotals[row.user_id] = 0;
      }
      userTotals[row.user_id] += row.total_minutes;
    });
    
    // ランキング配列に変換
    const ranking = Object.entries(userTotals)
      .map(([user_id, total]) => ({ user_id, total }))
      .sort((a, b) => b.total - a.total);

    if (!ranking.length) {
      const emptyEmbed = buildInfoEmbed('ティアランキング', '今月の記録がまだありません。`/startstudy`で勉強を始めましょう！');
      await sendEmbed(interaction, emptyEmbed);
      return;
    }

    const rankingLines = ranking.map((row) => {
      const tier = getTierByMinutes(row.total);
      const totalText = formatMinutes(row.total);
      return `**${tier}** - <@${row.user_id}>：${totalText}`;
    });

    const rankEmbed = new EmbedBuilder()
      .setColor(COLOR_PRIMARY)
      .setTitle('今月の勉強ティアランキング 📊')
      .setDescription(`${monthKey} の月間勉強時間に基づくティアランキング`)
      .addFields({ 
        name: 'ティア別ランキング', 
        value: rankingLines.join('\n'),
        inline: false
      })
      .addFields({
        name: 'ティア別条件',
        value: '🌱 ノービス (5時間未満)\n🥉 ブロンズ (5時間以上)\n🥈 シルバー (10時間以上)\n🏆 ゴールド (20時間以上)\n🤍 プラチナ (30時間以上)\n💎 ダイヤモンド (40時間以上)\n👑 グランドマスター (60時間以上)\n🔥 チャレンジャー (70時間以上)',
        inline: false
      })
      .setTimestamp(new Date());

    await sendEmbed(interaction, rankEmbed);
  } catch (error) {
    console.error('showRankでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('ランキングの取得中にエラーが発生しました。後ほどお試しください。'));
  }
}

async function showStats(interaction) {
  const userId = interaction.user.id;
  const nowDate = now();
  const dateKey = getDateKey(nowDate);
  const weekKey = getWeekKey(nowDate);
  const monthKey = getMonthKey(nowDate);

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }
    
    console.log(`📊 Stats取得開始: userId=${userId}`);
    
    // ユーザー情報を保存
    await saveDiscordUser(
      userId,
      interaction.user.username,
      interaction.user.globalName || interaction.user.displayName || interaction.user.username,
      interaction.user.displayAvatarURL()
    );
    
    // 今日
    const { data: todayData, error: todayError } = await supabase
      .from('study_records')
      .select('total_minutes')
      .eq('user_id', userId)
      .eq('date', dateKey);
    
    if (todayError) throw todayError;
    const todayTotal = todayData.reduce((sum, row) => sum + row.total_minutes, 0);
    
    // 今週
    const { data: weekData, error: weekError } = await supabase
      .from('study_records')
      .select('total_minutes')
      .eq('user_id', userId)
      .eq('week', weekKey);
    
    if (weekError) throw weekError;
    const weekTotal = weekData.reduce((sum, row) => sum + row.total_minutes, 0);
    
    // 今月
    const { data: monthData, error: monthError } = await supabase
      .from('study_records')
      .select('total_minutes')
      .eq('user_id', userId)
      .eq('month', monthKey);
    
    if (monthError) throw monthError;
    const monthTotal = monthData.reduce((sum, row) => sum + row.total_minutes, 0);
    
    // ユーザーレベルと総時間を取得
    const { data: userData, error: userError } = await supabase
      .from('discord_users')
      .select('level, display_name')
      .eq('user_id', userId)
      .maybeSingle();

    if (userError) throw userError;

    const userLevel = userData?.level || 1;
    const userDisplayName = userData?.display_name || interaction.user.username;

    // 総勉強時間を取得
    const { data: totalStudyData, error: totalStudyError } = await supabase
      .from('user_total_study_time')
      .select('total_minutes')
      .eq('user_id', userId)
      .maybeSingle();

    if (totalStudyError) throw totalStudyError;

    const totalMinutes = totalStudyData?.total_minutes || 0;

    // ユーザーのカスタマイズアイテムを取得
    const { data: customizations } = await supabase
      .from('user_customizations')
      .select('item_type, item_value')
      .eq('user_id', userId)
      .eq('is_active', true);

    // 色とタイトルを取得
    let embedColor = COLOR_PRIMARY; // デフォルト色
    let userTitle = ''; // デフォルトタイトル

    if (customizations && customizations.length > 0) {
      const colorItem = customizations.find(item => item.item_type === 'color');
      const titleItem = customizations.find(item => item.item_type === 'title');

      if (colorItem) {
        // 色の値を16進数に変換
        embedColor = parseInt(colorItem.item_value, 16);
      }

      if (titleItem) {
        userTitle = titleItem.item_value + ' ';
      }
    }

    // レベルバー表示用（5レベル = 10個の四角）
    // 現在の5レベルブロック内でのレベルを計算
    const levelInBlock = ((userLevel - 1) % 5) + 1; // 1-5の中でのレベル
    // 現在の5レベルブロック内での秒数を計算（30秒 = 1個の四角）
    const minutesInBlock = totalMinutes % 150; // 5レベル = 150分
    const secondsInBlock = (minutesInBlock * 60) % 300; // 5分 = 300秒
    const filledSquares = Math.floor(secondsInBlock / 30); // 30秒 = 1個の四角
    const emptySquares = 10 - filledSquares;
    const levelBar = '█'.repeat(filledSquares) + '░'.repeat(emptySquares);

    // 次のレベルに必要な総時間を計算（5分 = 1レベル）
    const nextLevelRequiredMinutes = (userLevel) * 5;
    const remainingMinutesForNextLevel = Math.max(0, nextLevelRequiredMinutes - totalMinutes);

    console.log(`✅ Stats取得完了: today=${todayTotal}, week=${weekTotal}, month=${monthTotal}, level=${userLevel}, totalMinutes=${totalMinutes}`);

    const statsEmbed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`📊 学習記録 - ${userTitle}${userDisplayName}`)
      .setDescription('Asia/Seoul時間で集計しています。')
      .addFields(
        {
          name: '🎮 現在のレベル',
          value: `**Level ${userLevel}** / 250\n${levelBar}`,
          inline: false
        },
        {
          name: '📈 学習時間',
          value: `**今日**: ${formatMinutes(todayTotal)}\n**今週**: ${formatMinutes(weekTotal)}\n**今月**: ${formatMinutes(monthTotal)}`,
          inline: false
        },
        {
          name: '💡 次のレベルまで',
          value: `あと ${remainingMinutesForNextLevel} 分`,
          inline: true
        },
        {
          name: '⏰ ペース',
          value: weekTotal > 0 ? `週間平均: ${Math.round(weekTotal / 7)}分/日` : 'データなし',
          inline: true
        }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp(new Date());

    await sendEmbed(interaction, statsEmbed);
  } catch (error) {
    console.error('❌ showStatsでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('統計情報の取得に失敗しました。後ほどお試しください。'));
  }
}

async function showGlobalStats(interaction) {
  const nowDate = now();
  const dateKey = getDateKey(nowDate);
  const weekKey = getWeekKey(nowDate);
  const monthKey = getMonthKey(nowDate);

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }
    
    console.log(`📊 GlobalStats取得開始`);
    
    // 各期間のデータを取得して集計
    const periods = [
      { key: dateKey, field: 'date' },
      { key: weekKey, field: 'week' },
      { key: monthKey, field: 'month' }
    ];
    
    const rankings = [];
    
    for (const period of periods) {
      const { data, error } = await supabase
        .from('study_records')
        .select('user_id, total_minutes')
        .eq(period.field, period.key);
      
      if (error) throw error;
      
      // ユーザー別に集計
      const userTotals = {};
      data.forEach(row => {
        if (!userTotals[row.user_id]) {
          userTotals[row.user_id] = 0;
        }
        userTotals[row.user_id] += row.total_minutes;
      });
      
      // ランキング配列に変換してソート
      const ranking = Object.entries(userTotals)
        .map(([user_id, total]) => ({ user_id, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
      
      rankings.push(ranking);
    }

    const globalEmbed = new EmbedBuilder()
      .setColor(COLOR_PRIMARY)
      .setTitle('みんなの勉強統計')
      .setDescription('上位5名の勉強時間を表示します。')
      .addFields(
        {
          name: `今日 (${dateKey})`,
          value: formatRankingList(rankings[0], '今日の記録はまだありません。'),
        },
        {
          name: `今週 (${weekKey})`,
          value: formatRankingList(rankings[1], '今週の記録はまだありません。'),
        },
        {
          name: `今月 (${monthKey})`,
          value: formatRankingList(rankings[2], '今月の記録はまだありません。'),
        }
      )
      .setTimestamp(new Date());

    await sendEmbed(interaction, globalEmbed);
  } catch (error) {
    console.error('showGlobalStatsでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('全体統計の取得に失敗しました。後ほどお試しください。'));
  }
}

function formatRankingList(rows, emptyMessage) {
  if (!rows.length) {
    return emptyMessage;
  }
  return rows
    .map((row, index) => {
      const rankNumber = index + 1;
      const totalMinutes = Math.max(row.total, 0);
      return `${rankNumber}位 - <@${row.user_id}>：${totalMinutes}分`;
    })
    .join('\n');
}

async function addTodo(interaction) {
  console.log('🎯 addTodo 함수 호출됨');
  console.log(`   - Deferred: ${interaction.deferred}, Replied: ${interaction.replied}`);
  console.log(`   - Age: ${Date.now() - interaction.createdTimestamp}ms`);
  
  // interaction 핸들러에서 이미 defer 호출됨
  if (!interaction.deferred && !interaction.replied) {
    console.error('❌ defer가 호출되지 않았습니다!');
    return;
  }

  const userId = interaction.user.id;
  const content = interaction.options.getString('content', true).trim();
  const nowIso = now().toISOString();

  try {
    if (!content) {
      await interaction.followUp({ embeds: [buildErrorEmbed('ToDoの内容が空です。もう一度入力してください。')] });
      return;
    }

    console.log(`📝 Supabase에 todo 추가 시도: user=${userId}, task="${content}"`);
    
    const { data, error } = await supabase
      .from('todos')
      .insert([{
        user_id: userId,
        task: content,
        completed: false,
        created_at: nowIso
      }])
      .select();
    
    if (error) {
      console.error('❌ Supabase insert error:', error);
      throw error;
    }

    console.log('✅ Supabase 추가 성공:', data);
    
    const addEmbed = buildSuccessEmbed('ToDoを追加しました', `「${content}」を登録しました。`);
    await interaction.followUp({ embeds: [addEmbed] });
  } catch (error) {
    console.error('❌ addTodoでエラーが発生しました', error);
    try {
      await interaction.followUp({ embeds: [buildErrorEmbed('ToDoの追加に失敗しました。後ほどお試しください。')] });
    } catch (followUpError) {
      console.error('❌ followUp送信も失敗:', followUpError.message);
    }
  }
}

async function listTodo(interaction) {
  const userId = interaction.user.id;

  try {
    // Defer immediately before any async operations
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }
    
    const { data: todos, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(15);
    
    if (error) throw error;

    if (!todos.length) {
      const emptyEmbed = buildInfoEmbed('ToDoリスト', '登録されているToDoはありません。`/todoadd`で追加しましょう！');
      await interaction.followUp({ embeds: [emptyEmbed] });
      return;
    }

    // Separate completed and incomplete todos
    const incompleteTodos = todos.filter(t => !t.completed);
    const completedTodos = todos.filter(t => t.completed);

    // Create embed with improved styling
    const listEmbed = new EmbedBuilder()
      .setColor(COLOR_PRIMARY)
      .setTitle('✅ ToDoリスト (最大15件)')
      .setDescription('完了ボタンをクリックしてタスクを完了にしましょう!')
      .setTimestamp(new Date());

    // Add incomplete todos section
    if (incompleteTodos.length > 0) {
      const incompletelines = incompleteTodos.map((todo, index) => {
        return `**${index + 1}.** ${todo.task}`;
      });
      listEmbed.addFields({
        name: '📝 未完了タスク',
        value: incompletelines.join('\n') || 'タスクがありません',
        inline: false
      });
    }

    // Add completed todos section summary (only show count, not all tasks)
    if (completedTodos.length > 0) {
      listEmbed.addFields({
        name: '✨ 完了済みタスク',
        value: `完了したタスク: **${completedTodos.length}件**`,
        inline: false
      });
    }

    // Create action rows with buttons for each incomplete todo
    const components = [];
    
    for (let i = 0; i < incompleteTodos.length; i += 3) {
      const row = new ActionRowBuilder();
      
      for (let j = 0; j < 3 && i + j < incompleteTodos.length; j++) {
        const todo = incompleteTodos[i + j];
        const buttonNumber = i + j + 1;
        
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`todo_complete_${todo.id}`)
            .setLabel(`完了 (${buttonNumber})`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
        );
      }
      
      components.push(row);
    }

    if (components.length > 0) {
      await interaction.followUp({ 
        embeds: [listEmbed],
        components: components
      });
    } else {
      await interaction.followUp({ embeds: [listEmbed] });
    }

  } catch (error) {
    console.error('listTodoでエラーが発生しました', error);
    try {
      await interaction.followUp({ embeds: [buildErrorEmbed('ToDo一覧の取得に失敗しました。後ほどお試しください。')] });
    } catch (err) {
      console.error('❌ followUp送信も失敗:', err.message);
    }
  }
}

async function completeTodo(interaction) {
  const userId = interaction.user.id;
  const selectedNumber = interaction.options.getInteger('number', true);

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }
    
    const { data: todos, error: selectError } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(15);
    
    if (selectError) throw selectError;

    if (!todos.length) {
      await sendEmbed(interaction, buildErrorEmbed('ToDoリストが空です。まずは`/todoadd`で追加してください。'));
      return;
    }

    if (selectedNumber < 1 || selectedNumber > todos.length) {
      await sendEmbed(interaction, buildErrorEmbed('番号が範囲外です。`/todolist`で番号を確認してください。'));
      return;
    }

    const targetTodo = todos[selectedNumber - 1];

    if (targetTodo.completed) {
      await sendEmbed(interaction, buildInfoEmbed('すでに完了済み', `「${targetTodo.task}」はすでに完了済みです。`));
      return;
    }

    const { error: updateError } = await supabase
      .from('todos')
      .update({ completed: true })
      .eq('id', targetTodo.id);
    
    if (updateError) throw updateError;

    const completeEmbed = buildSuccessEmbed('ToDo完了', `「${targetTodo.task}」に✅を付けました。`);
    await sendEmbed(interaction, completeEmbed);
  } catch (error) {
    console.error('completeTodoでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('ToDo完了処理に失敗しました。後ほどお試しください。'));
  }
}

async function deleteTodo(interaction) {
  const userId = interaction.user.id;
  const selectedNumber = interaction.options.getInteger('number', true);

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }
    
    const { data: todos, error: selectError } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(15);
    
    if (selectError) throw selectError;

    if (!todos.length) {
      await sendEmbed(interaction, buildErrorEmbed('ToDoリストが空です。削除できる項目がありません。'));
      return;
    }

    if (selectedNumber < 1 || selectedNumber > todos.length) {
      await sendEmbed(interaction, buildErrorEmbed('番号が範囲外です。`/todolist`で番号を確認してください。'));
      return;
    }

    const targetTodo = todos[selectedNumber - 1];

    const { error: deleteError } = await supabase
      .from('todos')
      .delete()
      .eq('id', targetTodo.id);
    
    if (deleteError) throw deleteError;

    const deleteEmbed = buildSuccessEmbed('ToDo削除', `「${targetTodo.task}」を削除しました。`);
    await sendEmbed(interaction, deleteEmbed);
  } catch (error) {
    console.error('deleteTodoでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('ToDo削除処理に失敗しました。後ほどお試しください。'));
  }
}

async function showCompletedTodos(interaction) {
  const userId = interaction.user.id;

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }
    
    const { data: todos, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('created_at', { ascending: true });
    
    if (error) throw error;

    if (!todos.length) {
      const emptyEmbed = buildInfoEmbed('完了したToDoリスト', '完了したToDoはありません。`/todoadd`で追加しましょう！');
      await interaction.followUp({ embeds: [emptyEmbed] });
      return;
    }

    const todoLines = todos.map((todo, index) => {
      const number = index + 1;
      const status = todo.completed ? '完了' : '未完了';
      return `${number}. ${status} - ${todo.task}`;
    });

    const listEmbed = new EmbedBuilder()
      .setColor(COLOR_PRIMARY)
      .setTitle('完了したToDoリスト')
      .setDescription(todoLines.join('\n'))
      .setTimestamp(new Date());

    await sendEmbed(interaction, listEmbed);
  } catch (error) {
    console.error('showCompletedTodosでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('完了したToDoリストの取得に失敗しました。後ほどお試しください。'));
  }
}

async function showUserTodos(interaction) {
  const targetUserId = interaction.options.getUser('user', true).id;

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }
    
    console.log(`📋 UserTodos取得開始: targetUserId=${targetUserId}`);
    
    const { data: todos, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: true })
      .limit(15);
    
    if (error) throw error;

    if (!todos.length) {
      const emptyEmbed = buildInfoEmbed(`${interaction.options.getUser('user', true).tag}のToDoリスト`, '登録されているToDoはありません。');
      await sendEmbed(interaction, emptyEmbed);
      return;
    }

    const todoLines = todos.map((todo, index) => {
      const number = index + 1;
      const status = todo.completed ? '完了' : '未完了';
      return `${number}. ${status} - ${todo.task}`;
    });

    const listEmbed = new EmbedBuilder()
      .setColor(COLOR_PRIMARY)
      .setTitle(`${interaction.options.getUser('user', true).tag}のToDo一覧 (最大15件)`)
      .setDescription(todoLines.join('\n'))
      .setTimestamp(new Date());

    await sendEmbed(interaction, listEmbed);
  } catch (error) {
    console.error('showUserTodosでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('他のユーザーのToDoリストの取得に失敗しました。後ほどお試しください。'));
  }
}

async function startPomodoro(interaction) {
  const userId = interaction.user.id;
  const POMODORO_DURATION = 25 * 60 * 1000; // 25分 (ミリ秒)

  try {
    // ユーザーが既にポモドーロを開始しているかチェック
    if (pomodoroSessions.has(userId)) {
      const existingSession = pomodoroSessions.get(userId);
      const remainingMs = existingSession.endTime - Date.now();
      const remainingMin = Math.ceil(remainingMs / 1000 / 60);
      
      const embed = new EmbedBuilder()
        .setColor(COLOR_DANGER)
        .setTitle('⏱️ ポモドーロ実行中')
        .setDescription(`既に進行中のポモドーロセッションがあります。\n\n残り時間: **${remainingMin}分**`)
        .setFooter({ text: '前のセッションを完了してから新しいセッションを開始してください。' })
        .setTimestamp(new Date());
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const startTime = Date.now();
    const endTime = startTime + POMODORO_DURATION;

    // ポモドーロセッション情報を保存
    pomodoroSessions.set(userId, {
      startTime,
      endTime,
      channelId: interaction.channelId,
      guildId: interaction.guildId,
    });

    console.log(`🍅 ポモドーロ開始: user=${userId}, endTime=${new Date(endTime).toISOString()}`);

    // 開始メッセージを送信
    const startEmbed = new EmbedBuilder()
      .setColor(COLOR_PRIMARY)
      .setTitle('🍅 ポモドーロ開始！')
      .setDescription('25分間集中してください！\n\n⏰ **タイマー: 25:00**')
      .addFields(
        {
          name: '📌 ポモドーロテクニックとは',
          value: '25分間の集中作業と5分間の休憩を繰り返す時間管理方法です。\n集中力を保ちながら効率的に勉強できます！',
          inline: false
        },
        {
          name: '🎯 頑張ってください！',
          value: '25分後に通知をお送りします。集中を切らさないで！',
          inline: false
        }
      )
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/924/924514.png')
      .setTimestamp(new Date());

    await interaction.reply({ embeds: [startEmbed] });

    // 25分後にタイマー完了のコールバック
    const timeoutId = setTimeout(async () => {
      await notifyPomodoroComplete(userId, interaction);
      pomodoroSessions.delete(userId);
    }, POMODORO_DURATION);

    // タイムアウトIDを保存して後で キャンセル可能にする
    pomodoroSessions.set(userId, {
      ...pomodoroSessions.get(userId),
      timeoutId,
    });

  } catch (error) {
    console.error('❌ startPomodoroでエラーが発生しました', error);
    await interaction.reply({ embeds: [buildErrorEmbed('ポモドーロの開始に失敗しました。後ほどお試しください。')], ephemeral: true });
  }
}

async function stopPomodoro(interaction) {
  const userId = interaction.user.id;
  const session = pomodoroSessions.get(userId);

  if (!session) {
    await sendEmbed(interaction, buildErrorEmbed('現在進行中のポモドーロセッションがありません。'));
    return;
  }

  const endTime = Date.now();
  const totalMinutes = calculateSessionMinutes(session.startTime, endTime);
  const nowDate = now();
  const dateKey = getDateKey(nowDate);
  const weekKey = getWeekKey(nowDate);
  const monthKey = getMonthKey(nowDate);

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }

    // Supabase에 ポモドーロセッションを保存
    const { error } = await supabase
      .from('study_records')
      .insert([{
        user_id: userId,
        start_time: new Date(session.startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        total_minutes: totalMinutes,
        date: dateKey,
        week: weekKey,
        month: monthKey
      }]);
    
    if (error) throw error;

    // お金を追加（1分=100円）
    const earnedMoney = totalMinutes * 100;
    await addMoney(userId, earnedMoney);

    pomodoroSessions.delete(userId);

    // 총 공부시간 업데이트
    await updateUserTotalStudyTime(userId, totalMinutes);

    // レベル更新
    await updateUserLevel(userId);

    const stopEmbed = buildSuccessEmbed(
      'ポモドーロ終了',
      `ポモドーロセッションを終了しました。\n\n**${formatMinutes(totalMinutes)}** の勉強を記録しました。\n💰 ${earnedMoney.toLocaleString()}円を獲得しました！`
    );
    await sendEmbed(interaction, stopEmbed);
  } catch (error) {
    console.error('stopPomodoroでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('ポモドーロ終了処理でエラーが発生しました。後ほどお試しください。'));
  }
}

async function notifyPomodoroComplete(userId, interaction) {
  try {
    const session = pomodoroSessions.get(userId);
    if (!session) return;

    // 포모도로 세션 시간 계산
    const totalMinutes = calculateSessionMinutes(session.startTime, Date.now());
    const nowDate = now();
    const dateKey = getDateKey(nowDate);
    const weekKey = getWeekKey(nowDate);
    const monthKey = getMonthKey(nowDate);

    console.log(`📝 ポモドーロセッション自動保存開始: user=${userId}, totalMinutes=${totalMinutes}`);

    // Supabaseに自動保存
    try {
      const { error } = await supabase
        .from('study_records')
        .insert([{
          user_id: userId,
          start_time: new Date(session.startTime).toISOString(),
          end_time: new Date().toISOString(),
          total_minutes: totalMinutes,
          date: dateKey,
          week: weekKey,
          month: monthKey
        }]);
      
      if (error) throw error;
      console.log(`✅ ポモドーロセッションをSupabaseに保存しました`);

      // お金を追加（1分=100円）
      const earnedMoney = totalMinutes * 100;
      await addMoney(userId, earnedMoney);
      console.log(`💰 ${userId}に${earnedMoney}円を追加しました`);
    } catch (dbError) {
      console.error('❌ ポモドーロセッション保存中にエラー:', dbError);
    }

    // 총 공부시간 업데이트
    await updateUserTotalStudyTime(userId, totalMinutes);

    // レベル更新
    await updateUserLevel(userId);

    // 完了メッセージ作成（獲得額を表示）
    const completeEmbed = new EmbedBuilder()
      .setColor(COLOR_SUCCESS)
      .setTitle('🎉 ポモドーロ完了！')
      .setDescription(`<@${userId}> お疲れ様でした！\n\n**25分間の集中が終了しました！**`)
      .addFields(
        {
          name: '📊 セッション結果',
          value: `⏱️ **${formatMinutes(totalMinutes)}** の集中\n💰 **${earnedMoney.toLocaleString()}円** を獲得！`,
          inline: false
        },
        {
          name: '✅ 次のステップ',
          value: '5分間の休憩をしてください。その後、次のポモドーロを開始できます！',
          inline: false
        },
        {
          name: '💡 休憩中にできること',
          value: '• 水を飲む\n• ストレッチをする\n• 目を休める\n• 深呼吸をする',
          inline: false
        },
        {
          name: '🔄 次のポモドーロ',
          value: 'さらに集中したければ、`/pomodoro`でまた開始できます！',
          inline: false
        }
      )
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/190/190411.png')
      .setTimestamp(new Date());

    // ユーザーがコマンドを実行したチャンネルに送信
    const guild = await client.guilds.fetch(interaction.guildId);
    const channel = await guild.channels.fetch(interaction.channelId);

    if (channel && channel.isTextBased()) {
      await channel.send({ content: `<@${userId}>`, embeds: [completeEmbed] });
      console.log(`✅ ポモドーロ完了通知を${channel.name}に送信しました`);
    }
  } catch (error) {
    console.error('❌ notifyPomodoroCompleteでエラーが発生しました', error);
  }
}

async function showHelp(interaction) {
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }

    // メインメッセージ
    const mainEmbed = new EmbedBuilder()
      .setColor(COLOR_PRIMARY)
      .setTitle('ボットの使い方ガイド 📚')
      .setDescription('下のボタンをクリックして、各機能の詳細を確認してください！')
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({ text: 'Happy studying! 頑張ってください！' })
      .setTimestamp(new Date());

    // インタラクティブボタン行1
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('help_study')
          .setLabel('⏱️ 勉強記録')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('help_stats')
          .setLabel('📊 統計・ランキング')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('help_todo')
          .setLabel('✅ ToDo管理')
          .setStyle(ButtonStyle.Primary)
      );

    // インタラクティブボタン行2
    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('help_pomodoro')
          .setLabel('🍅 ポモドーロ')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('help_tier')
          .setLabel('🏆 ティアシステム')
          .setStyle(ButtonStyle.Success)
      );

    await interaction.followUp({ embeds: [mainEmbed], components: [row1, row2] });
    console.log(`✅ ヘルプGUIを送信しました: user=${interaction.user.tag}`);
  } catch (error) {
    console.error('❌ showHelpでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('ヘルプメッセージの取得に失敗しました。後ほどお試しください。'));
  }
}

async function handleHelpButton(interaction, customId) {
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }

    const embed = new EmbedBuilder()
      .setColor(COLOR_PRIMARY)
      .setTitle(`${customId.replace('help_', '')}の使い方`);

    let description = '';
    switch (customId) {
      case 'help_study':
        description = `\`/startstudy\` - 勉強開始\n\`/pausestudy\` - 一時停止\n\`/stopstudy\` - 勉強終了（記録に保存）`;
        break;
      case 'help_stats':
        description = `\`/stats\` - 自分の勉強記録\n\`/rank\` - ランキング表示\n\`/globalstats\` - みんなの統計`;
        break;
      case 'help_todo':
        description = `\`/todoadd <内容>\` - ToDoを追加\n\`/todolist\` - 一覧表示\n\`/todocomplete <番号>\` - 完了\n\`/tododelete <番号>\` - 削除`;
        break;
      case 'help_pomodoro':
        description = `\`/pomodoro\` - 25分集中タイマー開始\n\`/pomodorostop\` - タイマー停止`;
        break;
      case 'help_tier':
        description = `🌱 ノービス (5時間未満)\n🥉 ブロンズ (5時間以上)\n🥈 シルバー (10時間以上)\n🏆 ゴールド (20時間以上)\n🤍 プラチナ (30時間以上)\n💎 ダイヤモンド (40時間以上)\n👑 グランドマスター (60時間以上)\n🔥 チャレンジャー (70時間以上)`;
        break;
    }

    embed.setDescription(description);
    await interaction.followUp({ embeds: [embed] });
    console.log(`✅ ヘルプボタンクリックで${customId}の説明を送信しました`);
  } catch (error) {
    console.error('❌ handleHelpButtonでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('ヘルプボタンの説明を取得できませんでした。'));
  }
}

async function handleTodoCompleteButton(interaction, customId) {
  try {
    // customId is in format: todo_complete_<todoId>
    const todoId = parseInt(customId.replace('todo_complete_', ''));
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ ephemeral: true });
    }

    const { data: todo, error: selectError } = await supabase
      .from('todos')
      .select('*')
      .eq('id', todoId)
      .maybeSingle();
    
    if (selectError) throw selectError;

    if (!todo) {
      await interaction.followUp({ 
        content: '❌ そのToDoが見つかりません。もう削除されている可能性があります。',
        ephemeral: true 
      });
      return;
    }

    if (todo.completed) {
      await interaction.followUp({ 
        content: '✅ このToDoはすでに完了しています！',
        ephemeral: true 
      });
      return;
    }

    // Update todo to completed
    const { error: updateError } = await supabase
      .from('todos')
      .update({ completed: true })
      .eq('id', todoId);
    
    if (updateError) throw updateError;

    // Show success message
    const successEmbed = new EmbedBuilder()
      .setColor(COLOR_SUCCESS)
      .setTitle('✨ タスク完了！')
      .setDescription(`「${todo.task}」を完了にしました！\n\n頑張りましたね！🎉`)
      .setTimestamp(new Date());

    await interaction.followUp({ 
      embeds: [successEmbed],
      ephemeral: true 
    });

    console.log(`✅ ToDoを完了にしました: id=${todoId}, task="${todo.task}"`);
  } catch (error) {
    console.error('❌ handleTodoCompleteButtonでエラーが発生しました', error);
    try {
      await interaction.followUp({ 
        content: '❌ ToDoの完了処理に失敗しました。後ほどお試しください。',
        ephemeral: true 
      });
    } catch (err) {
      console.error('❌ followUp送信も失敗:', err.message);
    }
  }
}

// チャットボットAPI設定
const CHATBOT_CONFIG = {
  // あなたのチャットボットAPIエンドポイント
  // 例: https://mellifluous-sopapillas-516e40.netlify.app/api/chat
  API_URL: process.env.CHATBOT_API_URL || 'https://mellifluous-sopapillas-516e40.netlify.app',
  TIMEOUT: 10000, // 10秒
  MAX_RETRIES: 2,
};

// レート制限の設定
const RATE_LIMIT_CONFIG = {
  MAX_REQUESTS: 5, // 1時間に5回
  TIME_WINDOW: 60 * 60 * 1000, // 1時間
};

async function chatBot(interaction) {
  try {
    const userId = interaction.user.id;
    const userMessage = interaction.options.getString('message').trim();

    // 入力検証
    if (!userMessage || userMessage.length === 0) {
      await interaction.reply({
        content: '❌ メッセージが空です。1文字以上500文字以下のメッセージを送ってください。',
        ephemeral: true
      });
      return;
    }

    // レート制限チェック
    if (!checkRateLimit(userId)) {
      await interaction.reply({
        content: '❌ リクエストが多すぎます。1時間に5回まで使用できます。',
        ephemeral: true
      });
      return;
    }

    // リクエスト送信
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }

    console.log(`💬 チャットボットAPI呼び出し開始: user=${userId}, message="${userMessage}"`);

    const response = await callChatbotAPI(userMessage);

    // 応答がない場合
    if (!response || !response.message) {
      throw new Error('無効な応答形式');
    }

    // 応答が長すぎる場合は分割
    const messages = splitMessage(response.message, 1900);

    for (const msg of messages) {
      const embed = new EmbedBuilder()
        .setColor(COLOR_SUCCESS)
        .setTitle('🤖 ラスクちゃんからの返信')
        .setDescription(msg)
        .setFooter({ text: 'Powered by ruskchat Pro' })
        .setTimestamp(new Date());

      await interaction.followUp({ embeds: [embed] });
    }

    console.log(`✅ チャットボット応答完了: user=${userId}`);
  } catch (error) {
    console.error('❌ chatBotでエラーが発生しました', error);
    
    let errorMessage = 'チャットボットとの通信に失敗しました。';
    if (error.message.includes('timeout')) {
      errorMessage = '⏱️ リクエストがタイムアウトしました。もう一度お試しください。';
    } else if (error.message.includes('網接続')) {
      errorMessage = '🌐 ネットワーク接続エラーです。しばらく待ってからお試しください。';
    }

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `❌ ${errorMessage}`, ephemeral: true });
    } else {
      await interaction.followUp({ content: `❌ ${errorMessage}`, ephemeral: true });
    }
  }
}

// レート制限チェック
function checkRateLimit(userId) {
  const now = Date.now();
  const userLimit = chatRateLimits.get(userId) || { requests: [], blocked: false };

  // ブロック済みユーザーの確認
  if (userLimit.blocked && now - userLimit.blockedAt < RATE_LIMIT_CONFIG.TIME_WINDOW) {
    return false;
  }

  // 古いリクエストを削除
  userLimit.requests = userLimit.requests.filter(
    (time) => now - time < RATE_LIMIT_CONFIG.TIME_WINDOW
  );

  // リクエスト数チェック
  if (userLimit.requests.length >= RATE_LIMIT_CONFIG.MAX_REQUESTS) {
    userLimit.blocked = true;
    userLimit.blockedAt = now;
    chatRateLimits.set(userId, userLimit);
    return false;
  }

  // リクエスト記録
  userLimit.requests.push(now);
  chatRateLimits.set(userId, userLimit);
  return true;
}

// チャットボットAPI呼び出し
async function callChatbotAPI(message) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHATBOT_CONFIG.TIMEOUT);

  try {
    // NOTE: あなたのチャットボットAPIエンドポイントに合わせて以下を修正してください
    // 現在は例示用です
    const response = await fetch(CHATBOT_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordStudyBot/1.0'
      },
      body: JSON.stringify({
        message: message,
        timestamp: new Date().toISOString()
      }),
      signal: controller.signal,
      timeout: CHATBOT_CONFIG.TIMEOUT
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: チャットボットサーバーエラー`);
    }

    const data = await response.json();
    
    // APIレスポンス形式を検証
    if (!data.message && !data.reply && !data.text) {
      console.warn('⚠️ 予期しないAPI応答形式:', data);
      return { message: 'チャットボットから応答がありません。' };
    }

    return {
      message: data.message || data.reply || data.text || 'エラーが発生しました',
      raw: data
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('timeout: チャットボットへのリクエストがタイムアウトしました');
    }
    throw new Error(`ネットワーク接続エラー: ${error.message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

// メッセージ分割（Discord 2000文字制限）
function splitMessage(text, maxLength = 1900) {
  if (text.length <= maxLength) {
    return [text];
  }

  const messages = [];
  let currentMessage = '';

  const lines = text.split('\n');
  for (const line of lines) {
    if ((currentMessage + line + '\n').length > maxLength) {
      if (currentMessage) {
        messages.push(currentMessage.trim());
      }
      currentMessage = line + '\n';
    } else {
      currentMessage += line + '\n';
    }
  }

  if (currentMessage) {
    messages.push(currentMessage.trim());
  }

  return messages;
}

// Cosmetic Items Database

async function calculateLevel(totalMinutes) {
  // 5分 = 1レベル、最小1レベル、最大250レベル
  const level = Math.min(250, Math.max(1, 1 + Math.floor(totalMinutes / 5)));
  return level;
}

async function updateUserLevel(userId) {
  try {
    // user_total_study_time から total_minutes を取得
    const { data: studyData, error: studyError } = await supabase
      .from('user_total_study_time')
      .select('total_minutes')
      .eq('user_id', userId)
      .maybeSingle();

    if (studyError) throw studyError;

    const totalMinutes = studyData?.total_minutes || 0;
    const newLevel = await calculateLevel(totalMinutes);

    // discord_users テーブルを更新
    const { error: updateError } = await supabase
      .from('discord_users')
      .update({
        level: newLevel,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    console.log(`📊 ${userId}のレベルを更新しました: Level ${newLevel}`);
    return newLevel;
  } catch (error) {
    console.error('updateUserLevelでエラーが発生しました', error);
    return null;
  }
}

async function showLevel(interaction) {
  const userId = interaction.user.id;

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }

    // ユーザーの情報を保存
    await saveDiscordUser(
      userId,
      interaction.user.username,
      interaction.user.globalName || interaction.user.displayName || interaction.user.username,
      interaction.user.displayAvatarURL()
    );

    // ユーザーの情報を取得
    const { data: userData, error: userError } = await supabase
      .from('discord_users')
      .select('display_name, level')
      .eq('user_id', userId)
      .maybeSingle();

    if (userError) throw userError;

    const userLevel = userData?.level || 1;
    const userDisplayName = userData?.display_name || interaction.user.username;

    // 全員のレベルランキングを取得
    const { data: allUsers, error: allError } = await supabase
      .from('discord_users')
      .select('display_name, level, user_id')
      .order('level', { ascending: false })
      .limit(10);

    if (allError) throw allError;

    // ユーザーのランキング位置を求める
    const { data: userRank, error: rankError } = await supabase
      .from('discord_users')
      .select('level')
      .gt('level', userLevel)
      .neq('user_id', userId);

    if (rankError) throw rankError;

    const rank = (userRank?.length || 0) + 1;

    // レベルバー表示用（5レベル = 10個の四角）
    // 現在の5レベルブロック内でのレベルを計算
    const levelInBlock = ((userLevel - 1) % 5) + 1; // 1-5の中でのレベル
    // 現在の5レベルブロック内での秒数を計算（30秒 = 1個の四角）
    const minutesInBlock = totalMinutes % 150; // 5レベル = 150分
    const secondsInBlock = (minutesInBlock * 60) % 300; // 5分 = 300秒
    const filledSquares = Math.floor(secondsInBlock / 30); // 30秒 = 1個の四角
    const emptySquares = 10 - filledSquares;
    const levelBar = '█'.repeat(filledSquares) + '░'.repeat(emptySquares);
    
    // メインの埋め込み
    const levelEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🎮 レベルランキング')
      .setDescription(`${userDisplayName}さんのレベル情報`)
      .addFields(
        {
          name: '📊 あなたのレベル',
          value: `**Level ${userLevel}** 🏆\n${levelBar}\n${userLevel}/250`,
          inline: false
        },
        {
          name: '🏅 ランキング',
          value: `**${rank}位** (全${allUsers.length}ユーザー中)`,
          inline: true
        },
        {
          name: '⏱️ 必要な公開時間',
          value: `次のレベルまで: ${Math.max(0, (userLevel + 1 - userLevel) * 5)}分`,
          inline: true
        }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp(new Date());

    // ランキング表示（上位10）
    let rankingText = '';
    allUsers.forEach((user, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      // display_nameがNULLの場合はusernameを表示名으로 사용
      const displayName = user.display_name || user.username || user.user_id;
      rankingText += `${medal} **Level ${user.level}** - ${displayName}\n`;
    });

    levelEmbed.addFields({
      name: '📋 トップ10レベルランキング',
      value: rankingText || 'ユーザーがいません',
      inline: false
    });

    await sendEmbed(interaction, levelEmbed);
  } catch (error) {
    console.error('showLevelでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('レベル情報の取得に失敗しました。後ほどお試しください。'));
  }
}

// ==================== ショップシステム ====================

// アイテムデータベース
const SHOP_ITEMS = {
  // 色アイテム
  color_red: { name: '🔴 赤色', price: 500, type: 'color', value: '0xFF0000' },
  color_green: { name: '🟢 緑色', price: 500, type: 'color', value: '0x00FF00' },
  color_blue: { name: '🔵 青色', price: 500, type: 'color', value: '0x0000FF' },
  color_yellow: { name: '🟡 黄色', price: 500, type: 'color', value: '0xFFFF00' },
  color_purple: { name: '🟣 紫色', price: 500, type: 'color', value: '0x9B59B6' },
  color_orange: { name: '🟠 オレンジ色', price: 500, type: 'color', value: '0xFF8C00' },
  color_black: { name: '⚫ 黒色', price: 500, type: 'color', value: '0x000000' },
  color_white: { name: '⚪ 白色', price: 500, type: 'color', value: '0xFFFFFF' },

  // 称号アイテム
  title_king: { name: '🌟 勉強王', price: 1000, type: 'title', value: '🌟 勉強王' },
  title_hard: { name: '🔥 努力家', price: 1000, type: 'title', value: '🔥 努力家' },
  title_genius: { name: '💎 天才', price: 1000, type: 'title', value: '💎 天才' },
  title_champion: { name: '👑 チャンピオン', price: 1000, type: 'title', value: '👑 チャンピオン' },
  title_speed: { name: '⚡ スピードスター', price: 1000, type: 'title', value: '⚡ スピードスター' },
  title_focus: { name: '🎯 集中マスター', price: 1000, type: 'title', value: '🎯 集中マスター' }
};

// 色アイテムとDiscordロールのマッピング
const COLOR_ROLE_MAP = {
  color_red: 'Role_Red',
  color_green: 'Role_Green',
  color_blue: 'Role_Blue',
  color_yellow: 'Role_Yellow',
  color_purple: 'Role_Purple',
  color_orange: 'Role_Orange',
  color_black: 'Role_Black',
  color_white: 'Role_White'
};

// 称号アイテムとDiscordロールのマッピング
const TITLE_ROLE_MAP = {
  title_king: 'Role_Title_King',
  title_hard: 'Role_Title_Hard',
  title_genius: 'Role_Title_Genius',
  title_champion: 'Role_Title_Champion',
  title_speed: 'Role_Title_Speed',
  title_focus: 'Role_Title_Focus'
};

// 残高確認コマンド
async function showBalance(interaction) {
  try {
    const userId = interaction.user.id;

    // お金のデータを取得
    const { data: moneyData, error } = await supabase
      .from('money')
      .select('balance, total_earned')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const balance = moneyData?.balance || 0;
    const totalEarned = moneyData?.total_earned || 0;

    const balanceEmbed = new EmbedBuilder()
      .setColor(COLOR_SUCCESS)
      .setTitle('💰 所持金')
      .setDescription(`${interaction.user.username}さんの財布`)
      .addFields(
        {
          name: '💵 現在の残高',
          value: `**${balance.toLocaleString()}円**`,
          inline: true
        },
        {
          name: '📊 累計獲得',
          value: `${totalEarned.toLocaleString()}円`,
          inline: true
        }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: '勉強するとお金がもらえます！' })
      .setTimestamp(new Date());

    await sendEmbed(interaction, balanceEmbed);
  } catch (error) {
    console.error('showBalanceでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('残高の取得に失敗しました。'));
  }
}

// ショップ表示コマンド
async function showShop(interaction) {
  try {
    const userId = interaction.user.id;

    // 現在の残高を取得
    const { data: moneyData } = await supabase
      .from('money')
      .select('balance')
      .eq('user_id', userId)
      .single();

    const balance = moneyData?.balance || 0;

    // 所有しているアイテムを取得
    const { data: ownedItems } = await supabase
      .from('user_customizations')
      .select('item_id')
      .eq('user_id', userId);

    const ownedItemIds = new Set(ownedItems?.map(item => item.item_id) || []);

    // 色アイテム一覧
    let colorList = '**🎨 色アイテム (500円)**\n';
    Object.entries(SHOP_ITEMS).forEach(([id, item]) => {
      if (item.type === 'color') {
        const owned = ownedItemIds.has(id) ? '✅' : '';
        colorList += `\`${id}\` - ${item.name} ${owned}\n`;
      }
    });

    // 称号アイテム一覧
    let titleList = '**👑 称号アイテム (1000円)**\n';
    Object.entries(SHOP_ITEMS).forEach(([id, item]) => {
      if (item.type === 'title') {
        const owned = ownedItemIds.has(id) ? '✅' : '';
        titleList += `\`${id}\` - ${item.name} ${owned}\n`;
      }
    });

    const shopEmbed = new EmbedBuilder()
      .setColor(COLOR_PRIMARY)
      .setTitle('🏪 アイテムショップ')
      .setDescription(`現在の所持金: **${balance.toLocaleString()}円**\n\n購入するには \`/buy <アイテムID>\` を使用してください`)
      .addFields(
        {
          name: colorList.split('\n')[0],
          value: colorList.split('\n').slice(1).join('\n') || 'なし',
          inline: false
        },
        {
          name: titleList.split('\n')[0],
          value: titleList.split('\n').slice(1).join('\n') || 'なし',
          inline: false
        }
      )
      .setFooter({ text: '✅は購入済みのアイテムです' })
      .setTimestamp(new Date());

    await sendEmbed(interaction, shopEmbed);
  } catch (error) {
    console.error('showShopでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('ショップの表示に失敗しました。'));
  }
}

// アイテム購入コマンド
async function buyItem(interaction) {
  try {
    const userId = interaction.user.id;
    const itemId = interaction.options.getString('item');

    // アイテムが存在するか確認
    const item = SHOP_ITEMS[itemId];
    if (!item) {
      await sendEmbed(interaction, buildErrorEmbed('そのアイテムは存在しません。'));
      return;
    }

    // 残高を確認
    const { data: moneyData, error: moneyError } = await supabase
      .from('money')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (moneyError && moneyError.code !== 'PGRST116') {
      throw moneyError;
    }

    const balance = moneyData?.balance || 0;

    if (balance < item.price) {
      await sendEmbed(interaction, buildErrorEmbed(`お金が足りません！\n必要: ${item.price}円\n所持金: ${balance}円`));
      return;
    }

    // 既に所有しているか確認
    const { data: existingItem } = await supabase
      .from('user_customizations')
      .select('item_id')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .single();

    if (existingItem) {
      await sendEmbed(interaction, buildErrorEmbed('このアイテムは既に所有しています！'));
      return;
    }

    // お金を引く（upsertで更新または挿入）
    const newBalance = balance - item.price;
    const { error: updateError } = await supabase
      .from('money')
      .upsert({
        user_id: userId,
        balance: newBalance,
        total_earned: moneyData?.total_earned || 0,
        last_updated: now().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      throw updateError;
    }

    // アイテムを追加
    const { error: insertError } = await supabase
      .from('user_customizations')
      .insert({
        user_id: userId,
        item_id: itemId,
        item_name: item.name,
        item_type: item.type,
        item_value: item.value,
        purchased_at: now().toISOString(),
        updated_at: now().toISOString()
      });

    if (insertError) {
      throw insertError;
    }

    const purchaseEmbed = new EmbedBuilder()
      .setColor(COLOR_SUCCESS)
      .setTitle('✅ 購入完了！')
      .setDescription(`**${item.name}** を購入しました！`)
      .addFields(
        {
          name: '💰 支払い額',
          value: `${item.price}円`,
          inline: true
        },
        {
          name: '💵 残高',
          value: `${newBalance.toLocaleString()}円`,
          inline: true
        }
      )
      .setFooter({ text: '/inventory で所有アイテムを確認できます' })
      .setTimestamp(new Date());

    await sendEmbed(interaction, purchaseEmbed);
  } catch (error) {
    console.error('buyItemでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('購入に失敗しました。'));
  }
}

// インベントリ表示コマンド
async function showInventory(interaction) {
  try {
    const userId = interaction.user.id;

    // 所有アイテムを取得
    const { data: items, error } = await supabase
      .from('user_customizations')
      .select('*')
      .eq('user_id', userId)
      .order('purchased_at', { ascending: false });

    if (error) {
      throw error;
    }

    if (!items || items.length === 0) {
      await sendEmbed(interaction, buildInfoEmbed('📦 インベントリ', 'まだアイテムを所有していません。\n`/shop` でアイテムを購入しましょう！'));
      return;
    }

    // タイプ別に分類
    const colorItems = items.filter(item => item.item_type === 'color');
    const titleItems = items.filter(item => item.item_type === 'title');

    let colorList = '';
    colorItems.forEach(item => {
      const activeMarker = item.is_active ? '✅ ' : '  ';
      colorList += `${activeMarker}${item.item_name} \`/equip ${item.item_id}\`\n`;
    });

    let titleList = '';
    titleItems.forEach(item => {
      const activeMarker = item.is_active ? '✅ ' : '  ';
      titleList += `${activeMarker}${item.item_name} \`/equip ${item.item_id}\`\n`;
    });

    const inventoryEmbed = new EmbedBuilder()
      .setColor(COLOR_PRIMARY)
      .setTitle('📦 インベントリ')
      .setDescription(`${interaction.user.username}さんの所有アイテム`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp(new Date());

    if (colorList) {
      inventoryEmbed.addFields({
        name: '🎨 色アイテム',
        value: colorList,
        inline: false
      });
    }

    if (titleList) {
      inventoryEmbed.addFields({
        name: '👑 称号アイテム',
        value: titleList,
        inline: false
      });
    }

    inventoryEmbed.setFooter({ text: `合計 ${items.length} 個のアイテムを所有しています` });

    await sendEmbed(interaction, inventoryEmbed);
  } catch (error) {
    console.error('showInventoryでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('インベントリの表示に失敗しました。'));
  }
}

async function equipItem(interaction) {
  try {
    const userId = interaction.user.id;
    const itemId = interaction.options.getString('item');
    const member = interaction.member;
    const guild = interaction.guild;

    // アイテムが存在するか確認
    const item = SHOP_ITEMS[itemId];
    if (!item) {
      await sendEmbed(interaction, buildErrorEmbed('そのアイテムは存在しません。'));
      return;
    }

    // ユーザーがそのアイテムを所有しているか確認
    const { data: ownedItem, error: selectError } = await supabase
      .from('user_customizations')
      .select('id')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      throw selectError;
    }

    if (!ownedItem) {
      await sendEmbed(interaction, buildErrorEmbed('このアイテムを所有していません！\n先に `/buy` で購入してください。'));
      return;
    }

    // アイテムを活性化（同じタイプの他のアイテムは自動で非活性化される）
    const { error: updateError } = await supabase
      .from('user_customizations')
      .update({ is_active: true })
      .eq('user_id', userId)
      .eq('item_id', itemId);

    if (updateError) {
      throw updateError;
    }

    // 色アイテムの場合、Discordのロールを付与
    if (item.type === 'color') {
      const roleNameToAdd = COLOR_ROLE_MAP[itemId];
      
      if (roleNameToAdd) {
        // 新しいロールを取得
        const newRole = guild.roles.cache.find(r => r.name === roleNameToAdd);
        
        if (newRole) {
          // 古いロールを全て削除
          for (const [colorItemId, roleName] of Object.entries(COLOR_ROLE_MAP)) {
            const oldRole = guild.roles.cache.find(r => r.name === roleName);
            if (oldRole && member.roles.cache.has(oldRole.id)) {
              await member.roles.remove(oldRole);
            }
          }
          
          // 新しいロールを追加
          await member.roles.add(newRole);
          console.log(`✅ ユーザー ${userId} に ${roleNameToAdd} ロールを付与しました`);
        } else {
          console.warn(`⚠️ ロール ${roleNameToAdd} が見つかりません。事前に作成してください`);
        }
      }
    }

    // 称号アイテムの場合、Discordのロールを付与
    if (item.type === 'title') {
      const roleNameToAdd = TITLE_ROLE_MAP[itemId];
      
      if (roleNameToAdd) {
        // 新しいロールを取得
        const newRole = guild.roles.cache.find(r => r.name === roleNameToAdd);
        
        if (newRole) {
          // 古いロールを全て削除
          for (const [titleItemId, roleName] of Object.entries(TITLE_ROLE_MAP)) {
            const oldRole = guild.roles.cache.find(r => r.name === roleName);
            if (oldRole && member.roles.cache.has(oldRole.id)) {
              await member.roles.remove(oldRole);
            }
          }
          
          // 新しいロールを追加
          await member.roles.add(newRole);
          console.log(`✅ ユーザー ${userId} に ${roleNameToAdd} ロールを付与しました`);
        } else {
          console.warn(`⚠️ ロール ${roleNameToAdd} が見つかりません。事前に作成してください`);
        }
      }
    }

    const equipEmbed = new EmbedBuilder()
      .setColor(COLOR_SUCCESS)
      .setTitle('✅ 装備完了！')
      .setDescription(`**${item.name}** を装備しました！${item.type === 'color' ? '\nニックネーム色が変更されました！' : ''}`)
      .setFooter({ text: '次回の `/stats` で反映されます' })
      .setTimestamp(new Date());

    await sendEmbed(interaction, equipEmbed);
  } catch (error) {
    console.error('equipItemでエラーが発生しました', error);
    await sendEmbed(interaction, buildErrorEmbed('アイテムの装備に失敗しました。'));
  }
}
