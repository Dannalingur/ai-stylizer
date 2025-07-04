import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import Replicate from 'replicate';
import axios from 'axios';
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

// Upload image to ImgBB
async function uploadToImgBB(imagePath) {
  const imageData = fs.readFileSync(imagePath, { encoding: 'base64' });

  const response = await axios.post('https://api.imgbb.com/1/upload', null, {
    params: {
      key: process.env.IMGBB_API_KEY,
      image: imageData
    }
  });

  return response.data.data.url;
}

app.post('/stylize', upload.single('image'), async (req, res) => {
  const style = req.body.style || 'oil';
  const imagePath = req.file.path;

  const stylePrompts = {
    'royal': 'A majestic oil portrait of the same person wearing royal Renaissance clothing. Keep the original facial structure, expression, and pose. Use soft directional light, rich textures, and dark background.',
    'oil': 'A classical oil painting of the same person with realistic brush strokes and preserved likeness. Background should be rich and painterly.',
    'watercolor': 'A soft watercolor painting of the same person, retaining the facial features and pose. Gentle tones and flowing pigment.',
    'sketch': 'A precise pencil sketch of the same person. Capture details and facial structure realistically. White background.',
    'minimal': 'A clean, minimalistic portrait with soft Nordic tones. Preserve likeness and composition.'
  };

  const prompt = stylePrompts[style] || stylePrompts['oil'];

  try {
    const imageUrl = await uploadToImgBB(imagePath);
    console.log('✅ Uploaded to ImgBB:', imageUrl);

    const output = await replicate.run("black-forest-labs/flux-kontext-pro", {
      input: {
        prompt,
        image: imageUrl
      }
    });

    fs.unlinkSync(imagePath);

    if (typeof output === 'string') {
      res.json({
        success: true,
        image_url: output,
        style,
        message: 'Image stylized successfully'
      });
    } else {
      throw new Error('Unexpected output from Replicate');
    }
  } catch (err) {
    console.error('❌ Stylization error:', err.message);
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Failed to stylize image',
      error: err.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

