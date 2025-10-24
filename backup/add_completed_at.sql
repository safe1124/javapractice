-- todos 테이블에 completed_at 컬럼 추가
-- Supabase Dashboard → SQL Editor → New query → 복사 & 붙여넣기 → Run

-- completed_at 컬럼 추가 (완료 시간 기록용)
ALTER TABLE todos
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 인덱스 추가 (날짜별 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_todos_completed_at ON todos(completed_at);

-- 완료!
SELECT '✅ completed_at 컬럼이 추가되었습니다!' AS status;
