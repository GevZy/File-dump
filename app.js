// File: app.js

const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// ----- CONFIGURATION -----
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: "supersecret",
  resave: false,
  saveUninitialized: true,
}));

// ----- DATABASE CONNECTION -----
mongoose.connect("mongodb://127.0.0.1:27017/fileShareApp", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
});

const fileSchema = new mongoose.Schema({
  originalName: String,
  path: String,
  uploader: String,
  uploadedAt: { type: Date, default: Date.now },
});

const linkSchema = new mongoose.Schema({
  title: String,
  url: String,
  addedBy: String,
  addedAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const File = mongoose.model("File", fileSchema);
const Link = mongoose.model("Link", linkSchema);

// ----- FILE UPLOAD SETUP -----
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

// ----- AUTH MIDDLEWARE -----
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

// ----- ROUTES -----

app.get("/", (req, res) => res.redirect("/dashboard"));

app.get("/register", (req, res) => res.render("register"));
app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  await User.create({ email, password: hashed });
  res.redirect("/login");
});

app.get("/login", (req, res) => res.render("login"));
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.userId = user._id;
    req.session.email = user.email;
    res.redirect("/dashboard");
  } else {
    res.send("Invalid credentials");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/dashboard", requireLogin, async (req, res) => {
  const files = await File.find({});
  const links = await Link.find({});
  res.render("dashboard", { user: req.session.email, files, links });
});

app.post("/upload", requireLogin, upload.single("file"), async (req, res) => {
  await File.create({
    originalName: req.file.originalname,
    path: req.file.path,
    uploader: req.session.email,
  });
  res.redirect("/dashboard");
});

app.post("/add-link", requireLogin, async (req, res) => {
  const { title, url } = req.body;
  await Link.create({ title, url, addedBy: req.session.email });
  res.redirect("/dashboard");
});

app.get("/download/:id", requireLogin, async (req, res) => {
  const file = await File.findById(req.params.id);
  if (file) {
    res.download(path.resolve(file.path), file.originalName);
  } else {
    res.send("File not found");
  }
});

// ----- START SERVER -----
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
