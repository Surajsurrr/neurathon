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

// Clone portfolio endpoint - clones the DESIGN/TEMPLATE of a portfolio URL
app.post('/api/clone-portfolio', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Please provide a portfolio URL' });
    }

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Invalid protocol');
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Please enter a valid URL (https://...)' });
    }

    console.log('Cloning portfolio design from:', url);

    // Fetch the webpage
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let html;
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      html = await response.text();
    } catch (fetchErr) {
      clearTimeout(timeout);
      console.error('Fetch error:', fetchErr.message);
      return res.status(400).json({
        success: false,
        error: fetchErr.name === 'AbortError'
          ? 'Request timed out. The website took too long to respond.'
          : `Could not fetch the website: ${fetchErr.message}`
      });
    }

    console.log('Fetched HTML length:', html.length);

    // ─── Fetch external CSS and inline it ───
    let allCSS = '';
    // Extract <link rel="stylesheet"> hrefs
    const cssLinkPattern = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
    const cssLinkPattern2 = /<link[^>]*href=["']([^"']+\.css[^"']*)["'][^>]*>/gi;
    const cssUrls = new Set();
    let cssMatch;
    while ((cssMatch = cssLinkPattern.exec(html)) !== null) cssUrls.add(cssMatch[1]);
    while ((cssMatch = cssLinkPattern2.exec(html)) !== null) cssUrls.add(cssMatch[1]);

    for (const cssHref of cssUrls) {
      try {
        const cssUrl = cssHref.startsWith('http') ? cssHref
          : cssHref.startsWith('//') ? 'https:' + cssHref
          : new URL(cssHref, parsedUrl.origin).href;
        const cssResp = await fetch(cssUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000)
        });
        if (cssResp.ok) {
          allCSS += '\n/* Cloned from: ' + cssUrl + ' */\n';
          allCSS += await cssResp.text();
        }
      } catch (e) {
        console.log('Could not fetch CSS:', cssHref, e.message);
      }
    }

    // Also extract inline <style> blocks
    const inlineStylePattern = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let styleMatch;
    while ((styleMatch = inlineStylePattern.exec(html)) !== null) {
      allCSS += '\n/* Inline style */\n' + styleMatch[1];
    }

    console.log('Total CSS collected:', allCSS.length, 'chars');

    // ─── Convert the HTML into a reusable Handlebars template ───
    const { template: hbsTemplate, detectedSections } = convertHTMLToTemplate(html, parsedUrl.origin);

    // ─── Save as a cloned template ───
    const cloneId = 'cloned-' + uuidv4().slice(0, 8);
    const cloneDir = path.join(TEMPLATES_DIR, cloneId);
    await fs.ensureDir(cloneDir);

    // Fix relative URLs in CSS (images, fonts)
    let fixedCSS = allCSS.replace(/url\(['"]?(?!data:|https?:|\/\/)(\/?)([^'")]+)['"]?\)/gi, (match, slash, urlPath) => {
      const fullUrl = new URL((slash ? '/' : '') + urlPath, parsedUrl.origin).href;
      return `url('${fullUrl}')`;
    });

    await fs.writeFile(path.join(cloneDir, 'index.hbs'), hbsTemplate, 'utf8');
    await fs.writeFile(path.join(cloneDir, 'style.css'), fixedCSS, 'utf8');

    console.log('Cloned template saved as:', cloneId);
    console.log('Detected sections:', detectedSections);

    res.json({
      success: true,
      clonedTemplateId: cloneId,
      sourceUrl: url,
      detectedSections
    });
  } catch (error) {
    console.error('Clone error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clone portfolio design. Please check the URL and try again.'
    });
  }
});

