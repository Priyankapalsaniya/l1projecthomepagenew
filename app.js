require("dotenv").config(); // MUST be first

const mysql = require("mysql2");
const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

const app = express();

/* Body parsers */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* Static files */
app.use(express.static(path.join(__dirname, "public")));

/* Ensure uploads folder exists */
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const upload = multer({ dest: "uploads/" });

/* ================= AWS S3 ================= */
AWS.config.update({
  region: "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const s3 = new AWS.S3({
  region: "us-east-1" 
});

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

/* ✅ File Upload (FIXED + DEBUG ADDED) */
app.post("/upload", upload.single("bill"), (req, res) => {
  console.log("📂 File received:", req.file);

  if (!req.file) {
    return res.status(400).send("❌ No file uploaded");
  }

  console.log("Bucket:", process.env.S3_BUCKET);

  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: `${Date.now()}-${req.file.originalname}`,
    Body: fs.readFileSync(req.file.path),
    ContentType: req.file.mimetype
  };

  s3.upload(params, (err, data) => {
    if (err) {
      console.error("❌ S3 Upload Error:", err);
      return res.status(500).send(err.message);
    }

    console.log("✅ File uploaded:", data.Location);

    fs.unlinkSync(req.file.path);

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

/* Server */
app.listen(8080, "0.0.0.0", () => {
  console.log("🚀 Server running on port 8080");
});
