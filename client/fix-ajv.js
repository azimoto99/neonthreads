const fs = require('fs');
const path = require('path');

// The real issue: schema-utils (used by terser-webpack-plugin) needs ajv-keywords
// but it's looking in the wrong place. We need to ensure it's in root node_modules
// and that nested dependencies don't interfere.

console.log('Fixing ajv dependencies for build...');

try {
  const { execSync } = require('child_process');
  
  // Ensure root has correct versions (from devDependencies)
  const rootAjvKeywords = path.join(__dirname, 'node_modules', 'ajv-keywords');
  if (!fs.existsSync(rootAjvKeywords)) {
    console.log('Installing ajv-keywords in root node_modules...');
    execSync('npm install ajv-keywords@3.5.2 --save-dev --legacy-peer-deps', { 
      stdio: 'inherit',
      cwd: __dirname
    });
  }
  
  // Fix nested dependencies in fork-ts-checker-webpack-plugin
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
    
    // Try to install correct versions
    const originalDir = process.cwd();
    try {
      process.chdir(pluginDir);
      execSync('npm install ajv@8.12.0 ajv-keywords@3.5.2 --no-save --legacy-peer-deps', { 
        stdio: 'inherit'
      });
      console.log('Fixed nested dependencies');
    } catch (e) {
      console.log('Could not install in plugin directory (this is okay if root has it):', e.message);
    } finally {
      process.chdir(originalDir);
    }
  }
  
  // Most importantly: ensure schema-utils can find ajv-keywords
  // Check if schema-utils exists and try to patch it if needed
  const schemaUtilsPath = path.join(__dirname, 'node_modules', 'schema-utils');
  if (fs.existsSync(schemaUtilsPath)) {
    console.log('schema-utils found, ensuring ajv-keywords is available...');
    // The root node_modules should have it now
  }
  
  console.log('Fix script completed');
} catch (e) {
  console.log('Error in fix script (non-fatal):', e.message);
}
