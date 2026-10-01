
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Your Cloudflare website address
const allowedOrigins = [
  "https://login-page.lunzalueugene.workers.dev"
];

// CORS configuration
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// Security and request parsing
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Serve frontend files, if present in the public folder
app.use(express.static(path.join(__dirname, "public")));

// Limit repeated registration requests
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again later."
  }
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Registration endpoint
app.post("/register", registrationLimiter, async (req, res) => {
  try {
    const contact = String(req.body.contact || "").trim();
    const marks = String(req.body.marks || "").trim();

    if (!contact || !marks) {
      return res.status(400).send(
        "Please provide both contact information and marks."
      );
    }

    if (contact.length > 254 || marks.length > 5000) {
      return res.status(400).send("The submitted information is too long.");
    }

    // Check SMTP configuration
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.error("Missing SMTP environment variables.");
      return res.status(503).send(
        "Email service is not configured. Please contact the administrator."
      );
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: Number(SMTP_PORT || 587) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: `"CAT Registration" <${SMTP_USER}>`,
      to: process.env.OWNER_EMAIL || "lunzalueugene@gmail.com",
      subject: "New CAT Registration Submission",
      text: [
        "A new CAT registration form was submitted.",
        "",
        `Contact: ${contact}`,
        "",
        "Submitted marks:",
        marks
      ].join("\n")
    });

    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Submission Received</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f4f6f8;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
          }
          .message {
            background: white;
            padding: 30px;
            border-radius: 12px;
            text-align: center;
            max-width: 420px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.08);
          }
          h1 { color: #198754; }
          p { color: #333; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="message">
          <h1>Submission Received</h1>
          <p>Your information has been submitted successfully.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).send(
      "The submission could not be completed. Please try again later."
    );
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
