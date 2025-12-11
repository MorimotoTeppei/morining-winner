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

// 参加時刻から状態を判定
function getStatusFromJoinTime(joinTimeStr) {
  const time = new Date(joinTimeStr);
  const hour = time.getHours();
  const minute = time.getMinutes();
  const totalMinutes = hour * 60 + minute;

  const targetTime = 7 * 60; // 7:00
  const lateTime = 7 * 60 + 15; // 7:15
  const veryLateTime = 8 * 60; // 8:00
  const criticalTime = 9 * 60; // 9:00

  if (totalMinutes <= targetTime + 14) {
    return {
      status: 'winner',
      emoji: '🏆',
      label: 'Winner',
      points: 10,
    };
  } else if (totalMinutes < veryLateTime) {
    return {
      status: 'late',
      emoji: '⚠️',
      label: '遅刻',
      points: 5,
    };
  } else if (totalMinutes < criticalTime) {
    return {
      status: 'very-late',
      emoji: '🔥',
      label: '大遅刻',
      points: 2,
    };
  } else {
    return {
      status: 'critical',
      emoji: '💀',
      label: '危機感もてよ！brooo',
      points: 0,
    };
  }
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
    wasAbsent = false, // 欠席申請していたか
  } = data;

  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // 参加時刻から状態を判定
    const statusInfo = getStatusFromJoinTime(joinTime);

    // データシートに記録
    const values = [[
      date,              // A: 日付
      userId,            // B: ユーザーID
      username,          // C: ユーザー名
      displayName,       // D: 表示名
      joinTime,          // E: 参加時刻
      leaveTime,         // F: 退出時刻
      durationMinutes,   // G: 滞在時間（分）
      joinHour,          // H: 参加時（時間）
      statusInfo.status, // I: 状態（on-time/late/very-late/critical）
      statusInfo.emoji,  // J: 絵文字
      statusInfo.label,  // K: ラベル
      statusInfo.points, // L: ポイント
      wasAbsent,         // M: 欠席申請していたか
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'ActivityLog!A:M',
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });

    return {
      success: true,
      statusInfo,
      wasAbsent,
    };
  } catch (error) {
    console.error('Google Sheets記録エラー:', error);
    throw error;
  }
}

// 欠席申請を記録
export async function recordAbsence(data) {
  const { userId, username, displayName, date, requestTime } = data;

  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const values = [[
      date,        // A: 日付
      userId,      // B: ユーザーID
      username,    // C: ユーザー名
      displayName, // D: 表示名
      requestTime, // E: 申請時刻
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'AbsenceLog!A:E',
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });

    return true;
  } catch (error) {
    console.error('欠席申請記録エラー:', error);
    throw error;
  }
}

// 特定日の欠席申請をチェック
export async function checkAbsence(userId, date) {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'AbsenceLog!A:E',
    });

    const rows = response.data.values || [];

    // ヘッダー行をスキップして検索
    for (let i = 1; i < rows.length; i++) {
      const [absenceDate, absenceUserId] = rows[i];
      if (absenceDate === date && absenceUserId === userId) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('欠席確認エラー:', error);
    return false;
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
      '状態',
      '絵文字',
      'ラベル',
      'ポイント',
      '欠席申請済み',
    ]];

    // AbsenceLogシートのヘッダー
    const absenceHeaders = [[
      '日付',
      'ユーザーID',
      'ユーザー名',
      '表示名',
      '申請時刻',
    ]];

    // ActivityLogヘッダーを追加
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'ActivityLog!A1:M1',
      valueInputOption: 'RAW',
      resource: { values: activityHeaders },
    });

    // AbsenceLogヘッダーを追加
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'AbsenceLog!A1:E1',
      valueInputOption: 'RAW',
      resource: { values: absenceHeaders },
    });

    console.log('✅ ActivityLogシートの初期化が完了しました');
    console.log('✅ AbsenceLogシートの初期化が完了しました');
    console.log('📝 Google Sheetsに「AbsenceLog」という名前のシートを追加してください');
    return true;
  } catch (error) {
    console.error('❌ Sheets初期化エラー:', error.message);
    throw error;
  }
}
