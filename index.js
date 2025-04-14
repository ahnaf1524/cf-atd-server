import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Middleware
app.use(cors());
app.use(express.json());

// Mongoose Schema
const problemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  link: { type: String, required: true },
  tags: { type: String, default: "" },
  sourceCode: { type: String, required: true },
  howSolved: { type: String, default: "" },
  rating: { type: Number, default: 0 }, // Add problem rating
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

// Routes
app.get("/", (req, res) => {
  res.send(`<h1 style="font-family: Arial;">Server is running!</h1>`);
});

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
          rating: data[`problem_rating_${i}`],  // Store problem rating
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

app.get("/api/submissions", async (req, res) => {
  try {
    const submissions = await Submission.find();
    res.status(200).json(submissions);
  } catch (error) {
    console.error("❌ Error fetching submissions:", error.message);
    res.status(500).json({ message: "❌ Failed to fetch submissions" });
  }
});

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("✅ Connected to MongoDB");
  app.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("❌ MongoDB connection failed:", err.message);
});
