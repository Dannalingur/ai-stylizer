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
    
    // Read and validate image
    console.log('Processing image:', {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: imagePath
    });

    // Validate file exists and has content
    if (!fs.existsSync(imagePath)) {
      throw new Error('Uploaded file not found');
    }

    const stats = fs.statSync(imagePath);
    if (stats.size === 0) {
      throw new Error('Uploaded file is empty');
    }

    // Read image data
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Data = imageBuffer.toString('base64');
    
    // Determine MIME type
    let mimeType = req.file.mimetype;
    if (!mimeType) {
      const ext = path.extname(req.file.originalname || '').toLowerCase();
      mimeType = ext === '.png' ? 'image/png' : 
                 ext === '.gif' ? 'image/gif' : 
                 'image/jpeg'; // default to jpeg
    }
    
    // Create proper data URL
    const base64 = `data:${mimeType};base64,${base64Data}`;
    
    console.log('Image prepared:', {
      mimeType,
      base64Length: base64Data.length,
      base64Preview: base64.substring(0, 50) + '...'
    });

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

    // 🔧 FIXED: Proper Replicate call and response handling
    console.log('Starting Replicate generation...');
    
    const output = await replicate.run("black-forest-labs/flux-dev", {
      input: {
        prompt,
        image: base64
      }
    });

    console.log('=== REPLICATE RESPONSE DEBUG ===');
    console.log('Output type:', typeof output);
    console.log('Is array:', Array.isArray(output));
    console.log('Array length:', Array.isArray(output) ? output.length : 'N/A');
    console.log('Full output:', JSON.stringify(output, null, 2));
    console.log('=== END DEBUG ===');

    // 🔧 FIXED: Simple URL extraction based on Replicate's actual response format
    let imageUrl;
    
    if (Array.isArray(output) && output.length > 0) {
      // Most common case: array of URLs like ["https://replicate.delivery/..."]
      const firstItem = output[0];
      if (typeof firstItem === 'string' && firstItem.startsWith('http')) {
        imageUrl = firstItem;
      } else if (firstItem && typeof firstItem === 'object' && firstItem.url) {
        imageUrl = firstItem.url;
      }
    } else if (typeof output === 'string' && output.startsWith('http')) {
      // Direct URL string
      imageUrl = output;
    } else if (output && typeof output === 'object' && output.url) {
      // Object with URL property
      imageUrl = output.url;
    }

    console.log('Extracted image URL:', imageUrl);

    // Validate the extracted URL
    if (!imageUrl) {
      throw new Error(`No valid image URL found in response. Full response: ${JSON.stringify(output)}`);
    }

    if (typeof imageUrl !== 'string') {
      throw new Error(`Image URL is not a string: ${typeof imageUrl}. Value: ${JSON.stringify(imageUrl)}`);
    }

    if (!imageUrl.startsWith('http')) {
      throw new Error(`Invalid image URL format: ${imageUrl}`);
    }

    // Clean up uploaded file
    fs.unlinkSync(imagePath);

    // Return JSON response for Shopify integration
    res.json({
      success: true,
      image_url: imageUrl,
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

// 🔧 DEBUG ENDPOINT: Add this temporarily to test the response format
app.post('/debug-stylize', upload.single('image'), async (req, res) => {
  try {
    const style = req.body.style || 'anime';
    const imagePath = req.file.path;
    const imageData = fs.readFileSync(imagePath, { encoding: 'base64' });
    const base64 = `data:image/jpeg;base64,${imageData}`;

    const prompt = 'A beautiful anime-style portrait with vibrant colors and detailed features';

    console.log('DEBUG: Making Replicate call...');
    
    const output = await replicate.run("black-forest-labs/flux-dev", {
      input: {
        prompt,
        image: base64
      }
    });

    // Clean up
    fs.unlinkSync(imagePath);

    // Return the RAW response for debugging
    res.json({
      debug: true,
      raw_output: output,
      output_type: typeof output,
      is_array: Array.isArray(output),
      array_length: Array.isArray(output) ? output.length : null,
      first_item: Array.isArray(output) && output.length > 0 ? output[0] : null,
      first_item_type: Array.isArray(output) && output.length > 0 ? typeof output[0] : null,
      object_keys: typeof output === 'object' && !Array.isArray(output) ? Object.keys(output) : null
    });

  } catch (error) {
    console.error('Debug error:', error);
    
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    res.status(500).json({
      debug: true,
      error: error.message
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
