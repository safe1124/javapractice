const { createClient } = require('@supabase/supabase-js');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);

const supabase = createClient(
  'https://hmbjbyqadoqljwqetxky.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYmpieXFhZG9xbGp3cWV0eGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk1NzU1MTgsImV4cCI6MjA0NTE1MTUxOH0.EKu5xdOWPCHqywdjFZZTq1V30aDHtJTWN0SVjNcoBaU'
);

async function verifyStudyTime() {
  const userId = '1319219710059024405';
  const todayKey = '2025-10-26'; // Today's date

  const { data, error } = await supabase
    .from('study_records')
    .select('*')
    .eq('user_id', userId)
    .eq('date', todayKey)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\n=== Today's Study Records (${todayKey}) ===\n`);

  let totalSeconds = 0;

  data.forEach((record, index) => {
    const startUTC = dayjs.utc(record.start_time);
    const endUTC = dayjs.utc(record.end_time);

    const startJST = startUTC.add(9, 'hour');
    const endJST = endUTC.add(9, 'hour');

    const durationSeconds = endUTC.diff(startUTC, 'second');
    totalSeconds += durationSeconds;

    console.log(`Record ${index + 1}:`);
    console.log(`  UTC: ${startUTC.format('HH:mm:ss')} - ${endUTC.format('HH:mm:ss')}`);
    console.log(`  JST: ${startJST.format('HH:mm:ss')} - ${endJST.format('HH:mm:ss')}`);
    console.log(`  Duration: ${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s (${record.total_minutes} minutes in DB)`);
    console.log();
  });

  const totalMinutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  console.log(`\n=== Total Study Time ===`);
  console.log(`Total: ${totalMinutes}m ${remainingSeconds}s`);
  console.log(`Total seconds: ${totalSeconds}s`);
  console.log(`Number of records: ${data.length}`);

  process.exit(0);
}

verifyStudyTime();
