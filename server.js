import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import FormData from 'form-data';
import Replicate from 'replicate';
import { fileURLToPath } from 'url';

config(); // Load .env

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

// Add CORS support for Shopify
app.use(cors());

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/stylize', upload.single('image'), async (req, res) => {
  try {
    const style = req.body.style || 'anime';
    const imagePath = req.file.path;
    const imageData = fs.readFileSync(imagePath, { encoding: 'base64' });
    const base64 = `data:image/jpeg;base64,${imageData}`;

    // Updated style prompts to match frontend dropdown
    const stylePrompts = {
      'anime': 'A beautiful anime-style portrait with vibrant colors and detailed features',
      'cartoon': 'A fun cartoon-style illustration with bold lines and bright colors',
      'oil-painting': 'A classical oil painting portrait in renaissance style with rich textures',
      'watercolor': 'A soft watercolor painting with flowing colors and artistic brush strokes',
      'sketch': 'A detailed pencil sketch with realistic shading and fine lines',
      'pop-art': 'A vibrant pop art style portrait with bold colors and comic book aesthetics',
      'fantasy': 'A magical fantasy art portrait with mystical elements and enchanting atmosphere',
      'cyberpunk': 'A futuristic cyberpunk portrait with neon lights and digital elements',
      'vintage': 'A classic vintage photograph with sepia tones and old-fashioned styling',
      'neon': 'A glowing neon-style portrait with electric colors and luminous effects',
      // Keep some of your original styles
      'animated': 'A vibrant animated portrait with glowing edges and neon lights',
      'starry': 'A dreamy portrait in the style of Van Gogh\'s Starry Night',
      'royal': 'A majestic royal oil painting of a person in regal clothing',
      'minimal': 'A minimalistic, Nordic-inspired photo edit with soft tones',
      'stone': 'A dramatic, stone-textured artistic transformation',
      'color_melt': 'A surreal, colorful melt of the original portrait',
      'oil': 'A highly detailed oil painting in renaissance style',
      'celestial': 'A portrait with glowing stars and a celestial aura'
    };

    const prompt = stylePrompts[style] || stylePrompts['anime'];

    console.log(`Processing image with style: ${style}`);
    console.log(`Using prompt: ${prompt}`);

    const output = await replicate.run("black-forest-labs/flux-dev", {
      input: {
        prompt,
        image: base64
      }
    });

    if (!output || !output[0]) {
      throw new Error("No output received from Replicate");
    }

    // Clean up uploaded file
    fs.unlinkSync(imagePath);

    // Return JSON response for Shopify integration
    res.json({
      success: true,
      image_url: output[0],
      style: style,
      message: 'Image stylized successfully!'
    });

  } catch (error) {
    console.error('Stylization error:', error);
    
    // Clean up uploaded file on error
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'AI Stylizer server is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
