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
  
  console.log('🚀 NEW REQUEST - Style:', style);
  
  if (!req.file) {
    console.log('❌ No file uploaded');
    return res.status(400).json({
      success: false,
      message: 'No image file uploaded'
    });
  }
  
  const imagePath = req.file.path;
  console.log('📁 Image uploaded to:', imagePath);
  console.log('📏 File size:', req.file.size, 'bytes');

  const stylePrompts = {
    'royal': 'A majestic oil portrait of the same person wearing royal Renaissance clothing. Keep the original facial structure, expression, and pose. Use soft directional light, rich textures, and dark background.',
    'oil': 'A classical oil painting of the same person with realistic brush strokes and preserved likeness. Background should be rich and painterly.',
    'watercolor': 'A soft watercolor painting of the same person, retaining the facial features and pose. Gentle tones and flowing pigment.',
    'sketch': 'A precise pencil sketch of the same person. Capture details and facial structure realistically. White background.',
    'minimal': 'A clean, minimalistic portrait with soft Nordic tones. Preserve likeness and composition.'
  };

  const prompt = stylePrompts[style] || stylePrompts['oil'];
  console.log('📝 Using prompt:', prompt);

  try {
    if (!process.env.IMGBB_API_KEY) {
      throw new Error('IMGBB_API_KEY not found in environment variables');
    }
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN not found in environment variables');
    }

    console.log('⬆️ Uploading to ImgBB...');
    const imageUrl = await uploadToImgBB(imagePath);
    console.log('✅ Uploaded to ImgBB:', imageUrl);

    console.log('🤖 Running Replicate model...');
    const output = await replicate.run("black-forest-labs/flux-kontext-pro", {
      input: {
        prompt,
        image: imageUrl
      }
    });

    console.log('🎯 Replicate output type:', typeof output);
    console.log('🎯 Replicate output:', output);

    fs.unlinkSync(imagePath);

    if (typeof output === 'string') {
      console.log('✅ Success - returning string URL');
      res.json({
        success: true,
        image_url: output,
        style,
        message: 'Image stylized successfully'
      });
    } else if (Array.isArray(output) && output.length > 0) {
      console.log('✅ Success - returning first array item');
      res.json({
        success: true,
        image_url: output[0],
        style,
        message: 'Image stylized successfully'
      });
    } else {
      throw new Error(`Unexpected output format: ${JSON.stringify(output)}`);
    }
  } catch (err) {
    console.error('❌ FULL ERROR DETAILS:');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
    }
    
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to stylize image',
      error: err.message,
      details: err.response?.data || 'No additional details available'
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
});
