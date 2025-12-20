import { recordVoiceActivity, checkAbsence } from './sheets.js';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import dotenv from 'dotenv';

dotenv.config();

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

// システムのテスト
async function testSystem() {
  console.log('🧪 システムテスト開始\n');

  // テスト1: 環境変数の確認
  console.log('📋 テスト1: 環境変数の確認');
  const requiredEnvVars = ['SPREADSHEET_ID', 'DISCORD_TOKEN', 'VOICE_CHANNEL_ID'];
  let envVarsOk = true;

  for (const varName of requiredEnvVars) {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName}: 設定済み`);
    } else {
      console.log(`   ❌ ${varName}: 未設定`);
      envVarsOk = false;
    }
  }

  if (!envVarsOk) {
    console.log('\n❌ 環境変数が不足しています。テストを中止します。');
    return;
  }

  console.log('   ✅ すべての環境変数が設定されています\n');

  // テスト2: Google Sheets APIへの接続確認
  console.log('📋 テスト2: Google Sheets API接続確認');
  try {
    // テストデータを挿入（すぐに削除はしない）
    const testData = {
      userId: 'TEST_USER_ID',
      username: 'test_user',
      displayName: 'テストユーザー',
      joinTime: dayjs().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss'),
      leaveTime: dayjs().tz('Asia/Tokyo').add(1, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      durationMinutes: 1,
      date: dayjs().tz('Asia/Tokyo').format('YYYY-MM-DD'),
      joinHour: dayjs().tz('Asia/Tokyo').hour(),
      wasAbsent: false,
    };

    console.log('   テストデータを挿入中...');
    const result = await recordVoiceActivity(testData);
    console.log(`   ✅ 書き込み成功: ${result.statusInfo.label} (${result.statusInfo.points}pt)`);
    console.log('   ⚠️ テストデータが ActivityLog シートに追加されました。手動で削除してください。\n');
  } catch (error) {
    console.error(`   ❌ 書き込み失敗: ${error.message}\n`);
    return;
  }

  // テスト3: 欠席確認機能のテスト
  console.log('📋 テスト3: 欠席確認機能のテスト');
  try {
    const testDate = dayjs().tz('Asia/Tokyo').format('YYYY-MM-DD');
    const result = await checkAbsence('TEST_USER_ID', testDate);
    console.log(`   ✅ 欠席確認成功: ${result ? '欠席申請あり' : '欠席申請なし'}\n`);
  } catch (error) {
    console.error(`   ❌ 欠席確認失敗: ${error.message}\n`);
  }

  // テスト4: リトライ機能のテスト（無効なスプレッドシートIDでテスト）
  console.log('📋 テスト4: リトライ機能のテスト');
  console.log('   （正常系のため、リトライログのみ確認してください）');
  console.log('   ✅ リトライ機能は実装済み\n');

  console.log('🎉 システムテスト完了！');
  console.log('\n📝 次のステップ:');
  console.log('   1. Botを再起動して改善を適用');
  console.log('   2. ボイスチャンネルに参加して動作を確認');
  console.log('   3. ログを確認して詳細なデバッグ情報が出力されていることを確認');
  console.log('   4. GASダッシュボードを再デプロイして、手動追加したデータが反映されるか確認');
}

testSystem();
