const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const QRCode = require("qrcode");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
require("dotenv").config(); // Load .env

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Google Sheets setup
const auth = new google.auth.GoogleAuth({
  keyFile: "service_account.json", // path to your JSON key
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = "1kdb7UOlQSO2Zwpfr2GJOC78hQ-DJqfRC7kiMg8OxAJM"; // replace with your sheet ID

// Generate unique ticket code
const generateTicketCode = () => {
  return "TICKET-" + Math.random().toString(36).substring(2, 11).toUpperCase();
};

// ---------- ROUTES ----------

// Test route
app.get("/login", (req, res) => {
  res.send("API is running.. ✅");
});

// Create a new ticket
app.post("/tickets", async (req, res) => {
  try {
    const { Name, ReferenceBy, phone, Email, Place, Emailsent } = req.body;
    const ticketCode = generateTicketCode();

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(
      `https://yourdomain.com/verify/${ticketCode}`
    );

    // Append to Google Sheets
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A:H",
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [[
          Name,        // A
          ReferenceBy, // B
          phone,       // C
          Email,       // D
          Place,       // E
          Emailsent,   // F
          ticketCode,  // G
          "Not Scanned ❌" // H (Attendance)
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
    res.status(500).json({ error: err.message });
  }
});

// Verify Ticket + mark attendance
app.get("/verify/:ticketCode", async (req, res) => {
  try {
    const { ticketCode } = req.params;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A:H",
    });

    const rows = response.data.values || [];
    const dataRows = rows.slice(1); // skip header row

    // Find row index where ticketCode matches (G column, index 6)
    const rowIndex = dataRows.findIndex((row) => row[6] === ticketCode);

    if (rowIndex >= 0) {
      const rowNumber = rowIndex + 2; // +2 (1 for header, 1 for index)

      // Mark attendance in column H
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Sheet1!H${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        resource: {
          values: [["Present ✅"]],
        },
      });

      res.json({
        status: "valid",
        name: dataRows[rowIndex][0],
        referenceBy: dataRows[rowIndex][1],
        phone: dataRows[rowIndex][2],
        email: dataRows[rowIndex][3],
        place: dataRows[rowIndex][4],
        emailsent: dataRows[rowIndex][5],
        ticketCode: dataRows[rowIndex][6],
        attendance: "Present ✅",
      });
    } else {
      res.status(404).json({ status: "invalid", message: "Ticket not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if a Name exists
app.get("/check-name/:name", async (req, res) => {
  try {
    const { name } = req.params;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A:H",
    });

    const rows = response.data.values || [];
    const dataRows = rows.slice(1);

    const found = dataRows.find(
      (row) => row[0].toLowerCase() === name.toLowerCase()
    );

    if (found) {
      res.json({
        status: "found",
        name: found[0],
        referenceBy: found[1],
        phone: found[2],
        email: found[3],
        place: found[4],
        emailsent: found[5],
        ticketCode: found[6],
        attendance: found[7],
      });
    } else {
      res.status(404).json({ status: "not found", message: "Name not in list" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------- EXTRA FEATURE: Send Ticket by Email --------
app.post("/send-email", async (req, res) => {
  try {
    const { ReferenceBy, Name, qrCodeUrl, ticketCode } = req.body;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: ReferenceBy, // using ReferenceBy as email
      subject: "Your Ticket QR Code",
      html: `
        <h2>Hello ${Name},</h2>
        <p>Here is your QR code ticket:</p>
        <img src="${qrCodeUrl}" alt="QR Code" />
        <p>Ticket Code: ${ticketCode}</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: "QR code sent to email!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
