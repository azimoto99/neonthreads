// Fix ajv/ajv-keywords version conflicts for react-scripts build
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Fixing ajv dependencies for build...');

try {
  // Ensure schema-utils has the correct ajv version
  // schema-utils@2.7.1 needs ajv@6.x and ajv-keywords@3.5.2
  const schemaUtilsPath = path.join(__dirname, 'node_modules', 'schema-utils');
  
  if (fs.existsSync(schemaUtilsPath)) {
    console.log('Found schema-utils, checking dependencies...');
    
    const schemaUtilsNodeModules = path.join(schemaUtilsPath, 'node_modules');
    if (!fs.existsSync(schemaUtilsNodeModules)) {
      fs.mkdirSync(schemaUtilsNodeModules, { recursive: true });
    }
    
    // Check if ajv exists and is the wrong version
    const ajvPath = path.join(schemaUtilsNodeModules, 'ajv');
    const ajvKeywordsPath = path.join(schemaUtilsNodeModules, 'ajv-keywords');
    
    if (fs.existsSync(ajvPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(ajvPath, 'package.json'), 'utf8'));
        if (pkg.version.startsWith('8.')) {
          console.log('Removing incompatible ajv@8.x from schema-utils...');
          fs.rmSync(ajvPath, { recursive: true, force: true });
        }
      } catch (e) {
        // Ignore
      }
    }
    
    if (fs.existsSync(ajvKeywordsPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(ajvKeywordsPath, 'package.json'), 'utf8'));
        if (!pkg.version.startsWith('3.')) {
          console.log('Removing incompatible ajv-keywords from schema-utils...');
          fs.rmSync(ajvKeywordsPath, { recursive: true, force: true });
        }
      } catch (e) {
        // Ignore
      }
    }
    
    // Install correct versions in schema-utils
    const originalDir = process.cwd();
    try {
      process.chdir(schemaUtilsPath);
      console.log('Installing ajv@6.12.6 and ajv-keywords@3.5.2 in schema-utils...');
      execSync('npm install ajv@6.12.6 ajv-keywords@3.5.2 --no-save --legacy-peer-deps', { 
        stdio: 'inherit'
      });
      console.log('Successfully installed correct versions in schema-utils');
    } catch (e) {
      console.log('Could not install in schema-utils (may already be correct):', e.message);
    } finally {
      process.chdir(originalDir);
    }
  }
  
  // Also check root node_modules - ensure ajv-keywords@3.5.2 can find ajv@6.x
  const rootAjvPath = path.join(__dirname, 'node_modules', 'ajv');
  const rootAjvKeywordsPath = path.join(__dirname, 'node_modules', 'ajv-keywords');
  
  if (fs.existsSync(rootAjvKeywordsPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootAjvKeywordsPath, 'package.json'), 'utf8'));
      if (pkg.version.startsWith('3.')) {
        // ajv-keywords@3.x needs ajv@6.x
        if (fs.existsSync(rootAjvPath)) {
          const ajvPkg = JSON.parse(fs.readFileSync(path.join(rootAjvPath, 'package.json'), 'utf8'));
          if (ajvPkg.version.startsWith('8.')) {
            console.log('Root has ajv@8.x but ajv-keywords@3.x needs ajv@6.x');
            console.log('Installing ajv@6.12.6 in root...');
            execSync('npm install ajv@6.12.6 --save-dev --legacy-peer-deps', {
              stdio: 'inherit',
              cwd: __dirname
            });
          }
        }
      }
    } catch (e) {
      // Ignore
    }
  }
  
  console.log('Dependency fix completed');
} catch (e) {
  console.log('Error in fix script (non-fatal):', e.message);
}

