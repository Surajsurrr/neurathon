// Quick test to verify server dependencies and generation
const path = require('path');
const fs = require('fs-extra');
const Handlebars = require('handlebars');

async function test() {
  try {
    console.log('Testing template rendering...');
    const tplPath = path.join(__dirname, 'templates', 'simple', 'index.hbs');
    const tplSrc = await fs.readFile(tplPath, 'utf8');
    console.log('✓ Template loaded');
    
    const tpl = Handlebars.compile(tplSrc);
    const html = tpl({
      name: 'Test User',
      role: 'Developer',
      bio: 'Testing',
      skills: 'JavaScript',
      projects: [{title: 'Test Project', description: 'Test'}]
    });
    
    console.log('✓ Template compiled');
    console.log('Generated HTML length:', html.length);
    
    await fs.writeFile('test-output.html', html);
    console.log('✓ Written to test-output.html');
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

test();
