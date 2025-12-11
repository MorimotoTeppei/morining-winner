import { initializeSheets } from './sheets.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔧 Google Sheetsを初期化しています...');

initializeSheets()
  .then(() => {
    console.log('✅ セットアップ完了！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ セットアップ失敗:', error.message);
    process.exit(1);
  });
