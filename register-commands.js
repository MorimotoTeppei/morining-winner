import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const commands = [
  new SlashCommandBuilder()
    .setName('absence')
    .setDescription('当日の朝活を欠席する（朝4時まで）')
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔧 スラッシュコマンドを登録しています...');

    // グローバルコマンドとして登録（全サーバーで使用可能）
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('✅ スラッシュコマンドの登録が完了しました！');
    console.log('📝 登録されたコマンド:');
    console.log('   /absence - 欠席申請（朝4時まで）');
  } catch (error) {
    console.error('❌ コマンド登録エラー:', error);
  }
})();
