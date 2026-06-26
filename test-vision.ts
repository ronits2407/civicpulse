import fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  // Let's use the local file but mock the URL fetch
  const localFile = "C:\\Users\\RONIT\\Downloads\\istockphoto-171276431-612x612.jpg";
  const imageData = fs.readFileSync(localFile);
  const base64Image = Buffer.from(imageData).toString('base64');
  console.log('Base64 starts with:', base64Image.substring(0, 50));
}

main();
