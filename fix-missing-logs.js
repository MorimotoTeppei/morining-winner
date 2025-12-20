import { recordVoiceActivity } from './sheets.js';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config();

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

// 欠けているログデータを挿入
const missingLogs = [
  {
    userId: '1362249234530959582',
    username: 'haruka_5555._43979',
    displayName: 'Haruka',
    joinTime: '2025-12-19 07:07:00',
    leaveTime: '2025-12-19 08:53:00',
  },
  {
    userId: '963685098404864041',
    username: 'renya000',
    displayName: 'renya',
    joinTime: '2025-12-19 07:41:00',
    leaveTime: '2025-12-19 07:43:00',
  },
  {
    userId: '1027116714976104519',
    username: 'gakuto_0625',
    displayName: 'GAKUTO',
    joinTime: '2025-12-20 09:09:00',
    leaveTime: '2025-12-20 09:14:00',
  },
];

async function insertMissingLogs() {
  console.log('🔧 欠けているログを挿入します...\n');

  for (const log of missingLogs) {
    try {
      const joinTime = dayjs.tz(log.joinTime, 'Asia/Tokyo');
      const leaveTime = dayjs.tz(log.leaveTime, 'Asia/Tokyo');
      const durationMinutes = leaveTime.diff(joinTime, 'minute');

      console.log(`📝 ${log.displayName} のログを挿入中...`);
      console.log(`   参加: ${log.joinTime}`);
      console.log(`   退出: ${log.leaveTime}`);
      console.log(`   滞在: ${durationMinutes}分`);

      const result = await recordVoiceActivity({
        userId: log.userId,
        username: log.username,
        displayName: log.displayName,
        joinTime: log.joinTime,
        leaveTime: log.leaveTime,
        durationMinutes,
        date: joinTime.format('YYYY-MM-DD'),
        joinHour: joinTime.hour(),
        wasAbsent: false,
      });

      const { statusInfo } = result;
      console.log(`   ${statusInfo.emoji} ${statusInfo.label} - ${statusInfo.points}ポイント`);
      console.log(`   ✅ 挿入完了\n`);

    } catch (error) {
      console.error(`   ❌ エラー: ${error.message}\n`);
    }
  }

  console.log('🎉 すべてのログを挿入しました！');
}

insertMissingLogs();
