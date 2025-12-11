// Google Apps Script - 4人で競う朝活ゲーム

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('朝活バトル - Morning Winner')
    .setFaviconUrl('https://cdn-icons-png.flaticon.com/512/1828/1828791.png');
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

  return rows.map(row => ({
    date: row[0],
    userId: row[1],
    username: row[2],
    displayName: row[3],
    joinTime: row[4],
    leaveTime: row[5],
    durationMinutes: row[6],
    joinHour: row[7],
    status: row[8] || 'on-time',
    emoji: row[9] || '🌟',
    label: row[10] || 'オンタイム',
    points: row[11] || 10,
    wasAbsent: row[12] || false,
  }));
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

      if (record.status === 'on-time') {
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
function calculateBadges(userRecords, streaks) {
  const records = Object.values(userRecords);

  const badges = {
    '🏆 朝活マスター': streaks.maxOnTimeStreak >= 30,
    '⭐ 早起き王': streaks.maxOnTimeStreak >= 7,
    '🎯 完璧主義者': records.every(r => r.status === 'on-time'),
    '🎉 奇跡の参加': records.some(r => r.wasAbsent),
    '💎 ダイヤモンド': streaks.maxStreak >= 100,
    '🥇 ゴールド': streaks.maxStreak >= 50,
    '🥈 シルバー': streaks.maxStreak >= 30,
    '🥉 ブロンズ': streaks.maxStreak >= 10,
  };

  return Object.entries(badges)
    .filter(([_, has]) => has)
    .map(([badge, _]) => badge);
}

// 統計データを計算
function getGameStats() {
  const data = getActivityData();
  const absences = getAbsenceData();

  if (data.error) {
    return data;
  }

  // ユーザー別のデータを集計（同日の最初の参加のみ）
  const userMap = {};

  data.forEach(record => {
    const { userId, displayName, date, status, points, wasAbsent } = record;

    if (!userMap[userId]) {
      userMap[userId] = {
        userId,
        displayName,
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
    if (!userMap[userId].records[date]) {
      userMap[userId].records[date] = record;
      userMap[userId].totalPoints += points || 0;

      if (status === 'on-time') userMap[userId].onTimeCount++;
      else if (status === 'late') userMap[userId].lateCount++;
      else if (status === 'very-late') userMap[userId].veryLateCount++;
      else if (status === 'critical') userMap[userId].criticalCount++;

      if (wasAbsent) userMap[userId].miracleCount++;
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
    const badges = calculateBadges(user.records, streak);

    return {
      ...user,
      totalDays,
      onTimeRate: totalDays > 0 ? ((user.onTimeCount / totalDays) * 100).toFixed(1) : 0,
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
  const onTimeCount = records.filter(r => r.status === 'on-time').length;
  const totalPoints = records.reduce((sum, r) => sum + (r.points || 0), 0);

  return {
    userId,
    displayName: records[0].displayName,
    timeData,
    totalDays,
    onTimeCount,
    onTimeRate: ((onTimeCount / totalDays) * 100).toFixed(1),
    totalPoints,
    level: Math.floor(totalPoints / 100) + 1,
    streak: userStreak.currentStreak,
    maxStreak: userStreak.maxStreak,
    onTimeStreak: userStreak.currentOnTimeStreak,
    maxOnTimeStreak: userStreak.maxOnTimeStreak,
  };
}

// ユーザーを追加（手動登録用）
function addUser(userId, username, displayName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');

  // Usersシートがなければ作成
  if (!sheet) {
    const newSheet = ss.insertSheet('Users');
    newSheet.appendRow(['ユーザーID', 'ユーザー名', '表示名', '登録日時']);
  }

  const usersSheet = ss.getSheetByName('Users');
  const now = new Date().toISOString();

  usersSheet.appendRow([userId, username, displayName, now]);

  return { success: true, message: 'ユーザーを追加しました' };
}

// ユーザーを削除
function deleteUser(userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ActivityLogから削除
  const activitySheet = ss.getSheetByName('ActivityLog');
  if (activitySheet) {
    const data = activitySheet.getDataRange().getValues();
    const userIdCol = 1; // B列（0-indexed）

    // 後ろから削除（行番号がずれないように）
    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][userIdCol] === userId) {
        activitySheet.deleteRow(i + 1);
      }
    }
  }

  // AbsenceLogから削除
  const absenceSheet = ss.getSheetByName('AbsenceLog');
  if (absenceSheet) {
    const data = absenceSheet.getDataRange().getValues();
    const userIdCol = 1; // B列

    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][userIdCol] === userId) {
        absenceSheet.deleteRow(i + 1);
      }
    }
  }

  // Usersから削除
  const usersSheet = ss.getSheetByName('Users');
  if (usersSheet) {
    const data = usersSheet.getDataRange().getValues();
    const userIdCol = 0; // A列

    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][userIdCol] === userId) {
        usersSheet.deleteRow(i + 1);
      }
    }
  }

  return { success: true, message: 'ユーザーを削除しました' };
}
