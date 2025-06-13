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

// Simulate ChatGPT-style prompt modifiers
function formatPrompt(userPrompt) {
  return `A high-resolution ultra-realistic DSLR photograph, natural lighting, 35mm lens, shallow depth of field, studio-quality composition, richly detailed, sharp textures, dynamic range, of ${userPrompt}`;
}

app.post("/api/generate", async (req, res) => {
  const { prompt, history } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  // Combine previous context if available
  const basePrompt = history
    ? history + "\nFollow-up: " + prompt
    : prompt;

  const finalPrompt = formatPrompt(basePrompt);

  try {
    const aiResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      n: 1,
      size: "1024x1024"
    });

    const imageUrl = aiResponse.data[0].url;

    res.json({
      text: `Generated image for: "${prompt}"`,
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
app.listen(PORT, () => console.log(`✅ Vision Builder backend (ChatGPT-style prompts) running on port ${PORT}`));