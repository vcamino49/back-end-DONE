const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fetch = require("node-fetch");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function upscaleImage(imageUrl) {
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "version": "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
      input: { image: imageUrl }
    })
  });

  const prediction = await response.json();
  console.log("🐛 Raw Replicate response:", JSON.stringify(prediction, null, 2));

  if (!prediction.urls || !prediction.urls.get) {
    throw new Error("Replicate prediction failed or is invalid.");
  }

  const statusUrl = prediction.urls.get;

  let output;
  for (let i = 0; i < 10; i++) {
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` }
    });
    const statusData = await statusRes.json();
    if (statusData.status === "succeeded") {
      output = statusData.output;
      break;
    } else if (statusData.status === "failed") {
      throw new Error("Upscaling failed");
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  return output;
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
app.listen(PORT, () => console.log(`✅ Vision Build backend (fetch) running on port ${PORT}`));
