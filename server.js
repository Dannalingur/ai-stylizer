import express from 'express';
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

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/stylize', upload.single('image'), async (req, res) => {
  const style = req.body.style;
  const imagePath = req.file.path;
  const imageData = fs.readFileSync(imagePath, { encoding: 'base64' });
  const base64 = `data:image/jpeg;base64,${imageData}`;

  const stylePrompts = {
    animated: "A vibrant animated portrait with glowing edges and neon lights",
    starry: "A dreamy portrait in the style of Van Gogh's Starry Night",
    royal: "A majestic royal oil painting of a person in regal clothing",
    minimal: "A minimalistic, Nordic-inspired photo edit with soft tones",
    stone: "A dramatic, stone-textured artistic transformation",
    color_melt: "A surreal, colorful melt of the original portrait",
    oil: "A highly detailed oil painting in renaissance style",
    celestial: "A portrait with glowing stars and a celestial aura"
  };

  const prompt = stylePrompts[style] || "A beautiful stylized portrait";

  try {
    const output = await replicate.run("black-forest-labs/flux-dev", {
      input: {
        prompt,
        image: base64
      }
    });

    if (!output || !output[0]) {
      throw new Error("No output received");
    }

    res.send(`
      <h2>Stylization Complete!</h2>
      <img src="${output[0]}" style="max-width: 600px;"/>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});

