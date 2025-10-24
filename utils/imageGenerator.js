const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

// ① 일본어 폰트 등록 (Google Fonts → Noto Sans JP)
registerFont(path.join(__dirname, '../assets/fonts/NotoSansJP-Bold.ttf'), {
  family: 'Noto Sans JP',
  weight: '700'
});

/**
 * 今日の学習記録イメージ生成
 * @param {Object} data - 사용자 데이터
 * @returns {Buffer} PNG 이미지 버퍼
 */
async function generateTodayImage(data) {
  // ② 캔버스 생성 (1700px 높이로 타임테이블 포함)
  const canvas = createCanvas(1200, 1700);
  const ctx = canvas.getContext('2d');

  // ③ 배경 이미지 (종이 질감)
  const background = await loadImage(path.join(__dirname, '../assets/paper.png'));
  for (let y = 0; y < canvas.height; y += background.height) {
    ctx.drawImage(background, 0, y, canvas.width, Math.min(background.height, canvas.height - y));
  }

  // ④ 색상 팔레트
  const color = {
    main: '#2C3E50',
    accent: '#3498DB',
    sub: '#7F8C8D',
    highlight: '#27AE60',
    alert: '#E74C3C'
  };

  // 기본 설정
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  let y = 100;

  // 날짜
  ctx.fillStyle = color.sub;
  ctx.font = 'bold 28px "Noto Sans JP"';
  ctx.textAlign = 'right';
  ctx.fillText(data.date, canvas.width - 100, y);

  // 제목
  y += 60;
  ctx.fillStyle = color.accent;
  ctx.font = 'bold 56px "Noto Sans JP"';
  ctx.textAlign = 'center';
  ctx.fillText('今日の学習記録', canvas.width / 2, y);

  // 구분선
  y += 70;
  drawLine(ctx, 150, y, 1050, color.sub, 2);

  // 사용자 이름
  y += 50;
  ctx.textAlign = 'left';
  ctx.fillStyle = color.main;
  ctx.font = 'bold 42px "Noto Sans JP"';
  ctx.fillText(data.username, 150, y);

  // 티어/레벨
  y += 55;
  ctx.fillStyle = color.alert;
  ctx.font = 'bold 36px "Noto Sans JP"';
  ctx.fillText(data.tier, 150, y);

  const tierWidth = ctx.measureText(data.tier).width;
  ctx.fillStyle = color.sub;
  ctx.font = 'bold 32px "Noto Sans JP"';
  ctx.fillText(` | Level ${data.level}`, 160 + tierWidth, y);

  // 공부시간 블록
  y += 80;
  drawLine(ctx, 150, y, 1050, color.sub, 1);
  y += 60;

  ctx.textAlign = 'center';
  ctx.fillStyle = color.highlight;
  ctx.font = 'bold 42px "Noto Sans JP"';
  ctx.fillText('今日の勉強時間', canvas.width / 2, y);

  const hours = Math.floor(data.todayTotal / 60);
  const minutes = data.todayTotal % 60;
  y += 80;
  ctx.fillStyle = color.accent;
  ctx.font = 'bold 74px "Noto Sans JP"';
  ctx.fillText(`${hours}時間 ${minutes}分`, canvas.width / 2, y);

  // 완료한 태스크
  y += 100;
  drawLine(ctx, 150, y, 1050, color.sub, 1);
  y += 60;

  ctx.textAlign = 'left';
  ctx.fillStyle = color.highlight;
  ctx.font = 'bold 40px "Noto Sans JP"';
  ctx.fillText('完了したタスク', 150, y);
  y += 60;

  ctx.font = 'bold 32px "Noto Sans JP"';
  ctx.fillStyle = color.main;

  if (!data.completedTasks || data.completedTasks.length === 0) {
    ctx.fillText('完了したタスクがありません', 180, y);
  } else {
    const maxTasks = 10;
    for (let i = 0; i < Math.min(data.completedTasks.length, maxTasks); i++) {
      const task = data.completedTasks[i];
      const trimmed = task.length > 35 ? task.slice(0, 35) + '...' : task;

      ctx.fillStyle = color.highlight;
      ctx.fillText('✓', 180, y);
      ctx.fillStyle = color.main;
      ctx.fillText(trimmed, 220, y);
      y += 50;
    }

    if (data.completedTasks.length > maxTasks) {
      ctx.fillStyle = color.accent;
      ctx.font = 'bold 28px "Noto Sans JP"';
      ctx.fillText(`... 他 ${data.completedTasks.length - maxTasks}個`, 220, y);
    }
  }

  // 타임테이블
  y += 100;
  drawLine(ctx, 150, y, 1050, color.sub, 1);
  y += 60;

  ctx.textAlign = 'left';
  ctx.fillStyle = color.highlight;
  ctx.font = 'bold 40px "Noto Sans JP"';
  ctx.fillText('今日の学習タイムライン', 150, y);
  y += 70;

  const timelineHeight = 600;
  drawTimeline(ctx, data.studySessions || [], 200, y, 900, timelineHeight, color);

  // 하단 문구
  y += timelineHeight + 80;
  ctx.textAlign = 'center';
  ctx.fillStyle = color.alert;
  ctx.font = 'bold 38px "Noto Sans JP"';
  ctx.fillText('お疲れ様でした！', canvas.width / 2, y);

  return canvas.toBuffer('image/png');
}

/** 구분선 */
function drawLine(ctx, x1, y, x2, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

/** 10분 단위 타임테이블 */
function drawTimeline(ctx, studySessions, x, y, width, height, color) {
  const hourRows = 24;
  const colPerHour = 6; // 10분 단위
  const rowHeight = height / hourRows;
  const colWidth = (width - 100) / colPerHour;

  // 시간 행
  for (let i = 0; i < hourRows; i++) {
    const hour = (i + 6) % 24;
    const yPos = y + i * rowHeight;

    ctx.fillStyle = color.sub;
    ctx.font = 'bold 20px "Noto Sans JP"';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${hour.toString().padStart(2, '0')}:00`, x - 10, yPos + rowHeight / 2);

    ctx.strokeStyle = color.sub;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, yPos, width - 100, rowHeight);

    // 10분 단위 세로선
    ctx.lineWidth = 0.5;
    for (let j = 1; j < colPerHour; j++) {
      const xPos = x + j * colWidth;
      ctx.beginPath();
      ctx.moveTo(xPos, yPos);
      ctx.lineTo(xPos, yPos + rowHeight);
      ctx.strokeStyle = '#BDC3C7';
      ctx.stroke();
    }
  }

  // 공부 세션 색칠
  studySessions.forEach(session => {
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);
    const startMin =
      ((start.getHours() < 6 ? start.getHours() + 24 : start.getHours()) * 60 + start.getMinutes()) -
      360;
    const endMin =
      ((end.getHours() < 6 ? end.getHours() + 24 : end.getHours()) * 60 + end.getMinutes()) -
      360;

    const startIndex = Math.floor(startMin / 10);
    const endIndex = Math.ceil(endMin / 10);

    const totalCols = 24 * colPerHour;
    for (let idx = startIndex; idx < endIndex; idx++) {
      const row = Math.floor(idx / colPerHour);
      const col = idx % colPerHour;
      if (row < 0 || row >= hourRows) continue;

      const blockX = x + col * colWidth + 1;
      const blockY = y + row * rowHeight + 1;
      const blockW = colWidth - 2;
      const blockH = rowHeight - 2;

      ctx.fillStyle = color.highlight + '80';
      ctx.fillRect(blockX, blockY, blockW, blockH);
    }
  });
}

module.exports = { generateTodayImage };
