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

const counts = {};
for (let i = headerIdx + 1; i < rows.length; i++) {
  const row = rows[i];
  const cls = String(row[classIdx] || '').trim();
  const att = row[attendanceIdx];
  const svc = String(row[serviceIdx] || '').trim();
  if (cls === 'Класическа йога' && att === 'Да') {
    const key = svc || '(празно)';
    counts[key] = (counts[key] || 0) + 1;
  }
}
console.log('Класическа йога - услуги:');
console.log(counts);
