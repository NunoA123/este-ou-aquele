/**
 * Backend do Anel da Karolina — Google Apps Script.
 *
 * Setup:
 *  1. Criar uma Google Sheet nova. Primeira linha de cabeçalhos, exactamente:
 *       timestamp | a | b | winner | elo_a | elo_b
 *  2. Extensions → Apps Script. Apagar o que lá estiver e colar isto.
 *  3. Deploy → New deployment → tipo "Web app"
 *       Execute as:      Me
 *       Who has access:  Anyone
 *  4. Copiar o URL que acaba em /exec e colá-lo na constante SYNC_URL
 *     no topo do app.js.
 *
 * Sempre que se mudar este ficheiro é preciso fazer Deploy → Manage
 * deployments → editar → New version. Senão o URL continua a servir o antigo.
 */

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName('Sheet1') || ss.getSheets()[0];
}

function doPost(e) {
  var out = { ok: true, added: 0 };
  try {
    var d = JSON.parse(e.postData.contents);
    var rows = d.rows || [];
    var sh = sheet_();
    rows.forEach(function (r) {
      sh.appendRow([new Date(r.t), r.a, r.b, r.winner, r.elo_a, r.elo_b]);
    });
    out.added = rows.length;
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  var v = sheet_().getDataRange().getValues().slice(1);
  return ContentService.createTextOutput(JSON.stringify(v))
    .setMimeType(ContentService.MimeType.JSON);
}
