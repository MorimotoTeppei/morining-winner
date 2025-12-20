import { recordVoiceActivity } from './sheets.js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// 失敗したログを復旧する
async function retryFailedLogs() {
  const backupFile = './logs/failed-logs.json';

  if (!fs.existsSync(backupFile)) {
    console.log('💚 失敗したログはありません。');
    return;
  }

  try {
    const content = fs.readFileSync(backupFile, 'utf8');
    const failedLogs = JSON.parse(content);

    if (failedLogs.length === 0) {
      console.log('💚 失敗したログはありません。');
      return;
    }

    console.log(`🔧 ${failedLogs.length}件の失敗ログを復旧します...\n`);

    const successfulLogs = [];
    const stillFailedLogs = [];

    for (const log of failedLogs) {
      try {
        console.log(`📝 ${log.displayName} のログを復旧中...`);
        console.log(`   参加: ${log.joinTime}`);
        console.log(`   退出: ${log.leaveTime}`);

        await recordVoiceActivity(log);

        console.log(`   ✅ 復旧成功\n`);
        successfulLogs.push(log);
      } catch (error) {
        console.error(`   ❌ 復旧失敗: ${error.message}\n`);
        stillFailedLogs.push(log);
      }
    }

    // まだ失敗しているログをバックアップファイルに保存
    if (stillFailedLogs.length > 0) {
      fs.writeFileSync(backupFile, JSON.stringify(stillFailedLogs, null, 2));
      console.log(`⚠️ ${stillFailedLogs.length}件のログが復旧できませんでした。`);
    } else {
      // すべて復旧成功した場合、バックアップファイルを削除
      fs.unlinkSync(backupFile);
      console.log(`🎉 すべてのログを復旧しました！バックアップファイルを削除しました。`);
    }

    console.log(`\n✅ 復旧成功: ${successfulLogs.length}件`);
    console.log(`❌ 復旧失敗: ${stillFailedLogs.length}件`);
  } catch (error) {
    console.error('❌ エラー:', error.message);
  }
}

retryFailedLogs();
