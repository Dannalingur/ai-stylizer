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

// Refined and restricted style prompts
const refinedPrompts = {
  'royal': 'A majestic oil portrait of the same person wearing royal Renaissance clothing. Keep the original facial structure, expression, and pose. Use soft directional light, rich textures, and dark background.',
  'oil': 'An elegant oil painting of the same person in Renaissance style. Preserve the facial features, lighting, and expression. Apply painterly brush strokes, canvas texture, and warm tones.',
  'watercolor': 'A soft watercolor painting of the same person. Keep facial details and pose intact. Use flowing brush strokes, pastel colors, and gentle light washes.',
  'sketch': 'A pencil sketch of the same person with realistic proportions. Keep all facial features and structure. Add shading and crosshatching on a white background.',
  'minimal': 'A clean, minimalistic photo edit of the same person in Nordic style. Preserve all facial features and photo realism. Apply muted earthy tones, soft lighting, and desaturated color palette.'
};

app.post('/stylize', upload.single('image'), async (req, res) => {
  try {
    const style = req.body.style || 'oil';
    const imagePath = req.file.path;

    const imageData = fs.readFileSync(imagePath, { encoding: 'base64' });
    const base64 = `data:image/jpeg;base64,${imageData}`;

    const prompt = refinedPrompts[style] || refinedPrompts['oil'];

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

