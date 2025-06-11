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

// Upscale function using Replicate Real-ESRGAN
async function upscaleImage(imageUrl) {
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      version: "9282c7318a7e34f732e01d02b9c50e4debb28cfa939397b5c0c3b2d3b2e6fb7c",
      input: { image: imageUrl }
    })
  });

  const prediction = await response.json();
  const statusUrl = prediction.urls.get;

  // Poll until finished
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

  if (error.response && typeof error.response.json === "function") {
    error.response.json().then((json) => {
      console.error("🔍 OpenAI response error:", json);
    });
  }

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
app.listen(PORT, () => console.log(`✅ Vision Build backend with upscaling running on port ${PORT}`));
