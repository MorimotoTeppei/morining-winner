// Google Apps Script - 4人で競う朝活ゲーム

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Dashboard-v3')
    .setTitle('朝活バトル - Morning Winner')
    .setFaviconUrl('https://cdn-icons-png.flaticon.com/512/1828/1828791.png');
}

// デバッグ用：スプレッドシートの状態を確認
function debugSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  Logger.log('=== スプレッドシート診断 ===');
  Logger.log('スプレッドシート名: ' + ss.getName());
  Logger.log('シート数: ' + sheets.length);

  sheets.forEach(sheet => {
    Logger.log('シート名: ' + sheet.getName());
    Logger.log('  行数: ' + sheet.getLastRow());
    Logger.log('  列数: ' + sheet.getLastColumn());

    if (sheet.getLastRow() > 0) {
      const firstRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      Logger.log('  ヘッダー: ' + JSON.stringify(firstRow));
    }
  });

  return {
    spreadsheetName: ss.getName(),
    sheetCount: sheets.length,
    sheets: sheets.map(s => ({
      name: s.getName(),
      rows: s.getLastRow(),
      columns: s.getLastColumn()
    }))
  };
}

// デバッグ用：getActivityDataのテスト
function testGetActivityData() {
  Logger.log('=== getActivityData テスト ===');
  const data = getActivityData();
  Logger.log('取得したデータ: ' + JSON.stringify(data));
  Logger.log('データ型: ' + typeof data);
  Logger.log('配列?: ' + Array.isArray(data));
  if (Array.isArray(data)) {
    Logger.log('要素数: ' + data.length);
  }
  return data;
}

// デバッグ用：getGameStatsのテスト
function testGetGameStats() {
  Logger.log('=== getGameStats テスト ===');
  const stats = getGameStats();
  Logger.log('取得した統計: ' + JSON.stringify(stats));
  Logger.log('データ型: ' + typeof stats);
  return stats;
}

// ActivityLogシートからデータを取得
function getActivityData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('ActivityLog');

  if (!sheet) {
    return { error: 'ActivityLogシートが見つかりません' };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    // 日付を文字列に変換
    const dateObj = row[0] instanceof Date ? row[0] : new Date(row[0]);
    const dateStr = dateObj.toISOString().split('T')[0];

    // 時刻も文字列に変換
    const joinTimeStr = row[4] instanceof Date ? row[4].toISOString() : String(row[4]);
    const leaveTimeStr = row[5] instanceof Date ? row[5].toISOString() : String(row[5]);

    return {
      date: dateStr,
      userId: String(row[1]),
      username: String(row[2]),
      displayName: String(row[3]),
      joinTime: joinTimeStr,
      leaveTime: leaveTimeStr,
      durationMinutes: Number(row[6]),
      joinHour: Number(row[7]),
      status: row[8] || 'winner',
      emoji: row[9] || '🏆',
      label: row[10] || 'Winner',
      points: Number(row[11]) || 10,
      wasAbsent: Boolean(row[12]),
    };
  });
}

// 欠席申請データを取得
function getAbsenceData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('AbsenceLog');

  if (!sheet) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);

  return rows.map(row => ({
    date: row[0],
    userId: row[1],
    username: row[2],
    displayName: row[3],
    requestTime: row[4],
  }));
}

// 過去N日間の日付リストを生成
function generateDateList(days) {
  const dates = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}

// ヒートマップ用データを生成
function generateHeatmapData(data, absences, days = 30) {
  const dateList = generateDateList(days);
  const userMap = {};

  // ユーザーごとにデータを整理（同日の最初の参加のみ）
  data.forEach(record => {
    const { userId, displayName, date, status, points, wasAbsent } = record;

    if (!userMap[userId]) {
      userMap[userId] = {
        displayName,
        dates: {},
      };
    }

    // 同じ日の最初の参加のみを記録
    if (!userMap[userId].dates[date]) {
      userMap[userId].dates[date] = {
        status,
        points,
        wasAbsent,
      };
    }
  });

  // 欠席申請をマップに追加
  const absenceMap = {};
  absences.forEach(absence => {
    const key = `${absence.userId}_${absence.date}`;
    absenceMap[key] = true;
  });

  // 全日付分のヒートマップデータを生成
  const heatmapData = {};

  Object.entries(userMap).forEach(([userId, user]) => {
    heatmapData[userId] = {
      displayName: user.displayName,
      days: dateList.map(date => {
        const absenceKey = `${userId}_${date}`;
        const hasAbsence = absenceMap[absenceKey];
        const record = user.dates[date];

        if (record) {
          return {
            date,
            status: record.status,
            points: record.points,
            wasAbsent: record.wasAbsent,
          };
        } else if (hasAbsence) {
          return {
            date,
            status: 'absent',
            points: 0,
            wasAbsent: false,
          };
        } else {
          return {
            date,
            status: 'missing',
            points: 0,
            wasAbsent: false,
          };
        }
      }),
    };
  });

  return heatmapData;
}

