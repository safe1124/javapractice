-- Discord Study Bot - Supabase 테이블 생성 SQL
-- 실행 방법: Supabase Dashboard → SQL Editor → New query → 복사 & 붙여넣기 → Run

-- 1. study_records 테이블
CREATE TABLE IF NOT EXISTS study_records (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  total_minutes INTEGER NOT NULL,
  date TEXT NOT NULL,
  week TEXT NOT NULL,
  month TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- study_records 인덱스
CREATE INDEX IF NOT EXISTS idx_study_records_user_id ON study_records(user_id);
CREATE INDEX IF NOT EXISTS idx_study_records_date ON study_records(date);
CREATE INDEX IF NOT EXISTS idx_study_records_week ON study_records(week);
CREATE INDEX IF NOT EXISTS idx_study_records_month ON study_records(month);

-- 2. todos 테이블
CREATE TABLE IF NOT EXISTS todos (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  task TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- todos 인덱스
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);

-- 3. money 테이블
CREATE TABLE IF NOT EXISTS money (
  user_id TEXT PRIMARY KEY,
  balance BIGINT DEFAULT 0,
  total_earned BIGINT DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- money 인덱스
CREATE INDEX IF NOT EXISTS idx_money_balance ON money(balance DESC);

-- 4. user_customizations 테이블 (구매한 아이템 저장)
CREATE TABLE IF NOT EXISTS user_customizations (
  user_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_value TEXT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_customizations 인덱스
CREATE INDEX IF NOT EXISTS idx_user_customizations_user_id ON user_customizations(user_id);

-- 5. user_total_study_time 테이블 (유저별 총 공부시간)
CREATE TABLE IF NOT EXISTS user_total_study_time (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  total_minutes BIGINT DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_total_study_time 인덱스
CREATE INDEX IF NOT EXISTS idx_user_total_study_user_id ON user_total_study_time(user_id);
CREATE INDEX IF NOT EXISTS idx_user_total_study_minutes_desc ON user_total_study_time(total_minutes DESC);

-- 완료!
SELECT 'Tables created successfully!' AS status;

