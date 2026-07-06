/**
 * SỔ NỘI DUNG — Google Apps Script Web App (ghi/đọc Google Sheet KHÔNG cần MCP connector).
 *
 * ============ CÁCH CÀI (một lần) ============
 * 1. Mở Google Sheet của bạn:
 *    https://docs.google.com/spreadsheets/d/1vNUssFKAr65lGgb63rmS4XeGf2iPFPtEgY2YITnAZgc
 * 2. Menu: Extensions → Apps Script. Xoá code mẫu, DÁN TOÀN BỘ file này vào.
 * 3. Đổi TOKEN bên dưới thành một chuỗi bí mật của riêng bạn.
 * 4. Deploy → New deployment → chọn type "Web app":
 *      - Description: ledger
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    → Deploy → cấp quyền → COPY "Web app URL" (kết thúc bằng /exec).
 * 5. Trong project, tạo file ledger/webhook.json:
 *      { "url": "<Web app URL vừa copy>", "token": "<TOKEN vừa đặt>" }
 *    (ledger.mjs sẽ tự đọc file này để đồng bộ.)
 *
 * Sau này sửa code phải Deploy lại (Manage deployments → Edit → New version).
 */

const TOKEN = 'nook-PeQ8i5AEjZzS';   // mã bí mật (đã tạo sẵn, khớp ledger/webhook.json)
const HEADERS = ['date', 'id', 'format', 'level', 'topic', 'theme', 'situation', 'key_phrase', 'opening_line', 'youtube_title', 'script'];

function sheetFor_(tab) {
  const name = (tab === 'video') ? 'video' : 'reels';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  return sh;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function idColumn_(sh) {
  // Cột 'id' theo HEADERS (idx 1 -> cột 2). Trả mảng id hiện có (bỏ header).
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 2, last - 1, 1).getValues().map(function (r) { return String(r[0]); });
}

// APPEND (idempotent theo id): nhận POST JSON { token, tab, row } → thêm 1 dòng
// NẾU id chưa có; đã có thì bỏ qua (status 'exists').
function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (body.token !== TOKEN) return json_({ status: 'error', error: 'bad token' });
    const tab = (body.tab === 'video' ? 'video' : 'reels');
    const sh = sheetFor_(tab);
    const row = body.row || {};
    const id = String(row.id || '');
    if (id && idColumn_(sh).indexOf(id) >= 0) return json_({ status: 'exists', tab: tab, id: id });
    sh.appendRow(HEADERS.map(function (h) { return row[h] != null ? row[h] : ''; }));
    return json_({ status: 'appended', tab: tab, id: id });
  } catch (err) {
    return json_({ status: 'error', error: String(err) });
  }
}

// GET ?token=..&tab=reels            → trả mọi dòng (cho `pull`).
// GET ?token=..&tab=reels&action=dedupe → xoá dòng trùng id (giữ dòng đầu).
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.token !== TOKEN) return json_({ status: 'error', error: 'bad token' });
  const tab = (p.tab === 'video' ? 'video' : 'reels');
  const sh = sheetFor_(tab);

  if (p.action === 'dedupe') {
    const values = sh.getDataRange().getValues();
    const idCol = (values[0] || HEADERS).indexOf('id');
    const seen = {}; let removed = 0;
    for (let i = values.length - 1; i >= 1; i--) {   // duyệt từ dưới lên để xoá an toàn
      const id = String(values[i][idCol]);
      if (id === '') continue;
      if (seen[id]) { sh.deleteRow(i + 1); removed++; } else seen[id] = true;
    }
    return json_({ status: 'deduped', tab: tab, removed: removed });
  }

  const values = sh.getDataRange().getValues();
  const head = values[0] || HEADERS;
  const rows = values.slice(1).map(function (r) {
    const o = {}; head.forEach(function (h, i) { o[h] = r[i]; }); return o;
  });
  return json_({ status: 'ok', tab: tab, count: rows.length, rows: rows });
}
