const XLSX = require('xlsx');
const wb = XLSX.readFile('/Users/dk/Downloads/SchedulesPublicEventsReport2026-01-01_2026-01-31.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
let headerIdx = -1;
for (let i = 0; i < rows.length; i++) {
  if (rows[i].includes('Дата')) { headerIdx = i; break; }
}
const headers = rows[headerIdx];
const classIdx = headers.indexOf('Име');
const serviceIdx = headers.indexOf('Име на услугата');
const attendanceIdx = headers.indexOf('Присъствие');
const seen = new Set();
for (let i = headerIdx + 1; i < rows.length; i++) {
  const row = rows[i];
  const key = row[classIdx] + '|' + row[serviceIdx];
  if (!seen.has(key) && String(row[classIdx]).toLowerCase().includes('йога')) {
    seen.add(key);
    console.log('Class:', row[classIdx], '| Service:', row[serviceIdx], '| Att:', row[attendanceIdx]);
  }
}
