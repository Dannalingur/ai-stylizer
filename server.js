import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import Replicate from 'replicate';
import { fileURLToPath } from 'url';

config();

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Refined prompts for better output
const refinedPrompts = {
  'anime': 'A portrait of a person in anime style, maintaining original face and lighting. Big expressive eyes, soft shading, vibrant colors.',
  'cartoon': 'A cartoon-style portrait with bold outlines, exaggerated facial features, and flat colors. Preserve the original expression.',
  'oil-painting': 'A realistic oil painting of the person, in renaissance style. Maintain original facial structure and lighting.',
  'watercolor': 'A soft watercolor portrait with gentle brush strokes and flowing pastel colors. Maintain the subject’s pose and facial features.',
  'sketch': 'A pencil sketch portrait with realistic proportions and detailed shading. Do not alter facial expression.',
  'pop-art': 'A 1960s pop art portrait with comic-style halftone patterns, bold lines, and bright primary colors. Preserve pose and face.',
  'fantasy': 'A fantasy-themed portrait with glowing magical elements and a dreamy atmosphere. Maintain facial likeness and posture.',
  'cyberpunk': 'A cyberpunk-style portrait with neon colors, holographic effects, and futuristic city lights. Retain the subject’s features.',
  'vintage': 'A sepia-toned vintage portrait in early 20th century photographic style. Maintain natural expression and lighting.',
  'neon': 'A glowing neon-style portrait with electric colors and vibrant lighting effects. Keep facial details clear.',
  'animated': 'A stylized animated portrait with glowing lines and cartoonish features. Keep identity and pose intact.',
  'starry': 'A Van Gogh-inspired portrait in the style of Starry Night. Swirling brush strokes and vibrant blues and yellows.',
  'royal': 'A majestic oil painting of the person dressed in royal clothing. Renaissance portrait lighting and textures. Maintain facial identity.',
  'minimal': 'A minimalistic Nordic-style edit with soft light, clean background, and muted tones. Preserve photo realism.',
  'stone': 'A stone-textured transformation of the portrait. Dramatic lighting and chiseled effect, maintaining original structure.',
  'color_melt': 'A surreal portrait where colors melt and swirl artistically. Preserve subject’s face beneath distortion.',
  'oil': 'A highly detailed oil painting portrait in rich renaissance style. Keep original facial form and posture.',
  'celestial': 'A celestial-themed portrait with stars, galaxies, and glowing atmosphere. Maintain facial features clearly.'
};

app.post('/stylize', upload.single('image'), async (req, res) => {
  try {
    const style = req.body.style || 'anime';
    const imagePath = req.file.path;

    const imageData = fs.readFileSync(imagePath, { encoding: 'base64' });
    const base64 = `data:image/jpeg;base64,${imageData}`;

    const prompt = refinedPrompts[style] || refinedPrompts['anime'];

    console.log(`Processing image with style: ${style}`);
    console.log(`Using prompt: ${prompt}`);

    const output = await replicate.run("black-forest-labs/flux-dev", {
      input: {
        prompt,
        image: base64
      }
    });

    let imageUrl;

    if (Array.isArray(output) && output.length > 0) {
      const firstItem = output[0];
      if (firstItem && typeof firstItem.url === 'function') {
        imageUrl = firstItem.url();
        console.log('Extracted URL using .url() method:', imageUrl);
      } else if (typeof firstItem === 'string') {
        imageUrl = firstItem;
        console.log('Extracted direct URL string:', imageUrl);
      }
    }

    if (!imageUrl) {
      throw new Error(`No image URL found in output`);
    }

    fs.unlinkSync(imagePath);

    res.json({
      success: true,
      image_url: imageUrl,
      style: style,
      message: 'Image stylized successfully!'
    });

  } catch (error) {
    console.error('Stylization error:', error);

    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to stylize image'
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'AI Stylizer server is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

