import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Google Sheets APIクライアントの初期化
async function getAuthClient() {
  const credentialsPath = path.join(process.cwd(), 'credentials.json');

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      'credentials.jsonが見つかりません。\n' +
      'Google Cloud ConsoleでService Accountを作成し、credentials.jsonをダウンロードしてください。'
    );
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });

  return await auth.getClient();
}

// Sheetsクライアントを取得
async function getSheetsClient() {
  const auth = await getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

// ボイスチャンネル参加記録をSheetsに追加
export async function recordVoiceActivity(data) {
  const {
    userId,
    username,
    displayName,
    joinTime,
    leaveTime,
    durationMinutes,
    date,
    joinHour,
  } = data;

  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // データシートに記録
    const values = [[
      date,           // A: 日付
      userId,         // B: ユーザーID
      username,       // C: ユーザー名
      displayName,    // D: 表示名
      joinTime,       // E: 参加時刻
      leaveTime,      // F: 退出時刻
      durationMinutes,// G: 滞在時間（分）
      joinHour,       // H: 参加時（時間）
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'ActivityLog!A:H',
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });

    return true;
  } catch (error) {
    console.error('Google Sheets記録エラー:', error);
    throw error;
  }
}

// Sheetsにヘッダーを初期化（初回のみ実行）
export async function initializeSheets() {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // ActivityLogシートのヘッダー
    const activityHeaders = [[
      '日付',
      'ユーザーID',
      'ユーザー名',
      '表示名',
      '参加時刻',
      '退出時刻',
      '滞在時間（分）',
      '参加時（時間）',
    ]];

    // ヘッダーを追加
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'ActivityLog!A1:H1',
      valueInputOption: 'RAW',
      resource: { values: activityHeaders },
    });

    console.log('✅ Sheetsの初期化が完了しました');
    return true;
  } catch (error) {
    console.error('❌ Sheets初期化エラー:', error.message);
    throw error;
  }
}
