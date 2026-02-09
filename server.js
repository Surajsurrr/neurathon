require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const Handlebars = require('handlebars');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const Profile = require('./models/Profile');

const app = express();
app.use(express.json({ limit: '1mb' }));

// Enable CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const TEMPLATES_DIR = path.join(__dirname, 'templates');
const TMP_DIR = path.join(__dirname, 'tmp');

// Connect to MongoDB (optional for MVP)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-portfolio';
if (process.env.MONGODB_URI) {
  mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✓ Connected to MongoDB'))
    .catch(err => console.warn('MongoDB connection warning:', err.message));
} else {
  console.log('⚠ MongoDB disabled (set MONGODB_URI to enable persistence)');
}

async function renderTemplate(templateName, data, outDir) {
  const tplPath = path.join(TEMPLATES_DIR, templateName, 'index.hbs');
  const cssPath = path.join(TEMPLATES_DIR, templateName, 'style.css');
  const tplSrc = await fs.readFile(tplPath, 'utf8');
  const cssSrc = await fs.readFile(cssPath, 'utf8');
  const tpl = Handlebars.compile(tplSrc);
  const html = tpl(data);
  await fs.ensureDir(outDir);
  await fs.writeFile(path.join(outDir, 'index.html'), html, 'utf8');
  await fs.writeFile(path.join(outDir, 'style.css'), cssSrc, 'utf8');
}

app.post('/api/generate', async (req, res) => {
  try {
    const payload = req.body;
    // Basic validation
    if (!payload.name || !payload.projects) {
      return res.status(400).json({ error: 'Missing required fields: name, projects' });
    }

    const id = uuidv4();
    // Save basic profile to DB (non-blocking failure won't stop generation)
    try {
      const profileData = {
        name: payload.name,
        role: payload.role,
        bio: payload.bio,
        skills: Array.isArray(payload.skills) ? payload.skills : (payload.skills ? payload.skills.split(/[,;]\s*/) : []),
        projects: payload.projects || []
      };
      const profile = new Profile(profileData);
      await profile.save();
      console.log('Saved profile', profile._id.toString());
    } catch (e) {
      console.warn('Failed to save profile to DB:', e.message);
    }
    const workDir = path.join(TMP_DIR, id);

    // For MVP we render a simple template synchronously
    await renderTemplate('simple', payload, workDir);

    // Stream a zip of the generated site back to the client
    res.setHeader('Content-Disposition', `attachment; filename="portfolio-${id}.zip"`);
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => { throw err; });

    archive.pipe(res);
    archive.directory(workDir, false);
    await archive.finalize();

    // cleanup after response finished
    res.on('finish', async () => {
      try { await fs.remove(workDir); } catch (e) { /* ignore */ }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Generation failed', details: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('AI Portfolio Generator backend (MVP scaffold)');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
