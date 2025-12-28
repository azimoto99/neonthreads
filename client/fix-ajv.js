const fs = require('fs');
const path = require('path');

// The issue is that schema-utils needs ajv-keywords but can't find the right version
// We'll ensure the root has the correct versions, and try to fix nested ones

console.log('Fixing ajv dependencies...');

try {
  const { execSync } = require('child_process');
  
  // First, ensure root has correct versions (they should already be in devDependencies)
  console.log('Root dependencies should already be installed via package.json');
  
  // Fix nested dependencies in fork-ts-checker-webpack-plugin
  const pluginDir = path.join(__dirname, 'node_modules', 'fork-ts-checker-webpack-plugin');
  const pluginNodeModules = path.join(pluginDir, 'node_modules');
  
  if (fs.existsSync(pluginDir)) {
    console.log('Found fork-ts-checker-webpack-plugin, fixing nested dependencies...');
    
    // Ensure node_modules exists
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
    
    // Install correct versions in plugin
    const originalDir = process.cwd();
    try {
      process.chdir(pluginDir);
      execSync('npm install ajv@8.12.0 ajv-keywords@3.5.2 --no-save --legacy-peer-deps', { 
        stdio: 'inherit'
      });
      console.log('Fixed nested ajv dependencies in plugin');
    } catch (e) {
      console.log('Could not fix nested dependencies:', e.message);
    } finally {
      process.chdir(originalDir);
    }
  }
  
  // Also ensure schema-utils can find ajv-keywords
  // The root node_modules should have it from devDependencies
  const rootAjvKeywords = path.join(__dirname, 'node_modules', 'ajv-keywords');
  if (!fs.existsSync(rootAjvKeywords)) {
    console.log('Installing ajv-keywords in root...');
    execSync('npm install ajv-keywords@3.5.2 --save-dev --legacy-peer-deps', { 
      stdio: 'inherit',
      cwd: __dirname
    });
  }
  
  console.log('Fix script completed');
} catch (e) {
  console.log('Error in fix script:', e.message);
}
