const SCRIPT_VERSION = "2026-06-08-friendly";
const DRIVE_FOLDER_ID = "";
const SENDER_NAME = "Classroom Learning Walks";
const EMAIL_SUBJECT_PREFIX = "Classroom Learning Walks CSV Export";

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      version: SCRIPT_VERSION,
      method: "GET"
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const recipientEmail = String((e.parameter && e.parameter.recipientEmail) || "").trim();
    const originalFilename = String((e.parameter && e.parameter.filename) || "classroom-learning-walks-indicators.csv").trim();
    const csvContent = String((e.parameter && e.parameter.csvContent) || "");
    const recordCount = String((e.parameter && e.parameter.recordCount) || "0").trim();

    if (!recipientEmail) {
      throw new Error("Missing recipient email address.");
    }

    if (!csvContent) {
      throw new Error("Missing CSV content.");
    }

    const finalFilename = getTimestampedFilename_(originalFilename);
    const csvBlob = Utilities.newBlob(csvContent, "text/csv", finalFilename);
    const driveFile = saveCsvToDrive_(csvBlob.copyBlob());

    MailApp.sendEmail({
      to: recipientEmail,
      subject: EMAIL_SUBJECT_PREFIX,
      body:
        "Your Classroom Learning Walks CSV export is attached.\n\n" +
        "Walkthroughs included: " + recordCount + "\n" +
        "Saved filename: " + finalFilename + "\n" +
        "Drive copy: " + driveFile.getUrl(),
      attachments: [csvBlob],
      name: SENDER_NAME
    });

    return buildHtmlResponse_({
      ok: true,
      recipientEmail,
      recordCount,
      finalFilename,
      driveUrl: driveFile.getUrl()
    });
  } catch (error) {
    return buildHtmlResponse_({
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function saveCsvToDrive_(csvBlob) {
  const folderId = String(DRIVE_FOLDER_ID || "").trim();

  if (folderId) {
    return DriveApp.getFolderById(folderId).createFile(csvBlob);
  }

  return DriveApp.createFile(csvBlob);
}

function getTimestampedFilename_(filename) {
  const safeName = String(filename || "classroom-learning-walks-indicators.csv").trim();
  const timestamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd_HH-mm-ss"
  );
  const lastDotIndex = safeName.lastIndexOf(".");

  if (lastDotIndex > 0) {
    const baseName = safeName.slice(0, lastDotIndex);
    const extension = safeName.slice(lastDotIndex);
    return baseName + "-" + timestamp + extension;
  }

  return safeName + "-" + timestamp;
}

function buildHtmlResponse_(payload) {
  const title = payload.ok ? "CSV Export Complete" : "CSV Export Failed";
  const accentColor = payload.ok ? "#0f766e" : "#b42318";
  const summary = payload.ok
    ? "The CSV was emailed and saved to Google Drive successfully."
    : "Google Apps Script could not complete the export.";

  const details = payload.ok
    ? [
        `<p><strong>Recipient:</strong> ${escapeHtml_(payload.recipientEmail)}</p>`,
        `<p><strong>Walkthroughs included:</strong> ${escapeHtml_(payload.recordCount)}</p>`,
        `<p><strong>Saved filename:</strong> ${escapeHtml_(payload.finalFilename)}</p>`,
        `<p><a class="button" href="${payload.driveUrl}" target="_blank" rel="noopener noreferrer">Open the Drive copy</a></p>`,
        "<p class=\"hint\">You can close this window and return to the form.</p>"
      ].join("")
    : [
        `<p><strong>Issue:</strong> ${escapeHtml_(payload.error || "Unknown error.")}</p>`,
        "<p class=\"hint\">Please keep this window open and share the message above if you need help troubleshooting.</p>"
      ].join("");

  const html = [
    "<!DOCTYPE html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `<title>${escapeHtml_(title)}</title>`,
    "<style>",
    "body{margin:0;padding:32px;font-family:Arial,sans-serif;background:#f4f7f6;color:#172026;}",
    ".card{max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #d8e2e0;border-radius:22px;padding:28px 30px;box-shadow:0 20px 50px rgba(23,32,38,0.08);}",
    `.eyebrow{margin:0 0 10px;color:${accentColor};font-size:0.78rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;}`,
    "h1{margin:0 0 12px;font-size:1.85rem;line-height:1.1;color:#102a2c;}",
    "p{margin:0 0 12px;line-height:1.6;}",
    ".summary{font-size:1.02rem;color:#33555b;}",
    ".button{display:inline-block;padding:12px 18px;border-radius:999px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;}",
    ".hint{margin-top:18px;color:#5d6f73;font-size:0.94rem;}",
    ".meta{margin-top:18px;padding-top:16px;border-top:1px solid #e3ebea;color:#667b7f;font-size:0.88rem;}",
    "</style>",
    "</head>",
    "<body>",
    "<div class=\"card\">",
    `<p class="eyebrow">${payload.ok ? "Export Successful" : "Export Failed"}</p>`,
    `<h1>${escapeHtml_(title)}</h1>`,
    `<p class="summary">${escapeHtml_(summary)}</p>`,
    details,
    `<p class="meta">Script version: ${escapeHtml_(SCRIPT_VERSION)}</p>`,
    "</div>",
    "</body>",
    "</html>"
  ].join("");

  return HtmlService.createHtmlOutput(html)
    .setTitle(title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
