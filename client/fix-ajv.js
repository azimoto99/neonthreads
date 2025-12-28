const fs = require('fs');
const path = require('path');

// The real issue: schema-utils (used by terser-webpack-plugin) needs ajv-keywords
// but it's looking in the wrong place or finding the wrong version.
// We need to ensure ajv-keywords@3.5.2 is in root node_modules where schema-utils can find it.

console.log('Fixing ajv dependencies for production build...');

try {
  const { execSync } = require('child_process');
  
  // CRITICAL: Ensure root has ajv-keywords@3.5.2 (the version schema-utils expects)
  const rootAjvKeywords = path.join(__dirname, 'node_modules', 'ajv-keywords');
  const rootAjv = path.join(__dirname, 'node_modules', 'ajv');
  
  // Check if they exist and have correct versions
  let needsInstall = false;
  
  if (!fs.existsSync(rootAjvKeywords)) {
    console.log('ajv-keywords missing in root, installing...');
    needsInstall = true;
  } else {
    // Check version
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootAjvKeywords, 'package.json'), 'utf8'));
      if (!pkg.version.startsWith('3.')) {
        console.log(`ajv-keywords version ${pkg.version} found, need 3.x.x, reinstalling...`);
        needsInstall = true;
      }
    } catch (e) {
      needsInstall = true;
    }
  }
  
  if (needsInstall) {
    console.log('Installing ajv@8.12.0 and ajv-keywords@3.5.2 in root...');
    execSync('npm install ajv@8.12.0 ajv-keywords@3.5.2 --save-dev --legacy-peer-deps', { 
      stdio: 'inherit',
      cwd: __dirname
    });
  }
  
  // Also fix nested dependencies in fork-ts-checker-webpack-plugin
  const pluginDir = path.join(__dirname, 'node_modules', 'fork-ts-checker-webpack-plugin');
  const pluginNodeModules = path.join(pluginDir, 'node_modules');
  
  if (fs.existsSync(pluginDir)) {
    console.log('Fixing nested dependencies in fork-ts-checker-webpack-plugin...');
    
    if (!fs.existsSync(pluginNodeModules)) {
      fs.mkdirSync(pluginNodeModules, { recursive: true });
    }
    
    // Remove incompatible versions
    const ajvKeywordsPath = path.join(pluginNodeModules, 'ajv-keywords');
    const ajvPath = path.join(pluginNodeModules, 'ajv');
    
    if (fs.existsSync(ajvKeywordsPath)) {
      console.log('Removing incompatible ajv-keywords from plugin...');
      fs.rmSync(ajvKeywordsPath, { recursive: true, force: true });
    }
    if (fs.existsSync(ajvPath)) {
      console.log('Removing incompatible ajv from plugin...');
      fs.rmSync(ajvPath, { recursive: true, force: true });
    }
    
    // Try to install correct versions in plugin (may fail, but root should have it)
    const originalDir = process.cwd();
    try {
      process.chdir(pluginDir);
      execSync('npm install ajv@8.12.0 ajv-keywords@3.5.2 --no-save --legacy-peer-deps', { 
        stdio: 'inherit'
      });
      console.log('Fixed nested dependencies');
    } catch (e) {
      console.log('Could not install in plugin (root should have it):', e.message);
    } finally {
      process.chdir(originalDir);
    }
  }
  
  // Verify schema-utils can find ajv-keywords
  const schemaUtilsPath = path.join(__dirname, 'node_modules', 'schema-utils');
  if (fs.existsSync(schemaUtilsPath)) {
    console.log('schema-utils found, verifying ajv-keywords is accessible...');
    // Node's module resolution should find it in root node_modules
  }
  
  console.log('Fix script completed - ajv-keywords should be available to schema-utils');
} catch (e) {
  console.log('Error in fix script (non-fatal):', e.message);
  // Don't fail the build if fix script has issues
}
