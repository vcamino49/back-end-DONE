import express from "express";
import cors from "cors";
import multer from "multer";
import Replicate from "replicate";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function upscaleImage(imageUrl) {
  try {
    const output = await replicate.run(
      "nightmareai/real-esrgan",
      {
        input: { image: imageUrl }
      }
    );
    return output;
  } catch (err) {
    console.error("🛑 Replicate SDK error:", err);
    throw new Error("Upscaling failed using Replicate SDK.");
  }
}

app.post("/api/generate", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  try {
    const aiResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024"
    });

    const originalUrl = aiResponse.data[0].url;
    const highResUrl = await upscaleImage(originalUrl);

    res.json({
      text: `Generated high-res image for: "${prompt}"`,
      image_url: highResUrl
    });
  } catch (error) {
    console.error("Image generation or upscaling failed:", error);
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
app.listen(PORT, () => console.log(`✅ Vision Build SDK backend running on port ${PORT}`));