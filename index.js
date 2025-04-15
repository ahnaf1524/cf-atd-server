import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// Middleware
app.use(cors());
app.use(express.json());

// -------------------- Mongoose Schemas --------------------
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

const problemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  link: { type: String, required: true },
  tags: { type: String, default: "" },
  sourceCode: { type: String, required: true },
  howSolved: { type: String, default: "" },
  rating: { type: Number, default: 0 },
});

const submissionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: String, required: true },
  solvedStatus: { type: String, enum: ["yes", "no"], required: true },
  problemCount: { type: Number, default: 0 },
  problems: [problemSchema],
  whyNot: { type: String, default: "" },
}, { timestamps: true });

const Submission = mongoose.model("Submission", submissionSchema);

// -------------------- Routes --------------------

// Root route
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>API Status</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f4f4f4;
          color: #333;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
        }
        .container {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
          text-align: center;
        }
        img {
          max-width: 120px;
          border-radius: 50%;
          margin-bottom: 1rem;
        }
        h1 {
          color: #2c3e50;
        }
        p {
          margin: 0.5rem 0;
        }
        .status {
          margin-top: 1rem;
          font-weight: bold;
          color: green;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <img src="https://thumbs.dreamstime.com/b/server-icon-vector-sign-symbol-isolated-white-background-logo-concept-your-web-mobile-app-design-134559389.jpg" alt="Server Logo" />
        <h1>💻 Competitive Programming Tracker API</h1>
        <div class="status">✅ Server is running successfully</div>
        <p style="margin-top: 1rem; font-size: 0.9rem;">Developed by Ahnaf Tahmid</p>
      </div>
    </body>
    </html>
  `);
});


// Register
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });

    await newUser.save();
    res.status(201).json({ message: "✅ User registered successfully" });

  } catch (err) {
    console.error("Register Error:", err.message);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });
    res.status(200).json({ message: "✅ Login successful", token });

  } catch (err) {
    console.error("Login Error:", err.message);
    res.status(500).json({ message: "Server error during login" });
  }
});

// Middleware for token verification
const auth = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ message: "Access denied. No token provided." });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(400).json({ message: "Invalid token" });
  }
};

// Get user profile
app.get("/api/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (err) {
    console.error("Profile Error:", err.message);
    res.status(500).json({ message: "Server error fetching profile" });
  }
});

// Submission route
app.post("/api/submit", async (req, res) => {
  try {
    const data = req.body;
    const { name, date, solvedStatus, problemCount, whyNot } = data;

    if (!name || !date || !solvedStatus) {
      return res.status(400).json({ message: "❌ Required fields are missing" });
    }

    const count = parseInt(problemCount) || 0;
    const problems = [];

    if (solvedStatus === "yes") {
      for (let i = 1; i <= count; i++) {
        problems.push({
          title: data[`problem_title_${i}`],
          link: data[`problem_link_${i}`],
          tags: data[`tags_${i}`],
          sourceCode: data[`source_code_${i}`],
          howSolved: data[`how_solved_${i}`],
          rating: data[`problem_rating_${i}`],
        });
      }
    }

    const submission = new Submission({
      name,
      date,
      solvedStatus,
      problemCount: count,
      whyNot: solvedStatus === "no" ? (whyNot || "") : "",
      problems,
    });

    await submission.save();
    res.status(201).json({ message: "✅ Submission stored successfully" });

  } catch (error) {
    console.error("❌ Error saving submission:", error.message);
    res.status(500).json({ message: "❌ Server error while saving submission" });
  }
});

// Get all submissions
app.get("/api/submissions", async (req, res) => {
  try {
    const submissions = await Submission.find();
    res.status(200).json(submissions);
  } catch (error) {
    console.error("❌ Error fetching submissions:", error.message);
    res.status(500).json({ message: "❌ Failed to fetch submissions" });
  }
});

// -------------------- Connect to MongoDB & Start Server --------------------
mongoose.connect(MONGO_URI).then(() => {
  console.log("✅ Connected to MongoDB");
  app.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("❌ MongoDB connection failed:", err.message);
});
