const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const QRCode = require("qrcode");
const { google } = require("googleapis");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Google Sheets setup
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, // 🔥 use secret file path from Render
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = "1kdb7UOlQSO2Zwpfr2GJOC78hQ-DJqfRC7kiMg8OxAJM";

// Generate unique ticket code
const generateTicketCode = () => {
  return "TICKET-" + Math.random().toString(36).substring(2, 11).toUpperCase();
};

// Test route
app.get("/login", (req, res) => {
  res.send("API is running.. ✅");
});

app.post("/login",(req,res)=>{
  res.send("login succesfull");
});

// Create a new ticket
app.post("/tickets", async (req, res) => {
  try {
    const { Name, ReferenceBy, phone, Email = "", Place = "", Emailsent = "" } = req.body;

    const ticketCode = generateTicketCode();

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(
      `https://qr-ticket-2.onrender.com/verify/${ticketCode}`
    );

    // Append to Google Sheets
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A:H",
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [[
          Name,
          ReferenceBy,
          phone,
          Email,
          Place,
          Emailsent,
          ticketCode,
          "Not Scanned ❌"
        ]],
      },
    });

    res.status(201).json({
      Name,
      ReferenceBy,
      phone,
      Email,
      Place,
      Emailsent,
      ticketCode,
      qrCodeUrl,
      message: "Ticket Generated Successfully ✅",
    });
  } catch (err) {
    console.error("Error in /tickets route:", err);
    res.status(500).json({ error: err.message });
  }
});

// Verify ticket
app.get("/verify/:ticketCode", async (req, res) => {
  try {
    const { ticketCode } = req.params;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A:H",
    });

    const rows = response.data.values || [];
    const dataRows = rows.slice(1);

    const rowIndex = dataRows.findIndex(row => row[6] === ticketCode);

    if (rowIndex >= 0) {
      const rowNumber = rowIndex + 2;

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Sheet1!H${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        resource: { values: [["Present ✅"]] },
      });

      res.json({
        status: "valid",
        name: dataRows[rowIndex][0],
        ticketCode: dataRows[rowIndex][6],
        attendance: "Present ✅"
      });
    } else {
      res.status(404).json({ status: "invalid", message: "Ticket not found" });
    }
  } catch (err) {
    console.error("Error in /verify route:", err);
    res.status(500).json({ error: err.message });
  }
});
// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});