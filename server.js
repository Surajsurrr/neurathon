require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const Handlebars = require('handlebars');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const multer = require('multer');
const Profile = require('./models/Profile');
const sampleData = require('./sampleData');

const app = express();
app.use(express.json({ limit: '1mb' }));

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and DOC/DOCX allowed'));
    }
  }
});

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
    // handle cases like: '...github.com/...', even when pasted twice
    if (v.includes('github.com')) {
      const last = v.lastIndexOf('github.com');
      const tail = v.slice(last + 'github.com'.length);
      const parts = tail.split('/').filter(Boolean);
      return parts[0] || '';
    }
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
    if (v.includes('linkedin.com')) {
      const last = v.lastIndexOf('linkedin.com');
      const tail = v.slice(last + 'linkedin.com'.length);
      const parts = tail.split('/').filter(Boolean);
      // handle /in/username or /pub/...
      if (parts[0] === 'in' || parts[0] === 'pub') return parts[1] || '';
      return parts[0] || '';
    }
    if (v.startsWith('http')) {
      const u = new URL(v);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'in' || parts[0] === 'pub') return parts[1] || '';
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

// Resume parsing endpoint
app.post('/api/parse-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    let extractedText = '';

    // Parse based on file type
    if (req.file.mimetype === 'application/pdf') {
      // PDF parsing using pdf-parse
      const dataBuffer = await fs.readFile(filePath);
      try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(dataBuffer);
        extractedText = (data && data.text) ? data.text : '';
      } catch (pdfErr) {
        console.error('pdf-parse failed:', pdfErr.message);
        // Fallback: basic text extraction from PDF buffer
        extractedText = dataBuffer.toString('utf8').replace(/[^\x20-\x7E\n\r]/g, ' ').replace(/\s+/g, ' ');
      }
    } else {
      // DOC/DOCX parsing
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      extractedText = result.value;
    }

    console.log('Extracted text length:', extractedText.length);
    console.log('First 200 chars:', extractedText.substring(0, 200));

    // Clean up uploaded file
    await fs.unlink(filePath).catch(() => {});

    // Extract information using AI or regex patterns
    const extractedData = await extractResumeData(extractedText);

    res.json({
      success: true,
      extractedData
    });
  } catch (error) {
    console.error('Resume parsing error:', error);
    // Clean up file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ 
      success: false, 
      error: 'Failed to parse resume. Please try again or enter details manually.' 
    });
  }
});