// ストリークを計算
function calculateStreaks(data, absences) {
  const userStreaks = {};
  const absenceMap = {};

  absences.forEach(absence => {
    const key = `${absence.userId}_${absence.date}`;
    absenceMap[key] = true;
  });

  // ユーザー別にグループ化（同日の最初の参加のみ）
  const userDataMap = {};
  data.forEach(record => {
    if (!userDataMap[record.userId]) {
      userDataMap[record.userId] = {};
    }
    // 同じ日の最初の参加のみ
    if (!userDataMap[record.userId][record.date]) {
      userDataMap[record.userId][record.date] = record;
    }
  });

  // 各ユーザーのストリークを計算
  Object.entries(userDataMap).forEach(([userId, dateRecords]) => {
    const records = Object.values(dateRecords).sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );

    let currentStreak = 0;
    let maxStreak = 0;
    let onTimeStreak = 0;
    let maxOnTimeStreak = 0;
    let lastDate = null;

    records.forEach(record => {
      const recordDate = new Date(record.date);

      if (lastDate) {
        const dayDiff = Math.floor((recordDate - lastDate) / (1000 * 60 * 60 * 24));
        if (dayDiff === 1) {
          currentStreak++;
        } else if (dayDiff > 1) {
          let hasAllAbsences = true;
          for (let i = 1; i < dayDiff; i++) {
            const checkDate = new Date(lastDate);
            checkDate.setDate(checkDate.getDate() + i);
            const dateStr = checkDate.toISOString().split('T')[0];
            const key = `${userId}_${dateStr}`;
            if (!absenceMap[key]) {
              hasAllAbsences = false;
              break;
            }
          }
          if (hasAllAbsences) {
            currentStreak++;
          } else {
            currentStreak = 1;
          }
        }
      } else {
        currentStreak = 1;
      }

      maxStreak = Math.max(maxStreak, currentStreak);

      if (record.status === 'winner') {
        onTimeStreak++;
        maxOnTimeStreak = Math.max(maxOnTimeStreak, onTimeStreak);
      } else {
        onTimeStreak = 0;
      }

      lastDate = recordDate;
    });

    userStreaks[userId] = {
      displayName: records[0].displayName,
      currentStreak,
      maxStreak,
      currentOnTimeStreak: onTimeStreak,
      maxOnTimeStreak,
    };
  });

  return userStreaks;
}

// バッジを計算
function calculateBadges(userRecords, streaks, recentRate) {
  const records = Object.values(userRecords);
  const totalDays = records.length;

  const badges = {
    // 継続バッジ（大きい達成）
    '💎 ダイヤモンド': streaks.maxStreak >= 100,
    '🥇 ゴールド': streaks.maxStreak >= 50,
    '🥈 シルバー': streaks.maxStreak >= 30,
    '🥉 ブロンズ': streaks.maxStreak >= 10,

    // Winner連続バッジ
    '🏆 朝活マスター': streaks.maxOnTimeStreak >= 30,
    '⭐ 早起き王': streaks.maxOnTimeStreak >= 7,
    '🎯 完璧主義者': records.every(r => r.status === 'winner'),

    // 小さな達成もモチベーションアップ
    '🔥 5連勝': streaks.currentStreak >= 5,
    '💪 3連勝': streaks.currentStreak >= 3,
    '🌱 2連勝': streaks.currentStreak >= 2,

    // 特別バッジ
    '🎉 奇跡の参加': records.some(r => r.wasAbsent),
    '🆕 チャレンジャー': totalDays <= 3 && totalDays > 0,
    '📈 成長中': recentRate >= 70 && totalDays >= 7,
    '🎊 カムバック': streaks.currentStreak >= 2 && streaks.maxStreak > streaks.currentStreak + 5,
  };

  return Object.entries(badges)
    .filter(([_, has]) => has)
    .map(([badge, _]) => badge);
}

