import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { recordVoiceActivity, recordAbsence, checkAbsence } from './sheets.js';
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
    GatewayIntentBits.GuildMessages,
  ],
});

// ユーザーの参加状況を記録するMap
const activeUsers = new Map();

// Botが起動したとき
client.once('ready', () => {
  console.log(`✅ Bot起動完了: ${client.user.tag}`);
  console.log(`📊 朝活トラッキング開始...`);
  console.log(`🎯 監視チャンネルID: ${process.env.VOICE_CHANNEL_ID}`);

  // ヘルスチェック: 1時間ごとにBotの状態をログ出力
  setInterval(() => {
    const now = dayjs().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss');
    console.log(`💚 ヘルスチェック: Botは正常に動作しています (${now})`);
    console.log(`   現在のアクティブユーザー数: ${activeUsers.size}`);
  }, 60 * 60 * 1000); // 1時間ごと
});

// ボイスチャンネルの状態変化を監視
client.on('voiceStateUpdate', async (oldState, newState) => {
  const targetChannelId = process.env.VOICE_CHANNEL_ID;

  const userId = newState.member.id;
  const username = newState.member.user.username;
  const displayName = newState.member.displayName;

  // デバッグログ: すべてのvoiceStateUpdateイベントを記録
  const now = dayjs().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss');
  console.log(`🔍 [${now}] voiceStateUpdate検知: ${displayName} (${userId})`);
  console.log(`   oldChannel: ${oldState.channelId || 'なし'}, newChannel: ${newState.channelId || 'なし'}`);
  console.log(`   targetChannel: ${targetChannelId}`);

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

      // 欠席申請をチェック
      let wasAbsent = false;
      try {
        wasAbsent = await checkAbsence(userId, joinTime.format('YYYY-MM-DD'));
      } catch (error) {
        console.error(`⚠️ 欠席確認エラー:`, error.message);
      }

      // Google Sheetsに記録
      try {
        const result = await recordVoiceActivity({
          userId,
          username,
          displayName,
          joinTime: joinTime.format('YYYY-MM-DD HH:mm:ss'),
          leaveTime: leaveTime.format('YYYY-MM-DD HH:mm:ss'),
          durationMinutes,
          date: joinTime.format('YYYY-MM-DD'),
          joinHour: joinTime.hour(),
          wasAbsent,
        });

        const { statusInfo } = result;
        console.log(`${statusInfo.emoji} ${statusInfo.label} - ${statusInfo.points}ポイント`);

        if (wasAbsent) {
          console.log(`🎉 奇跡の参加！欠席申請していたのに参加しました！`);
        }

        console.log(`✅ Sheetsに記録完了`);
      } catch (error) {
        console.error(`❌ Sheets記録エラー:`, error.message);
        console.error(`❌ データ: ${JSON.stringify({ userId, displayName, joinTime: joinTime.format('YYYY-MM-DD HH:mm:ss') })}`);
      }

      activeUsers.delete(userId);
    } else {
      console.warn(`⚠️ ${displayName} の参加記録が見つかりません（activeUsersにデータなし）`);
    }
  }
});

// スラッシュコマンドの処理
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'absence') {
    const now = dayjs().tz('Asia/Tokyo');
    const today = now.format('YYYY-MM-DD');
    const hour = now.hour();

    // 4時以降は欠席申請不可
    if (hour >= 4) {
      await interaction.reply({
        content: '❌ 欠席申請は当日の朝4時までです！',
        ephemeral: true,
      });
      return;
    }

    try {
      await recordAbsence({
        userId: interaction.user.id,
        username: interaction.user.username,
        displayName: interaction.member.displayName,
        date: today,
        requestTime: now.format('YYYY-MM-DD HH:mm:ss'),
      });

      await interaction.reply({
        content: `✅ ${today}の欠席を申請しました。ストリークは維持されます！\n（でも参加したら「奇跡の参加」バッジがもらえるよ👀）`,
        ephemeral: true,
      });

      console.log(`📝 ${interaction.member.displayName} が ${today} の欠席を申請しました`);
    } catch (error) {
      await interaction.reply({
        content: '❌ エラーが発生しました。もう一度お試しください。',
        ephemeral: true,
      });
      console.error('欠席申請エラー:', error);
    }
  }
});

// エラーハンドリング
client.on('error', (error) => {
  console.error('❌ Discord Client エラー:', error);
});

// 再接続処理
client.on('shardDisconnect', (event, shardId) => {
  console.warn(`⚠️ Discord切断 (Shard ${shardId}):`, event);
  console.log(`🔄 自動再接続を試みます...`);
});

client.on('shardReconnecting', (shardId) => {
  console.log(`🔄 Discord再接続中... (Shard ${shardId})`);
});

client.on('shardResume', (shardId, replayedEvents) => {
  console.log(`✅ Discord再接続成功 (Shard ${shardId}, イベント再生: ${replayedEvents})`);
});

// Warnings
client.on('warn', (warning) => {
  console.warn(`⚠️ Discord警告:`, warning);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ 未処理のPromise拒否:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 SIGINTを受信しました。Botを終了します...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERMを受信しました。Botを終了します...');
  client.destroy();
  process.exit(0);
});

// Botにログイン
client.login(process.env.DISCORD_TOKEN);
