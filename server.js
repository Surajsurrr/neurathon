require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const Handlebars = require('handlebars');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const Profile = require('./models/Profile');
const sampleData = require('./sampleData');

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
const PORTFOLIOS_DIR = path.join(__dirname, 'public', 'portfolios');

// Ensure portfolios directory exists
fs.ensureDirSync(PORTFOLIOS_DIR);

// Serve static portfolios
app.use('/portfolios', express.static(PORTFOLIOS_DIR));

// Connect to MongoDB (optional for MVP)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-portfolio';
if (process.env.MONGODB_URI) {
  mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✓ Connected to MongoDB'))
    .catch(err => console.warn('MongoDB connection warning:', err.message));
} else {
  console.log('⚠ MongoDB disabled (set MONGODB_URI to enable persistence)');
}

// Register Handlebars helpers
Handlebars.registerHelper('split', function(str, delimiter) {
  if (!str) return [];
  return str.split(delimiter).map(s => s.trim()).filter(Boolean);
});

Handlebars.registerHelper('substring', function(str, start, length) {
  if (!str) return '';
  return str.substring(start, start + length);
});

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

    // Get template selection (default to 'simple')
    const selectedTemplate = payload.template || 'simple';
    const validTemplates = [
      'simple', 'simple-gradient', 'simple-dark',
      'modern', 'modern-glass', 'modern-cyber',
      'minimal', 'minimal-serif', 'minimal-mono',
      'creative', 'creative-bold', 'creative-neon'
    ];
    const templateName = validTemplates.includes(selectedTemplate) ? selectedTemplate : 'simple';

    const id = uuidv4();
    // Save basic profile to DB (non-blocking failure won't stop generation)
    try {
      const profileData = {
        name: payload.name,
        role: payload.role,
        bio: payload.bio,
        skills: Array.isArray(payload.skills) ? payload.skills : (payload.skills ? payload.skills.split(/[,;]\s*/) : []),
        projects: payload.projects || [],
        portfolioId: id
      };
      const profile = new Profile(profileData);
      await profile.save();
      console.log('Saved profile', profile._id.toString());
    } catch (e) {
      console.warn('Failed to save profile to DB:', e.message);
    }

    // Create portfolio directory
    const portfolioDir = path.join(PORTFOLIOS_DIR, id);

    // Render the selected template
    console.log(`Rendering template: ${templateName}`);
    console.log(`Portfolio directory: ${portfolioDir}`);
    await renderTemplate(templateName, payload, portfolioDir);
    console.log('Template rendered successfully');

    // Return the portfolio URL
    const portfolioUrl = `/portfolios/${id}/index.html`;
    console.log(`Portfolio created at: ${portfolioUrl}`);
    res.json({ 
      success: true, 
      portfolioId: id,
      portfolioUrl: portfolioUrl,
      shareUrl: `${req.protocol}://${req.get('host')}${portfolioUrl}`
    });

  } catch (err) {
    console.error('Generation error:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ error: 'Generation failed', details: err.message });
  }
});

// Preview endpoint - renders template with sample data
app.get('/api/preview/:templateId', async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const validTemplates = [
      'simple', 'simple-gradient', 'simple-dark',
      'modern', 'modern-glass', 'modern-cyber',
      'minimal', 'minimal-serif', 'minimal-mono',
      'creative', 'creative-bold', 'creative-neon'
    ];

    if (!validTemplates.includes(templateId)) {
      return res.status(400).send('Invalid template ID');
    }

    // Read template files
    const tplPath = path.join(TEMPLATES_DIR, templateId, 'index.hbs');
    const cssPath = path.join(TEMPLATES_DIR, templateId, 'style.css');
    
    const tplSrc = await fs.readFile(tplPath, 'utf8');
    const cssSrc = await fs.readFile(cssPath, 'utf8');
    
    // Compile and render with sample data
    const tpl = Handlebars.compile(tplSrc);
    const html = tpl(sampleData);
    
    // Inject CSS inline for preview
    const htmlWithStyle = html.replace('</head>', `<style>${cssSrc}</style></head>`);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlWithStyle);
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).send('Preview generation failed');
  }
});

app.get('/', (req, res) => {
  res.send('AI Portfolio Generator backend (MVP scaffold)');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
