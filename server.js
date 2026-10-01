
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Render runs behind a trusted proxy.
app.set("trust proxy", 1);

const allowedOrigins = [
  "https://login-page.blackverification.workers.dev/"
];

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

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: "Too many submissions. Please try again later."
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/register", registrationLimiter, async (req, res) => {
  try {
    const contact = String(req.body.contact || "").trim();
    const marks = String(req.body.marks || "").trim();

    if (!contact || !marks) {
      return res.status(400).send(
        "Please provide the required registration information."
      );
    }

    if (contact.length > 254 || marks.length > 5000) {
      return res.status(400).send(
        "The submitted information is too long."
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const ownerEmail = process.env.OWNER_EMAIL;
    const fromEmail = process.env.FROM_EMAIL;

    if (!apiKey || !ownerEmail || !fromEmail) {
      console.error("Missing Resend environment variables.");
      return res.status(503).send(
        "Email service is not configured. Please contact the administrator."
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response;

    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [ownerEmail],
          subject: "New CAT Registration Submission",
          text: [
            "A new CAT registration submission was received.",
            "",
            `Contact: ${contact}`,
            "",
            "Submitted information:",
            marks
          ].join("\n")
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resend API error:", response.status, errorText);
      return res.status(502).send(
        "The email service could not process the submission. Please try again later."
      );
    }

    const result = await response.json();
    console.log("Email accepted by Resend:", result.id);

    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Submission Received</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f4f6f8;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
          }
          .message {
            background: white;
            padding: 30px;
            border-radius: 12px;
            text-align: center;
            max-width: 420px;
            box-shadow: 0 4px 16px rgba(0,0,0,.08);
          }
          h1 { color: #198754; }
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

    if (error.name === "AbortError") {
      return res.status(504).send(
        "The email service timed out. Please try again later."
      );
    }

    return res.status(500).send(
      "The submission could not be completed. Please try again later."
    );
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
