const express = require('express');
const fs = require('fs');
const path = require('path');

// Auto-load .env file if it exists locally or was created by the web panel
const ENV_PATH = path.join(__dirname, '.env');
if (fs.existsSync(ENV_PATH)) {
  require('dotenv').config({ path: ENV_PATH });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Web Healthcheck Endpoint
app.get('/health', (req, res) => {
  res.status(200).send('Bot web process is operational.');
});

// Secure API endpoint to update and save the Discord Bot Token permanently
app.post('/api/update-token', (req, res) => {
  const { adminKey, newToken } = req.body;

  const currentAdminKey = process.env.WEB_ADMIN_KEY || 'admin123';

  if (adminKey !== currentAdminKey) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid Admin Key' });
  }

  if (!newToken || !newToken.trim()) {
    return res.status(400).json({ success: false, message: 'Invalid Token provided.' });
  }

  try {
    const cleanToken = newToken.trim();
    process.env.DISCORD_TOKEN = cleanToken;

    // Write directly into the local .env file on the server storage
    const envContent = `PORT=${PORT}\nWEB_ADMIN_KEY=${currentAdminKey}\nDISCORD_TOKEN=${cleanToken}\n`;
    fs.writeFileSync(ENV_PATH, envContent, 'utf8');

    return res.json({ 
      success: true, 
      message: 'Token saved successfully! Restarting bot connection...' 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[WEB SERVER] Listening on port ${PORT}`);
  
  // Start the Discord Bot main loop
  require('./bot.js');
});
