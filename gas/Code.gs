// Google Apps Script - 朝活ダッシュボード

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('朝活トラッキング - ダッシュボード')
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
  }));
}

// 統計データを計算
function getStatistics() {
  const data = getActivityData();

  if (data.error) {
    return data;
  }

  // ユーザー別の統計
  const userStats = {};
  const dateStats = {};

  data.forEach(record => {
    const { displayName, durationMinutes, date } = record;

    // ユーザー別集計
    if (!userStats[displayName]) {
      userStats[displayName] = {
        totalMinutes: 0,
        sessionCount: 0,
        dates: new Set(),
      };
    }
    userStats[displayName].totalMinutes += durationMinutes;
    userStats[displayName].sessionCount += 1;
    userStats[displayName].dates.add(date);

    // 日付別集計
    if (!dateStats[date]) {
      dateStats[date] = {
        totalMinutes: 0,
        uniqueUsers: new Set(),
      };
    }
    dateStats[date].totalMinutes += durationMinutes;
    dateStats[date].uniqueUsers.add(displayName);
  });

  // ランキング作成
  const ranking = Object.entries(userStats)
    .map(([name, stats]) => ({
      name,
      totalMinutes: stats.totalMinutes,
      totalHours: (stats.totalMinutes / 60).toFixed(1),
      sessionCount: stats.sessionCount,
      uniqueDays: stats.dates.size,
      avgMinutes: Math.round(stats.totalMinutes / stats.sessionCount),
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  // 日別データ
  const dailyData = Object.entries(dateStats)
    .map(([date, stats]) => ({
      date,
      totalMinutes: stats.totalMinutes,
      uniqueUsers: stats.uniqueUsers.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    ranking,
    dailyData,
    totalSessions: data.length,
    totalUsers: Object.keys(userStats).length,
  };
}

// ヒートマップ用データ
function getHeatmapData() {
  const data = getActivityData();

  if (data.error) {
    return data;
  }

  // ユーザー×日付のマトリックス
  const heatmap = {};

  data.forEach(record => {
    const { displayName, date, durationMinutes } = record;

    if (!heatmap[displayName]) {
      heatmap[displayName] = {};
    }

    if (!heatmap[displayName][date]) {
      heatmap[displayName][date] = 0;
    }

    heatmap[displayName][date] += durationMinutes;
  });

  return heatmap;
}

// グラフ用のデータを取得
function getChartData(userName = null, days = 30) {
  const data = getActivityData();

  if (data.error) {
    return data;
  }

  // 日付でフィルタリング（最近N日間）
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const filtered = data.filter(record => {
    const recordDate = new Date(record.date);
    return recordDate >= cutoffDate && (!userName || record.displayName === userName);
  });

  // 日付別に集計
  const dailyTotals = {};

  filtered.forEach(record => {
    const { date, durationMinutes, displayName } = record;

    if (!dailyTotals[date]) {
      dailyTotals[date] = {};
    }

    if (!dailyTotals[date][displayName]) {
      dailyTotals[date][displayName] = 0;
    }

    dailyTotals[date][displayName] += durationMinutes;
  });

  return dailyTotals;
}
