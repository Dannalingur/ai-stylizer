import { config } from 'dotenv';
import Replicate from 'replicate';
import axios from 'axios';

config();

async function testAPIs() {
  console.log('🔑 Testing API keys...');
  
  console.log('REPLICATE_API_TOKEN exists:', !!process.env.REPLICATE_API_TOKEN);
  console.log('IMGBB_API_KEY exists:', !!process.env.IMGBB_API_KEY);
  
  try {
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });
    
    console.log('🤖 Testing Replicate connection...');
    const models = await replicate.models.list();
    console.log('✅ Replicate API is working');
  } catch (error) {
    console.error('❌ Replicate API error:', error.message);
  }
  
  try {
    console.log('📷 Testing ImgBB connection...');
    const response = await axios.get('https://api.imgbb.com/1/upload', {
      params: {
        key: process.env.IMGBB_API_KEY
      }
    });
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ ImgBB API key is valid (got expected 400 for missing image)');
    } else {
      console.error('❌ ImgBB API error:', error.message);
    }
  }
}

testAPIs();
