
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function formatPrompt(prompt, mode) {
  if (mode === "stylized") {
    return `Concept art, cinematic lighting, dynamic composition, trending on ArtStation, digital painting of ${prompt}`;
  } else {
    return `An ultra-realistic DSLR photo, sharp detail, high dynamic range, natural lighting, 35mm lens, of ${prompt}. Shot on Canon EOS R5, f/2.8, ISO 100, photorealistic.`;
  }
}

app.post("/api/generate", async (req, res) => {
  const { prompt, history, mode = "realistic" } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  const basePrompt = history
    ? history + "\nFollow-up: " + prompt
    : prompt;

  const finalPrompt = formatPrompt(basePrompt, mode);

  try {
    const aiResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      n: 1,
      size: "1024x1024"
    });

    const imageUrl = aiResponse.data[0].url;

    res.json({
      text: `Generated ${mode} image for: "${prompt}"`,
      image_url: imageUrl
    });
  } catch (error) {
    console.error("Image generation failed:", error);
    res.status(500).json({ error: "Image generation failed" });
  }
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const imageUrl = `${req.protocol}://${req.get("host")}/${req.file.filename}`;
  res.json({ imageUrl });
});

app.get("/health", (req, res) => res.send("Server is healthy"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Vision Builder backend with rendering modes running on port ${PORT}`));
