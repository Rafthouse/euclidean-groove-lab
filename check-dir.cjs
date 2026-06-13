const fs = require('fs');
const dir = 'C:\\Users\\User\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist';
const files = fs.readdirSync(dir);
console.log('Total files:', files.length);

// Find all files containing 'bash' or 'exec' in name
files.filter(f => f.includes('bash') || f.includes('exec') || f.includes('agent-tools')).forEach(f => {
  console.log(f);
});