// AI-powered resume data extraction (improved accuracy)
async function extractResumeData(text) {
  const data = {
    name: '',
    role: '',
    bio: '',
    summary: '',
    email: '',
    phone: '',
    github: '',
    linkedin: '',
    skills: [],
    projects: []
  };

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // ─── Extract email ───
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) data.email = emailMatch[0];

  // ─── Extract phone ───
  const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) data.phone = phoneMatch[0];

  // ─── Extract LinkedIn ───
  const linkedinMatch = text.match(/linkedin\.com\/in\/([\w-]+)/i);
  if (linkedinMatch) data.linkedin = linkedinMatch[1];

  // ─── Extract GitHub ───
  const githubMatch = text.match(/github\.com\/([\w-]+)/i);
  if (githubMatch) data.github = githubMatch[1];

  // ─── Extract name (smarter: look for a proper name in first few lines) ───
  const sectionHeaders = /^(summary|about|profile|objective|experience|education|skills|projects|work|certif|contact|interests|hobbies|achievements|awards|languages|references)/i;
  for (const line of lines.slice(0, 8)) {
    const cleaned = line.replace(/[^\w\s.-]/g, '').trim();
    // A name is typically 2-4 words, title-case, no numbers, not a section header
    if (
      cleaned.length >= 3 &&
      cleaned.length <= 50 &&
      !sectionHeaders.test(cleaned) &&
      !/\d/.test(cleaned) &&
      !/@/.test(line) &&
      !/(http|www\.|\.com|\.org)/i.test(line) &&
      !/phone|email|address|linkedin|github/i.test(line) &&
      cleaned.split(/\s+/).length >= 2 &&
      cleaned.split(/\s+/).length <= 5
    ) {
      data.name = cleaned;
      break;
    }
  }
  // Fallback: first line cleaned
  if (!data.name && lines.length > 0) {
    data.name = lines[0].replace(/[^\w\s]/g, '').trim().slice(0, 50);
  }

  // ─── Extract role/title ───
  const roleKeywords = [
    'Developer', 'Engineer', 'Designer', 'Manager', 'Analyst', 'Architect',
    'Consultant', 'Intern', 'Scientist', 'Researcher', 'Administrator',
    'Lead', 'Director', 'Specialist', 'Coordinator', 'Programmer',
    'Full Stack', 'Frontend', 'Backend', 'DevOps', 'Data', 'Machine Learning',
    'AI', 'Software', 'Web', 'Mobile', 'Cloud', 'Security', 'QA', 'UI/UX'
  ];
  for (const line of lines.slice(0, 10)) {
    const lower = line.toLowerCase();
    // Skip section headers
    if (sectionHeaders.test(line)) continue;
    // Skip lines that are just a name or contact info
    if (line === data.name) continue;
    if (/@|phone|http|www\./i.test(line)) continue;
    
    for (const keyword of roleKeywords) {
      if (lower.includes(keyword.toLowerCase())) {
        // Clean the role line
        let role = line.replace(/[•\-|]/g, '').trim();
        if (role.length > 5 && role.length < 120) {
          data.role = role;
          break;
        }
      }
    }
    if (data.role) break;
  }

  // ─── Identify section boundaries ───
  const sectionPattern = /^(summary|about\s*me|about|profile|objective|professional\s*summary|career\s*summary|experience|work\s*experience|professional\s*experience|education|academic|skills|technical\s*skills|core\s*competencies|projects|personal\s*projects|certif|contact|interests|hobbies|achievements|awards|languages|references|publications)/i;
  
  function findSection(keywords) {
    for (let i = 0; i < lines.length; i++) {
      const clean = lines[i].replace(/[:\-•|#*_]/g, '').trim().toLowerCase();
      for (const kw of keywords) {
        if (clean === kw || clean.startsWith(kw + ' ') || clean.endsWith(' ' + kw)) {
          return i;
        }
      }
    }
    return -1;
  }

  function getSectionEnd(startIdx) {
    for (let i = startIdx + 1; i < lines.length; i++) {
      const clean = lines[i].replace(/[:\-•|#*_]/g, '').trim();
      if (sectionPattern.test(clean) && clean.length < 40) {
        return i;
      }
    }
    return Math.min(startIdx + 30, lines.length); // cap at 30 lines
  }

  function getSectionText(startIdx) {
    const endIdx = getSectionEnd(startIdx);
    return lines.slice(startIdx + 1, endIdx).join(' ').trim();
  }

  // ─── Extract summary/bio (much better: get full section) ───
  const summaryIdx = findSection(['summary', 'about me', 'about', 'profile', 'objective', 'professional summary', 'career summary', 'career objective']);
  if (summaryIdx !== -1) {
    const sectionText = getSectionText(summaryIdx);
    // Clean up and take meaningful content
    const cleaned = sectionText
      .replace(/\s+/g, ' ')
      .replace(/^[\s•\-:]+/, '')
      .trim();
    if (cleaned.length > 20) {
      data.summary = cleaned.slice(0, 500);
      data.bio = data.summary;
    }
  }
  // Fallback: if no summary section, try to find a paragraph-like block in first 15 lines
  if (!data.bio) {
    for (const line of lines.slice(1, 15)) {
      if (line.length > 80 && !sectionHeaders.test(line) && !/@/.test(line)) {
        data.bio = line.slice(0, 500);
        data.summary = data.bio;
        break;
      }
    }
  }

  // ─── Extract skills (word-boundary matching to prevent false positives) ───
  const skillsIdx = findSection(['skills', 'technical skills', 'core competencies', 'technologies', 'tech stack', 'tools']);
  let skillsText = '';
  if (skillsIdx !== -1) {
    const endIdx = getSectionEnd(skillsIdx);
    skillsText = lines.slice(skillsIdx, endIdx).join(' ');
  } else {
    skillsText = text; // fallback: scan entire text
  }

  // Skills with proper word-boundary matching
  const skillDefinitions = [
    // Programming Languages (use word boundaries to avoid false matches)
    { name: 'JavaScript', pattern: /\bjavascript\b/i },
    { name: 'TypeScript', pattern: /\btypescript\b/i },
    { name: 'Python', pattern: /\bpython\b/i },
    { name: 'Java', pattern: /\bjava\b(?!\s*script)/i },
    { name: 'C++', pattern: /\bc\+\+/i },
    { name: 'C#', pattern: /\bc#/i },
    { name: 'C', pattern: /\bc\b(?!\+|#|s|o)/i },  // avoid C++, C#, CSS, Co...
    { name: 'PHP', pattern: /\bphp\b/i },
    { name: 'Ruby', pattern: /\bruby\b/i },
    { name: 'Go', pattern: /\bgolang\b|\bgo\s*lang\b|\bgo\b(?=\s*[,;|•\n])/i }, // only match Go near delimiters
    { name: 'Rust', pattern: /\brust\b/i },
    { name: 'Swift', pattern: /\bswift\b/i },
    { name: 'Kotlin', pattern: /\bkotlin\b/i },
    { name: 'R', pattern: /\br\b(?=\s*[,;|•\n(]|\s+programming|\s+language|\s+studio)/i }, // only match R near delimiters or "R programming"
    { name: 'MATLAB', pattern: /\bmatlab\b/i },
    { name: 'Dart', pattern: /\bdart\b/i },
    { name: 'Scala', pattern: /\bscala\b/i },
    { name: 'Perl', pattern: /\bperl\b/i },
    { name: 'Haskell', pattern: /\bhaskell\b/i },
    
    // Frontend
    { name: 'React', pattern: /\breact(\.?js)?\b/i },
    { name: 'Angular', pattern: /\bangular(\.?js)?\b/i },
    { name: 'Vue.js', pattern: /\bvue(\.?js)?\b/i },
    { name: 'Next.js', pattern: /\bnext(\.?js)?\b/i },
    { name: 'Svelte', pattern: /\bsvelte\b/i },
    { name: 'HTML', pattern: /\bhtml5?\b/i },
    { name: 'CSS', pattern: /\bcss3?\b/i },
    { name: 'Tailwind CSS', pattern: /\btailwind\b/i },
    { name: 'Bootstrap', pattern: /\bbootstrap\b/i },
    { name: 'SASS', pattern: /\bsass\b|\bscss\b/i },
    { name: 'jQuery', pattern: /\bjquery\b/i },
    
    // Backend
    { name: 'Node.js', pattern: /\bnode(\.?js)?\b/i },
    { name: 'Express', pattern: /\bexpress(\.?js)?\b/i },
    { name: 'Django', pattern: /\bdjango\b/i },
    { name: 'Flask', pattern: /\bflask\b/i },
    { name: 'FastAPI', pattern: /\bfastapi\b/i },
    { name: 'Spring Boot', pattern: /\bspring\s*boot\b/i },
    { name: 'Spring', pattern: /\bspring\b(?!\s*boot)/i },
    { name: 'Laravel', pattern: /\blaravel\b/i },
    { name: 'ASP.NET', pattern: /\basp\.?net\b/i },
    { name: 'Ruby on Rails', pattern: /\brails\b|\bruby on rails\b/i },
    
    // Databases
    { name: 'MongoDB', pattern: /\bmongodb\b|\bmongo\b/i },
    { name: 'PostgreSQL', pattern: /\bpostgres(ql)?\b/i },
    { name: 'MySQL', pattern: /\bmysql\b/i },
    { name: 'SQLite', pattern: /\bsqlite\b/i },
    { name: 'SQL', pattern: /\bsql\b(?!ite)/i },
    { name: 'Redis', pattern: /\bredis\b/i },
    { name: 'Firebase', pattern: /\bfirebase\b/i },
    { name: 'Supabase', pattern: /\bsupabase\b/i },
    { name: 'DynamoDB', pattern: /\bdynamodb\b/i },
    { name: 'Cassandra', pattern: /\bcassandra\b/i },
    { name: 'Oracle', pattern: /\boracle\b/i },
    
    // Cloud & DevOps
    { name: 'AWS', pattern: /\baws\b/i },
    { name: 'Azure', pattern: /\bazure\b/i },
    { name: 'GCP', pattern: /\bgcp\b|\bgoogle cloud\b/i },
    { name: 'Docker', pattern: /\bdocker\b/i },
    { name: 'Kubernetes', pattern: /\bkubernetes\b|\bk8s\b/i },
    { name: 'Jenkins', pattern: /\bjenkins\b/i },
    { name: 'CI/CD', pattern: /\bci\/?cd\b/i },
    { name: 'Terraform', pattern: /\bterraform\b/i },
    { name: 'Ansible', pattern: /\bansible\b/i },
    { name: 'Nginx', pattern: /\bnginx\b/i },
    { name: 'Heroku', pattern: /\bheroku\b/i },
    { name: 'Vercel', pattern: /\bvercel\b/i },
    { name: 'Netlify', pattern: /\bnetlify\b/i },
    
    // Tools
    { name: 'Git', pattern: /\bgit\b(?!hub|lab)/i },
    { name: 'GitHub', pattern: /\bgithub\b/i },
    { name: 'GitLab', pattern: /\bgitlab\b/i },
    { name: 'Linux', pattern: /\blinux\b/i },
    { name: 'Figma', pattern: /\bfigma\b/i },
    { name: 'Photoshop', pattern: /\bphotoshop\b/i },
    { name: 'VS Code', pattern: /\bvs\s*code\b|\bvisual studio code\b/i },
    { name: 'Postman', pattern: /\bpostman\b/i },
    { name: 'JIRA', pattern: /\bjira\b/i },
    { name: 'Webpack', pattern: /\bwebpack\b/i },
    { name: 'Vite', pattern: /\bvite\b/i },
    
    // Data/AI/ML
    { name: 'Machine Learning', pattern: /\bmachine\s*learning\b/i },
    { name: 'Deep Learning', pattern: /\bdeep\s*learning\b/i },
    { name: 'TensorFlow', pattern: /\btensorflow\b/i },
    { name: 'PyTorch', pattern: /\bpytorch\b/i },
    { name: 'Scikit-Learn', pattern: /\bscikit\b|\bsklearn\b/i },
    { name: 'Pandas', pattern: /\bpandas\b/i },
    { name: 'NumPy', pattern: /\bnumpy\b/i },
    { name: 'Data Science', pattern: /\bdata\s*science\b/i },
    { name: 'NLP', pattern: /\bnlp\b|\bnatural language processing\b/i },
    { name: 'Computer Vision', pattern: /\bcomputer\s*vision\b/i },
    { name: 'OpenCV', pattern: /\bopencv\b/i },
    { name: 'Tableau', pattern: /\btableau\b/i },
    { name: 'Power BI', pattern: /\bpower\s*bi\b/i },
    { name: 'Excel', pattern: /\bexcel\b/i },
    
    // Mobile
    { name: 'Flutter', pattern: /\bflutter\b/i },
    { name: 'React Native', pattern: /\breact\s*native\b/i },
    { name: 'Android', pattern: /\bandroid\b/i },
    { name: 'iOS', pattern: /\bios\b/i },
    
    // Other
    { name: 'GraphQL', pattern: /\bgraphql\b/i },
    { name: 'REST API', pattern: /\brest\s*(ful)?\s*api\b|\brest\b/i },
    { name: 'WebSocket', pattern: /\bwebsocket\b/i },
    { name: 'Blockchain', pattern: /\bblockchain\b/i },
    { name: 'Solidity', pattern: /\bsolidity\b/i },
    { name: 'Web3', pattern: /\bweb3\b/i },
    { name: 'Agile', pattern: /\bagile\b/i },
    { name: 'Scrum', pattern: /\bscrum\b/i },
    { name: 'Three.js', pattern: /\bthree\.?js\b/i },
    { name: 'Socket.io', pattern: /\bsocket\.?io\b/i },
    { name: 'Mongoose', pattern: /\bmongoose\b/i },
    { name: 'Prisma', pattern: /\bprisma\b/i },
    { name: 'OAuth', pattern: /\boauth\b/i },
    { name: 'JWT', pattern: /\bjwt\b/i },
  ];

  // Match skills using regex patterns (much more accurate than .includes())
  const matchedSkills = new Set();
  for (const skill of skillDefinitions) {
    if (skill.pattern.test(skillsText)) {
      matchedSkills.add(skill.name);
    }
  }
  data.skills = [...matchedSkills];

  // If no skills found from patterns and we have a skills section, extract raw items
  if (data.skills.length === 0 && skillsIdx !== -1) {
    const endIdx = getSectionEnd(skillsIdx);
    const rawText = lines.slice(skillsIdx + 1, endIdx).join('\n');
    const rawSkills = rawText
      .split(/[,\n•|:;\/]/)
      .map(s => s.replace(/[^\w\s.#+\-]/g, '').trim())
      .filter(s => s.length > 1 && s.length < 35 && !/^\d+$/.test(s));
    data.skills = [...new Set(rawSkills)].slice(0, 20);
  }

  // ─── Extract projects (much smarter parsing) ───
  const projectIdx = findSection(['projects', 'personal projects', 'academic projects', 'key projects', 'notable projects', 'selected projects']);
  if (projectIdx !== -1) {
    const projectEnd = getSectionEnd(projectIdx);
    const projectLines = lines.slice(projectIdx + 1, projectEnd);
    
    let currentProject = null;
    const projects = [];

    for (const line of projectLines) {
      const stripped = line.replace(/[•\-\u2022\u2023\u25E6\u2043\u2219]/g, '').trim();
      if (!stripped) continue;

      // Detect project title: typically short, may have | or – or : separator, 
      // or is bold/caps, not starting with common description words
      const isLikelyTitle = (
        stripped.length < 80 &&
        !stripped.startsWith('Built') &&
        !stripped.startsWith('Developed') &&
        !stripped.startsWith('Created') &&
        !stripped.startsWith('Implemented') &&
        !stripped.startsWith('Designed') &&
        !stripped.startsWith('Used') &&
        !stripped.startsWith('Utilized') &&
        !stripped.startsWith('Leveraged') &&
        !stripped.startsWith('Integrated') &&
        !stripped.startsWith('Achieved') &&
        !stripped.startsWith('Reduced') &&
        !stripped.startsWith('Improved') &&
        !stripped.startsWith('Managed') &&
        !stripped.startsWith('Led') &&
        !stripped.startsWith('Collaborated') &&
        !stripped.startsWith('Conducted') &&
        !/^\d/.test(stripped) &&
        (
          // Has a separator like | or – suggesting "Title | Tech Stack"
          /[|–—]/.test(stripped) ||
          // Or is relatively short and doesn't start with lowercase
          (stripped.length < 60 && /^[A-Z]/.test(stripped) && !stripped.includes('. '))
        )
      );

      if (isLikelyTitle && stripped.length > 3) {
        // Save previous project
        if (currentProject && currentProject.title) {
          projects.push(currentProject);
        }
        // Parse title - split on | or – to separate title from tech stack
        const titleParts = stripped.split(/\s*[|–—]\s*/);
        currentProject = {
          title: titleParts[0].trim().slice(0, 100),
          description: '',
          link: ''
        };
        // If there's a tech mention after separator, include it
        if (titleParts.length > 1) {
          currentProject.description = titleParts.slice(1).join(' ').trim();
        }
      } else if (currentProject) {
        // This is a description line for the current project
        const linkMatch = stripped.match(/https?:\/\/[^\s)]+/);
        if (linkMatch) {
          currentProject.link = linkMatch[0];
        }
        // Append to description
        const descLine = stripped.replace(/https?:\/\/[^\s)]+/g, '').trim();
        if (descLine.length > 5) {
          currentProject.description += (currentProject.description ? '. ' : '') + descLine;
        }
      }
    }
    // Push the last project
    if (currentProject && currentProject.title) {
      projects.push(currentProject);
    }

    // Clean up descriptions and limit
    data.projects = projects.slice(0, 5).map(p => ({
      title: p.title,
      description: p.description.slice(0, 300),
      link: p.link
    }));
  }

  // Fallback: if no projects found at all, don't add fake ones
  if (data.projects.length === 0) {
    data.projects = [];
  }

  return data;
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
    console.log('Received payload.github:', payload.github);
    console.log('Received payload.linkedin:', payload.linkedin);
    
    try {
      const rawGh = payload.github || '';
      const gh = extractGithubUsername(rawGh);
      console.log('Extracted GitHub username:', gh);
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
      console.log('Final payload.githubUrl:', payload.githubUrl);

      const rawLi = payload.linkedin || '';
      const li = extractLinkedInId(rawLi);
      console.log('Extracted LinkedIn ID:', li);
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
      console.log('Final payload.linkedinUrl:', payload.linkedinUrl);
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
