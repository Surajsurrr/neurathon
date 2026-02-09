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

// Normalize and validate social handles
function extractGithubUsername(input) {
  if (!input) return '';
  let v = input.trim();
  // If user pasted a full URL, extract the last path segment
  try {
    if (v.startsWith('http')) {
      const u = new URL(v);
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[0] || '';
    }
  } catch (e) {
    // ignore
  }
  // Remove leading @ if present
  v = v.replace(/^@+/, '');
  // Only allow simple username characters
  if (/^[a-zA-Z0-9-]+$/.test(v)) return v;
  return '';
}

function extractLinkedInId(input) {
  if (!input) return '';
  let v = input.trim();
  try {
    if (v.startsWith('http')) {
      const u = new URL(v);
      const parts = u.pathname.split('/').filter(Boolean);
      // LinkedIn profiles are usually under /in/ or /pub/
      if (parts[0] === 'in' || parts[0] === 'pub') return parts[1] || '';
      // fallback to first segment
      return parts[0] || '';
    }
  } catch (e) {
    // ignore
  }
  // If user provided the full handle like 'in/username' or just 'username'
  v = v.replace(/^in\//, '').replace(/^@+/, '');
  // Allow common linkedin id chars (letters, numbers, hyphen)
  if (/^[a-zA-Z0-9-]+$/.test(v)) return v;
  return '';
}

async function urlExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch (e) {
    return false;
  }
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
    // Normalize social handles and build full URLs (do not perform remote HEAD checks)
    try {
      const rawGh = payload.github || '';
      const gh = extractGithubUsername(rawGh);
      if (gh) {
        payload.github = gh;
        payload.githubUrl = `https://github.com/${gh}`;
      } else if (rawGh && rawGh.startsWith('http')) {
        // try to use provided URL (clean double prefixes)
        try {
          const u = new URL(rawGh);
          // remove trailing slash
          payload.github = '';
          payload.githubUrl = u.href.replace(/\/$/, '');
        } catch (e) {
          payload.github = '';
          payload.githubUrl = '';
        }
      } else {
        payload.github = '';
        payload.githubUrl = '';
      }

      const rawLi = payload.linkedin || '';
      const li = extractLinkedInId(rawLi);
      if (li) {
        payload.linkedin = li;
        payload.linkedinUrl = `https://www.linkedin.com/in/${li}`;
      } else if (rawLi && rawLi.startsWith('http')) {
        try {
          const u2 = new URL(rawLi);
          payload.linkedin = '';
          payload.linkedinUrl = u2.href.replace(/\/$/, '');
        } catch (e) {
          payload.linkedin = '';
          payload.linkedinUrl = '';
        }
      } else {
        payload.linkedin = '';
        payload.linkedinUrl = '';
      }
    } catch (e) {
      console.warn('Social normalization error:', e.message);
      payload.github = payload.github ? payload.github : '';
      payload.linkedin = payload.linkedin ? payload.linkedin : '';
      payload.githubUrl = payload.githubUrl || '';
      payload.linkedinUrl = payload.linkedinUrl || '';
    }
    // Provide fully-qualified URLs to templates to avoid double-prefix issues
    payload.githubUrl = payload.github ? `https://github.com/${payload.github}` : '';
    payload.linkedinUrl = payload.linkedin ? `https://www.linkedin.com/in/${payload.linkedin}` : '';
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
