import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import Replicate from 'replicate';
import { fileURLToPath } from 'url';
import axios from 'axios';

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

const refinedPrompts = {
  'royal': 'A majestic oil portrait of the same person wearing royal Renaissance clothing. Keep the original facial structure, expression, and pose. Use soft directional light, rich textures, and dark background.',
  'oil': 'An elegant oil painting of the same person in Renaissance style. Preserve the facial features, lighting, and expression. Apply painterly brush strokes, canvas texture, and warm tones.',
  'watercolor': 'A soft watercolor painting of the same person. Keep facial details and pose intact. Use flowing brush strokes, pastel colors, and gentle light washes.',
  'sketch': 'A pencil sketch of the same person with realistic proportions. Keep all facial features and structure. Add shading and crosshatching on a white background.',
  'minimal': 'A clean, minimalistic photo edit of the same person in Nordic style. Preserve all facial features and photo realism. Apply muted earthy tones, soft lighting, and desaturated color palette.'
};

// Upload image to ImgBB
async function uploadToImgBB(imagePath) {
  const apiKey = process.env.IMGBB_API_KEY;
  const imageData = fs.readFileSync(imagePath, { encoding: 'base64' });

  const payload = new URLSearchParams();
  payload.append('key', apiKey);
  payload.append('image', imageData);

  const response = await axios.post('https://api.imgbb.com/1/upload', payload.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  if (!response.data || !response.data.success) {
    console.error('ImgBB error response:', response.data);
    throw new Error('Failed to upload image to ImgBB');
  }

  return response.data.data.url;
}

app.post('/stylize', upload.single('image'), async (req, res) => {
  try {
    const style = req.body.style || 'oil';
    const imagePath = req.file.path;

    const prompt = refinedPrompts[style] || refinedPrompts['oil'];
    console.log(`Using prompt: ${prompt}`);

    const imageUrl = await uploadToImgBB(imagePath);
    console.log(`Uploaded image to: ${imageUrl}`);

    const output = await replicate.run("black-forest-labs/flux-kontext-pro", {
      input: {
        prompt,
        image_url: imageUrl
      }
    });

    console.log("Raw Replicate output:", output);

    let finalUrl;

    if (Array.isArray(output) && output.length > 0) {
      if (typeof output[0] === 'object' && output[0].image) {
        finalUrl = output[0].image;
      } else if (typeof output[0] === 'string') {
        finalUrl = output[0];
      }
    } else if (typeof output === 'object' && output.image) {
      finalUrl = output.image;
    } else if (typeof output === 'string') {
      finalUrl = output;
    }

    if (!finalUrl) {
      throw new Error('No image URL found in output');
    }

    fs.unlinkSync(imagePath);

    res.json({
      success: true,
      image_url: finalUrl,
      style,
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