// ─── Convert scraped HTML into a Handlebars template ───
function convertHTMLToTemplate(html, origin) {
  let tpl = html;
  const detected = { name: false, role: false, bio: false, skills: false, projects: false, email: false, social: false };

  // 1. Remove <script> tags (we don't need JS)
  tpl = tpl.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // 2. Remove existing <link rel="stylesheet"> and <style> (we'll use our collected CSS)
  tpl = tpl.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '');
  tpl = tpl.replace(/<link[^>]*href=["'][^"']*\.css[^"']*["'][^>]*>/gi, '');
  tpl = tpl.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // 3. Inject our own CSS link in <head>
  if (tpl.includes('</head>')) {
    tpl = tpl.replace('</head>', '<link rel="stylesheet" href="style.css">\n</head>');
  } else {
    tpl = '<link rel="stylesheet" href="style.css">\n' + tpl;
  }

  // 4. Fix relative image/asset URLs to absolute
  tpl = tpl.replace(/(src|href)=["'](?!data:|https?:|\/\/|#|\{\{)(\/?[^"']+)["']/gi, (match, attr, urlPath) => {
    try {
      const fullUrl = new URL(urlPath, origin).href;
      return `${attr}="${fullUrl}"`;
    } catch { return match; }
  });

  // ─── Replace NAME (h1 content) ───
  const h1Match = tpl.match(/<h1([^>]*)>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const h1Content = h1Match[2].replace(/<[^>]+>/g, '').trim();
    if (h1Content.length > 1 && h1Content.length < 80) {
      tpl = tpl.replace(h1Match[0], `<h1${h1Match[1]}>{{{name}}}</h1>`);
      detected.name = true;
    }
  }
  // Fallback: title tag
  if (!detected.name) {
    tpl = tpl.replace(/<title[^>]*>[\s\S]*?<\/title>/i, '<title>{{name}} - Portfolio</title>');
  }

  // ─── Replace ROLE/SUBTITLE ───
  // Look for h2 near the top with role-like words, or any subtitle-like element
  const rolePatterns = [
    /(<h2[^>]*>)([\s\S]*?)(<\/h2>)/gi,
    /(<(?:p|span|div)[^>]*class=["'][^"']*(?:subtitle|tagline|title|role|headline|hero-text|intro-text)[^"']*["'][^>]*>)([\s\S]*?)(<\/(?:p|span|div)>)/gi,
  ];
  let roleReplaced = false;
  for (const pattern of rolePatterns) {
    if (roleReplaced) break;
    let match;
    let firstH2 = true;
    while ((match = pattern.exec(tpl)) !== null) {
      const text = match[2].replace(/<[^>]+>/g, '').trim();
      const roleWords = /developer|engineer|designer|architect|analyst|student|intern|scientist|specialist|manager|lead|consultant|programmer|freelancer|full.?stack|front.?end|back.?end|software|web|mobile|data|UX|UI/i;
      if (roleWords.test(text) && text.length < 120) {
        tpl = tpl.replace(match[0], `${match[1]}{{role}}${match[3]}`);
        detected.role = true;
        roleReplaced = true;
        break;
      }
      // Replace first h2 as role if close to h1
      if (firstH2 && pattern.source.includes('h2') && text.length < 80 && text.length > 2) {
        tpl = tpl.replace(match[0], `${match[1]}{{role}}${match[3]}`);
        detected.role = true;
        roleReplaced = true;
        break;
      }
      firstH2 = false;
    }
  }

  // ─── Replace ABOUT/BIO section ───
  const aboutSectionPatterns = [
    /(<(?:section|div)[^>]*(?:id|class)=["'][^"']*(?:about|bio|intro|summary)[^"']*["'][^>]*>)([\s\S]*?)(<\/(?:section|div)>)/gi,
  ];
  for (const pattern of aboutSectionPatterns) {
    const match = pattern.exec(tpl);
    if (match) {
      // Find <p> tags inside the about section and replace with {{bio}}
      let sectionHTML = match[2];
      const pMatches = sectionHTML.match(/<p[^>]*>[\s\S]*?<\/p>/gi);
      if (pMatches) {
        // Replace the first substantial paragraph with {{bio}}
        let replaced = false;
        for (const p of pMatches) {
          const pText = p.replace(/<[^>]+>/g, '').trim();
          if (pText.length > 30 && !replaced) {
            sectionHTML = sectionHTML.replace(p, '<p>{{bio}}</p>');
            replaced = true;
            detected.bio = true;
          }
        }
        tpl = tpl.replace(match[2], sectionHTML);
      }
      break;
    }
  }

  // ─── Replace SKILLS section ───
  const skillsSectionPatterns = [
    /(<(?:section|div)[^>]*(?:id|class)=["'][^"']*(?:skill|tech|stack|tool|competenc|expertise)[^"']*["'][^>]*>)([\s\S]*?)(<\/(?:section|div)>)/gi,
  ];
  for (const pattern of skillsSectionPatterns) {
    const match = pattern.exec(tpl);
    if (match) {
      let sectionHTML = match[2];
      // Find the list/container of skill items
      const ulMatch = sectionHTML.match(/<(ul|ol|div)[^>]*>([\s\S]*?)<\/\1>/i);
      if (ulMatch) {
        // Find one skill item to use as a template
        const itemMatch = ulMatch[2].match(/<(li|span|div|a)[^>]*>([\s\S]*?)<\/\1>/i);
        if (itemMatch) {
          const skillItemTemplate = itemMatch[0].replace(itemMatch[2], '{{this}}');
          const replacement = `<${ulMatch[1]}${ulMatch[0].match(/<(?:ul|ol|div)([^>]*)>/i)?.[1] || ''}>{{#each (split skills ",")}}\n${skillItemTemplate}\n{{/each}}</${ulMatch[1]}>`;
          sectionHTML = sectionHTML.replace(ulMatch[0], replacement);
          tpl = tpl.replace(match[2], sectionHTML);
          detected.skills = true;
        }
      }
      break;
    }
  }

  // ─── Replace PROJECTS section ───
  const projectSectionPatterns = [
    /(<(?:section|div)[^>]*(?:id|class)=["'][^"']*(?:project|work|portfolio|featured)[^"']*["'][^>]*>)([\s\S]*?)(<\/(?:section|div)>)/gi,
  ];
  for (const pattern of projectSectionPatterns) {
    const match = pattern.exec(tpl);
    if (match) {
      let sectionHTML = match[2];
      // Find project cards (articles, divs with card/item class, or list items)
      const cardPatterns = [
        /<(article|div|li)[^>]*(?:class=["'][^"']*(?:card|item|project|featured)[^"']*["'])[^>]*>[\s\S]*?<\/\1>/gi,
        /<(article)[^>]*>[\s\S]*?<\/\1>/gi,
      ];
      let cards = [];
      for (const cp of cardPatterns) {
        cards = sectionHTML.match(cp) || [];
        if (cards.length > 0) break;
      }

      if (cards.length > 0) {
        // Use the first card as the template for the each loop
        let cardTemplate = cards[0];
        // Replace title (h2/h3/h4)
        cardTemplate = cardTemplate.replace(/<(h[2-4]|strong)([^>]*)>[\s\S]*?<\/\1>/i, '<$1$2>{{this.title}}</$1>');
        // Replace description (first <p>)
        cardTemplate = cardTemplate.replace(/<p([^>]*)>[\s\S]*?<\/p>/i, '<p$1>{{this.description}}</p>');
        // Replace link
        cardTemplate = cardTemplate.replace(/href=["'][^"'#][^"']*["']/i, 'href="{{this.link}}"');

        // Replace all original cards with the {{#each}} loop
        let projectContainer = sectionHTML;
        // Remove all original cards
        for (const card of cards) {
          projectContainer = projectContainer.replace(card, '');
        }
        // Insert the each loop where first card was
        const insertPoint = sectionHTML.indexOf(cards[0]);
        const before = sectionHTML.substring(0, insertPoint);
        // Find end of last card
        const lastCardEnd = sectionHTML.lastIndexOf(cards[cards.length - 1]) + cards[cards.length - 1].length;
        const after = sectionHTML.substring(lastCardEnd);
        sectionHTML = before + '{{#each projects}}\n' + cardTemplate + '\n{{/each}}' + after;

        tpl = tpl.replace(match[2], sectionHTML);
        detected.projects = true;
      }
      break;
    }
  }

  // ─── Replace EMAIL ───
  const emailRegex = /[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/g;
  let emailMatch;
  let firstEmail = true;
  while ((emailMatch = emailRegex.exec(tpl)) !== null) {
    if (firstEmail) {
      tpl = tpl.replace(emailMatch[0], '{{email}}');
      detected.email = true;
      firstEmail = false;
    }
  }
  // Also replace mailto: links
  tpl = tpl.replace(/mailto:[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/gi, 'mailto:{{email}}');

  // ─── Replace SOCIAL LINKS ───
  tpl = tpl.replace(/https?:\/\/github\.com\/[\w-]+/gi, '{{githubUrl}}');
  tpl = tpl.replace(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+/gi, '{{linkedinUrl}}');
  if (/\{\{githubUrl\}\}|\{\{linkedinUrl\}\}/.test(tpl)) detected.social = true;

  // ─── Fallback: if no sections detected, inject minimal placeholders ───
  if (!detected.name && !detected.role && !detected.bio) {
    // Wrap the body content with our own template structure
    const bodyMatch = tpl.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      // Prepend a hero section
      const heroSection = `
<section style="text-align:center;padding:3rem 1rem;">
  <h1>{{name}}</h1>
  <p style="font-size:1.2em;opacity:0.8;">{{role}}</p>
  <p style="max-width:600px;margin:1rem auto;">{{bio}}</p>
</section>`;
      tpl = tpl.replace(bodyMatch[1], heroSection + bodyMatch[1]);
      detected.name = true;
      detected.role = true;
      detected.bio = true;
    }
  }

  if (!detected.skills) {
    // Inject a skills section before </body>
    const skillsSection = `
<section style="padding:2rem 1rem;text-align:center;">
  <h2>Skills</h2>
  <div style="display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:center;max-width:600px;margin:0 auto;">
    {{#each (split skills ",")}}
    <span style="background:rgba(100,100,255,0.15);padding:0.3rem 0.8rem;border-radius:20px;font-size:0.9rem;">{{this}}</span>
    {{/each}}
  </div>
</section>`;
    tpl = tpl.replace('</body>', skillsSection + '\n</body>');
    detected.skills = true;
  }

  if (!detected.projects) {
    const projectsSection = `
<section style="padding:2rem 1rem;max-width:800px;margin:0 auto;">
  <h2 style="text-align:center;">Projects</h2>
  {{#each projects}}
  <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:1.5rem;margin:1rem 0;">
    <h3>{{this.title}}</h3>
    <p>{{this.description}}</p>
    {{#if this.link}}<a href="{{this.link}}" target="_blank">View Project →</a>{{/if}}
  </div>
  {{/each}}
</section>`;
    tpl = tpl.replace('</body>', projectsSection + '\n</body>');
    detected.projects = true;
  }

  if (!detected.email) {
    tpl = tpl.replace('</body>', `
<section style="padding:2rem 1rem;text-align:center;">
  {{#if email}}<p>📧 <a href="mailto:{{email}}">{{email}}</a></p>{{/if}}
  <div style="display:flex;gap:1rem;justify-content:center;margin-top:0.5rem;">
    {{#if githubUrl}}<a href="{{githubUrl}}" target="_blank">GitHub</a>{{/if}}
    {{#if linkedinUrl}}<a href="{{linkedinUrl}}" target="_blank">LinkedIn</a>{{/if}}
  </div>
</section>
</body>`);
    tpl = tpl.replace('</body></body>', '</body>');
    detected.email = true;
    detected.social = true;
  }

  return { template: tpl, detectedSections: detected };
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
    // Support cloned templates (cloned-<uuid>)
    const isClonedTemplate = selectedTemplate.startsWith('cloned-');
    let templateName;
    if (isClonedTemplate) {
      // Verify the cloned template directory exists
      const clonedDir = path.join(TEMPLATES_DIR, selectedTemplate);
      if (await fs.pathExists(clonedDir)) {
        templateName = selectedTemplate;
      } else {
        return res.status(400).json({ error: 'Cloned template not found. Please try cloning again.' });
      }
    } else {
      templateName = validTemplates.includes(selectedTemplate) ? selectedTemplate : 'simple';
    }

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

    const isCloned = templateId.startsWith('cloned-');
    if (!validTemplates.includes(templateId) && !isCloned) {
      return res.status(400).send('Invalid template ID');
    }

    // Read template files
    const tplPath = path.join(TEMPLATES_DIR, templateId, 'index.hbs');
    const cssPath = path.join(TEMPLATES_DIR, templateId, 'style.css');
    
    if (!await fs.pathExists(tplPath)) {
      return res.status(404).send('Template not found');
    }

    const tplSrc = await fs.readFile(tplPath, 'utf8');
    const cssSrc = await fs.pathExists(cssPath) ? await fs.readFile(cssPath, 'utf8') : '';
    
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
