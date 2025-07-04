import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import Replicate from 'replicate';
import { v2 as cloudinary } from 'cloudinary';
import { fileURLToPath } from 'url';

config();

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
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

// Upload image to Cloudinary
async function uploadToCloudinary(imagePath) {
  try {
    console.log('📁 Uploading to Cloudinary:', imagePath);
    
    const result = await cloudinary.uploader.upload(imagePath, {
      folder: 'face-to-many-transformer',
      resource_type: 'image',
      transformation: [
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    });

    console.log('✅ Cloudinary upload successful:', result.secure_url);
    return result.secure_url;
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error.message);
    throw error;
  }
}

// Valid styles and personas from the actual model
const VALID_STYLES = [
  'Anime', 'Cartoon', 'Clay', 'Gothic', 'Graphic Novel', 'Lego', 
  'Memoji', 'Minecraft', 'Minimalist', 'Pixel Art', 'Random', 
  'Simpsons', 'Sketch', 'South Park', 'Toy', 'Watercolor'
];

const VALID_PERSONAS = [
  'Angel', 'Astronaut', 'Demon', 'Mage', 'Ninja', "Na'vi", 
  'None', 'Random', 'Robot', 'Samurai', 'Vampire', 'Werewolf', 'Zombie'
];

app.post('/transform', upload.single('image'), async (req, res) => {
  console.log('🎭 Starting Face-to-Many character transformation');
  
  if (!req.file) {
    console.log('❌ No file uploaded');
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const style = req.body.style || 'Random';
  const persona = req.body.persona || 'None';
  // Always use optimal settings for best results
  const preserveBackground = true;
  const preserveOutfit = true;
  const numImages = 1;
  const imagePath = req.file.path;

  console.log('📷 Processing image:', imagePath);
  console.log('🎨 Style:', style);
  console.log('👤 Persona:', persona);
  console.log('⚙️ Using optimal settings: preserve_background=true, preserve_outfit=true, num_images=1');
  console.log('📁 File size:', fs.statSync(imagePath).size, 'bytes');

  // Validate inputs
  if (!VALID_STYLES.includes(style)) {
    return res.status(400).json({ 
      success: false, 
      message: `Invalid style. Must be one of: ${VALID_STYLES.join(', ')}` 
    });
  }

  if (!VALID_PERSONAS.includes(persona)) {
    return res.status(400).json({ 
      success: false, 
      message: `Invalid persona. Must be one of: ${VALID_PERSONAS.join(', ')}` 
    });
  }

  try {
    console.log('🔄 Step 1: Uploading to Cloudinary...');
    const imageUrl = await uploadToCloudinary(imagePath);
    console.log('✅ Step 1 Complete - Image URL:', imageUrl);

    console.log('🔄 Step 2: Using FLUX Face-to-Many Kontext specialized app...');
    
    const modelInputs = {
      input_image: imageUrl,
      style: style,
      persona: persona,
      num_images: numImages,
      preserve_background: preserveBackground,
      preserve_outfit: preserveOutfit
    };
    
    console.log('📋 Model inputs:', modelInputs);
    
    const output = await replicate.run("flux-kontext-apps/face-to-many-kontext", {
      input: modelInputs
    });

    const modelUsed = `FLUX Face-to-Many Kontext (${style} ${persona})`;
    
    console.log('✅ Step 2 Complete - Model used:', modelUsed);
    console.log('✅ Output type:', typeof output);
    console.log('✅ Output:', output);

    // Clean up uploaded file
    fs.unlinkSync(imagePath);

    // Handle different output formats
    let finalImageUrl;
    if (typeof output === 'string') {
      finalImageUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      finalImageUrl = output[0];
    } else {
      throw new Error('Unexpected output format: ' + JSON.stringify(output));
    }

    res.json({
      success: true,
      image_url: finalImageUrl,
      style: style,
      persona: persona,
      model_used: modelUsed,
      message: `Successfully transformed into ${style} ${persona} with optimal preservation settings!`
    });

  } catch (err) {
    console.error('❌ FULL ERROR DETAILS:');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
    }
    
    // Clean up uploaded file
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('❌ Error cleaning up file:', unlinkErr.message);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to transform character',
      error: err.message,
      style: style,
      persona: persona
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Face-to-Many Character Transformer is running',
    model: 'flux-kontext-apps/face-to-many-kontext'
  });
});

// API info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    service: 'Face-to-Many Character Transformer',
    model: 'flux-kontext-apps/face-to-many-kontext',
    description: 'Transform into any character while preserving your identity',
    valid_styles: VALID_STYLES,
    valid_personas: VALID_PERSONAS,
    endpoints: {
      'POST /transform': 'Transform uploaded image with style and persona',
      'GET /health': 'Service health check',
      'GET /api/info': 'API information'
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎭 Face-to-Many Character Transformer running on port ${PORT}`);
  console.log(`🌐 Access at: http://localhost:${PORT}`);
  console.log('🔑 Replicate API token:', process.env.REPLICATE_API_TOKEN ? 'Present' : 'Missing');
  console.log('☁️ Cloudinary config:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'Present' : 'Missing',
    api_key: process.env.CLOUDINARY_API_KEY ? 'Present' : 'Missing',
    api_secret: process.env.CLOUDINARY_API_SECRET ? 'Present' : 'Missing'
  });
  console.log('📁 Upload directory exists:', fs.existsSync('uploads'));
  console.log('');
  console.log('🌟 FLUX Face-to-Many Kontext Features:');
  console.log('   ✨ Perfect identity preservation');
  console.log('   🎨 16 different styles:', VALID_STYLES.join(', '));
  console.log('   👤 13 personas:', VALID_PERSONAS.join(', '));
  console.log('   ⚙️ Optimal settings: Background & outfit preservation enabled');
  console.log('   🚀 Fast processing with specialized AI');
  console.log('');
  console.log('🔗 Endpoints:');
  console.log('   POST /transform - Transform photo with style and persona');
  console.log('   GET /health - Health check');
  console.log('   GET /api/info - API information');
});
