const fs = require('fs');
const path = require('path');

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    let p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.dart')) {
      let c = fs.readFileSync(p, 'utf8');
      if (c.includes('\uFFFD') || c.includes('â€”')) {
        c = c.replace(/\uFFFD/g, '\u2014').replace(/â€”/g, '\u2014');
        fs.writeFileSync(p, c);
        console.log('Fixed encoding in', p);
      }
    }
  });
}

walk('lib');
