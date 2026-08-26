/**
 * Order logging endpoint for the Frog Racing store.
 *
 * Deployment (one-time setup):
 * 1. Go to https://sheets.google.com and create a new blank spreadsheet.
 *    Name it something like "Frog Racing Orders".
 * 2. In that sheet, go to Extensions -> Apps Script.
 * 3. Delete any starter code in the editor and paste this entire file in its place.
 * 4. Click Deploy -> New deployment.
 *    - Click the gear icon next to "Select type" and choose "Web app".
 *    - Description: anything, e.g. "Order logging".
 *    - Execute as: Me.
 *    - Who has access: Anyone.
 *    - Click Deploy, then authorize it with your Google account when prompted.
 * 5. Copy the "Web app URL" it gives you (ends in /exec).
 * 6. Paste that URL into ORDER_LOG_WEBHOOK_URL near the top of app.js.
 *
 * If you ever edit this script after deploying, use Deploy -> Manage
 * deployments -> edit (pencil icon) -> New version -> Deploy, otherwise the
 * live URL keeps running the old code.
 */
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Timestamp", "Order ID", "Buyer Name", "Buyer Email",
      "Ship To Name", "Address Line 1", "Address Line 2", "City", "State", "Postal Code", "Country",
      "Product", "Variant", "Quantity", "Unit Price", "Line Total",
      "Order Subtotal", "Order Shipping", "Order Total",
    ]);
  }

  const data = JSON.parse(e.postData.contents);
  const timestamp = new Date();

  for (const item of data.items) {
    sheet.appendRow([
      timestamp,
      data.orderId,
      data.payerName,
      data.payerEmail,
      data.shipToName,
      data.shipToAddressLine1,
      data.shipToAddressLine2,
      data.shipToCity,
      data.shipToState,
      data.shipToPostalCode,
      data.shipToCountry,
      item.product,
      item.variant,
      item.quantity,
      item.unitPrice,
      item.lineTotal,
      data.subtotal,
      data.shipping,
      data.total,
    ]);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}