// 統計データを計算
function getGameStats() {
  try {
    const data = getActivityData();
    const absences = getAbsenceData();

    if (data.error) {
      return data;
    }

    if (!data || data.length === 0) {
      return {
        error: 'データが見つかりません。ボイスチャンネルに参加してログを記録してください。',
        ranking: [],
        heatmapData: {},
        mvp: null,
        totalSessions: 0,
        totalUsers: 0,
        streaks: {},
      };
    }

  // ユーザー別のデータを集計（同日の最初の参加のみ）
  const userMap = {};

  data.forEach(record => {
    const { userId, displayName, date, status, points, wasAbsent } = record;

    // dateを文字列として扱う
    const dateKey = String(date);

    if (!userMap[userId]) {
      userMap[userId] = {
        userId: String(userId),
        displayName: String(displayName),
        records: {},
        totalPoints: 0,
        onTimeCount: 0,
        lateCount: 0,
        veryLateCount: 0,
        criticalCount: 0,
        miracleCount: 0,
      };
    }

    // 同じ日の最初の参加のみをカウント
    if (!userMap[userId].records[dateKey]) {
      userMap[userId].records[dateKey] = record;
      userMap[userId].totalPoints += Number(points) || 0;

      if (status === 'winner') userMap[userId].onTimeCount++;
      else if (status === 'late') userMap[userId].lateCount++;
      else if (status === 'very-late') userMap[userId].veryLateCount++;
      else if (status === 'critical') userMap[userId].criticalCount++;

      if (wasAbsent) userMap[userId].miracleCount++;
    }
  });

  // 直近7日の参加率を計算
  const recentDays = generateDateList(7);
  const recentMap = {};
  data.forEach(record => {
    if (recentDays.includes(record.date)) {
      if (!recentMap[record.userId]) {
        recentMap[record.userId] = {};
      }
      if (!recentMap[record.userId][record.date]) {
        recentMap[record.userId][record.date] = true;
      }
    }
  });

  // ストリークを計算
  const streaks = calculateStreaks(data, absences);

  // ランキングを作成
  const ranking = Object.values(userMap).map(user => {
    const totalDays = Object.keys(user.records).length;
    const streak = streaks[user.userId] || {
      currentStreak: 0,
      maxStreak: 0,
      currentOnTimeStreak: 0,
      maxOnTimeStreak: 0
    };

    // 直近7日の参加率を計算
    const recentDaysCount = recentMap[user.userId] ? Object.keys(recentMap[user.userId]).length : 0;
    const recentRate = (recentDaysCount / 7 * 100).toFixed(1);

    const badges = calculateBadges(user.records, streak, parseFloat(recentRate));

    return {
      ...user,
      totalDays,
      winnerRate: totalDays > 0 ? ((user.onTimeCount / totalDays) * 100).toFixed(1) : 0,
      recentRate,
      avgPoints: totalDays > 0 ? (user.totalPoints / totalDays).toFixed(1) : 0,
      streak: streak.currentStreak,
      maxStreak: streak.maxStreak,
      onTimeStreak: streak.currentOnTimeStreak,
      maxOnTimeStreak: streak.maxOnTimeStreak,
      badges,
      level: Math.floor(user.totalPoints / 100) + 1,
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  // ヒートマップデータ
  const heatmapData = generateHeatmapData(data, absences, 30);

  // 今日のMVP
  const today = new Date().toISOString().split('T')[0];
  const todayRecords = data.filter(r => r.date === today);
  const mvp = todayRecords.length > 0
    ? todayRecords.reduce((best, current) => {
        if (!best || current.points > best.points) return current;
        return best;
      }, null)
    : null;

  return {
    ranking,
    heatmapData,
    mvp,
    totalSessions: data.length,
    totalUsers: Object.keys(userMap).length,
    streaks,
  };
  } catch (error) {
    Logger.log('getGameStats エラー: ' + error.message);
    Logger.log('エラースタック: ' + error.stack);
    return {
      error: 'データの処理中にエラーが発生しました: ' + error.message,
      ranking: [],
      heatmapData: {},
      mvp: null,
      totalSessions: 0,
      totalUsers: 0,
      streaks: {},
    };
  }
}

// ユーザー詳細データを取得
function getUserDetail(userId) {
  const data = getActivityData();
  const absences = getAbsenceData();

  if (data.error) {
    return data;
  }

  // ユーザーのデータをフィルタリング（同日の最初の参加のみ）
  const userRecords = {};
  data.forEach(record => {
    if (record.userId === userId && !userRecords[record.date]) {
      userRecords[record.date] = record;
    }
  });

  const records = Object.values(userRecords).sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  if (records.length === 0) {
    return { error: 'ユーザーのデータが見つかりません' };
  }

  // 7時（420分）からの差分を計算
  const timeData = records.map(record => {
    const joinTime = new Date(record.joinTime);
    const hours = joinTime.getHours();
    const minutes = joinTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const targetMinutes = 7 * 60; // 7:00
    const diffMinutes = totalMinutes - targetMinutes;

    return {
      date: record.date,
      joinTime: record.joinTime,
      diffMinutes,
      status: record.status,
      points: record.points,
    };
  });

  // ストリーク計算
  const streaks = calculateStreaks(data, absences);
  const userStreak = streaks[userId] || {
    currentStreak: 0,
    maxStreak: 0,
    currentOnTimeStreak: 0,
    maxOnTimeStreak: 0
  };

  // 統計情報
  const totalDays = records.length;
  const winnerCount = records.filter(r => r.status === 'winner').length;
  const totalPoints = records.reduce((sum, r) => sum + (r.points || 0), 0);

  return {
    userId,
    displayName: records[0].displayName,
    timeData,
    totalDays,
    winnerCount,
    winnerRate: ((winnerCount / totalDays) * 100).toFixed(1),
    totalPoints,
    level: Math.floor(totalPoints / 100) + 1,
    streak: userStreak.currentStreak,
    maxStreak: userStreak.maxStreak,
    onTimeStreak: userStreak.currentOnTimeStreak,
    maxOnTimeStreak: userStreak.maxOnTimeStreak,
  };
}
