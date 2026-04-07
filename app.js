require("dotenv").config(); // ✅ MUST be first

const mysql = require("mysql2");
const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

const app = express();

/* ✅ Body parsers (ONLY ONCE) */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* ✅ Static files */
app.use(express.static(path.join(__dirname, "public")));

/* ✅ Ensure uploads folder exists */
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const upload = multer({ dest: "uploads/" });

/* ================= AWS S3 ================= */
AWS.config.update({ region: "us-east-1" });
const s3 = new AWS.S3();

/* ================= RDS CONNECTION ================= */
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) {
    console.error("❌ DB connection failed:", err);
    return;
  }
  console.log("✅ Connected to RDS");
});

/* ================= ROUTES ================= */

/* Home */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* File Upload */
app.post("/upload", upload.single("bill"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("❌ No file uploaded");
  }

  const params = {
    Bucket: "customer-bills1new",
    Key: `${Date.now()}-${req.file.originalname}`,
    Body: fs.createReadStream(req.file.path),
    ContentType: req.file.mimetype
  };

  s3.upload(params, (err) => {
    if (err) {
      console.error("❌ S3 Upload Error:", err);
      return res.status(500).send("❌ Upload failed");
    }

    fs.unlinkSync(req.file.path); // delete local file
    res.send("✅ File uploaded successfully");
  });
});

/* Subscribe */
app.post("/subscribe", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).send("❌ Email is required");
  }

  db.query(
    "INSERT INTO subscribers (email) VALUES (?)",
    [email],
    (err) => {
      if (err) {
        console.error("❌ DB insert error:", err);
        return res.status(500).send("❌ Database error");
      }
      res.send("✅ Subscription successful");
    }
  );
});

/* ================= SERVER ================= */
app.listen(8080, "0.0.0.0", () => {
  console.log("🚀 Server running on port 8080");
});

