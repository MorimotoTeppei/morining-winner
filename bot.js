import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { recordVoiceActivity } from './sheets.js';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

// Dayjsのプラグイン設定
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

dotenv.config();

// Discord Clientの作成
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// ユーザーの参加状況を記録するMap
const activeUsers = new Map();

// Botが起動したとき
client.once('ready', () => {
  console.log(`✅ Bot起動完了: ${client.user.tag}`);
  console.log(`📊 朝活トラッキング開始...`);
  console.log(`🎯 監視チャンネルID: ${process.env.VOICE_CHANNEL_ID}`);
});

// ボイスチャンネルの状態変化を監視
client.on('voiceStateUpdate', async (oldState, newState) => {
  const targetChannelId = process.env.VOICE_CHANNEL_ID;

  const userId = newState.member.id;
  const username = newState.member.user.username;
  const displayName = newState.member.displayName;

  // 対象チャンネルに参加した場合
  if (newState.channelId === targetChannelId && oldState.channelId !== targetChannelId) {
    const joinTime = dayjs().tz('Asia/Tokyo');
    activeUsers.set(userId, {
      username,
      displayName,
      joinTime,
    });

    console.log(`🟢 ${displayName} が参加しました (${joinTime.format('YYYY-MM-DD HH:mm:ss')})`);
  }

  // 対象チャンネルから退出した場合
  if (oldState.channelId === targetChannelId && newState.channelId !== targetChannelId) {
    const leaveTime = dayjs().tz('Asia/Tokyo');
    const userData = activeUsers.get(userId);

    if (userData) {
      const { joinTime, displayName } = userData;
      const durationMinutes = leaveTime.diff(joinTime, 'minute');

      console.log(`🔴 ${displayName} が退出しました (${leaveTime.format('YYYY-MM-DD HH:mm:ss')})`);
      console.log(`⏱️  滞在時間: ${durationMinutes}分`);

      // Google Sheetsに記録
      try {
        await recordVoiceActivity({
          userId,
          username,
          displayName,
          joinTime: joinTime.format('YYYY-MM-DD HH:mm:ss'),
          leaveTime: leaveTime.format('YYYY-MM-DD HH:mm:ss'),
          durationMinutes,
          date: joinTime.format('YYYY-MM-DD'),
          joinHour: joinTime.hour(),
        });
        console.log(`✅ Sheetsに記録完了`);
      } catch (error) {
        console.error(`❌ Sheets記録エラー:`, error.message);
      }

      activeUsers.delete(userId);
    }
  }
});

// エラーハンドリング
client.on('error', (error) => {
  console.error('Discord Client エラー:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('未処理のPromise拒否:', error);
});

// Botにログイン
client.login(process.env.DISCORD_TOKEN);
