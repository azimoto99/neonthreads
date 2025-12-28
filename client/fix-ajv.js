const fs = require('fs');
const path = require('path');

// Fix nested ajv-keywords in fork-ts-checker-webpack-plugin
const pluginDir = path.join(__dirname, 'node_modules', 'fork-ts-checker-webpack-plugin');
const pluginNodeModules = path.join(pluginDir, 'node_modules');
const ajvKeywordsPath = path.join(pluginNodeModules, 'ajv-keywords');
const ajvPath = path.join(pluginNodeModules, 'ajv');

console.log('Checking for fork-ts-checker-webpack-plugin...');
console.log('Plugin dir exists:', fs.existsSync(pluginDir));
console.log('Plugin node_modules exists:', fs.existsSync(pluginNodeModules));

if (fs.existsSync(pluginDir)) {
  try {
    const { execSync } = require('child_process');
    console.log('Fixing nested ajv dependencies...');
    
    // Ensure node_modules exists in plugin directory
    if (!fs.existsSync(pluginNodeModules)) {
      console.log('Creating plugin node_modules directory...');
      fs.mkdirSync(pluginNodeModules, { recursive: true });
    }
    
    // Remove existing nested dependencies if they exist
    if (fs.existsSync(ajvKeywordsPath)) {
      console.log('Removing incompatible ajv-keywords...');
      fs.rmSync(ajvKeywordsPath, { recursive: true, force: true });
    }
    if (fs.existsSync(ajvPath)) {
      console.log('Removing incompatible ajv...');
      fs.rmSync(ajvPath, { recursive: true, force: true });
    }
    
    // Install correct versions in the plugin's node_modules
    console.log('Installing compatible versions in plugin directory...');
    const originalDir = process.cwd();
    try {
      process.chdir(pluginDir);
      execSync('npm install ajv@8.12.0 ajv-keywords@3.5.2 --no-save --legacy-peer-deps', { 
        stdio: 'inherit'
      });
      console.log('Successfully fixed nested ajv dependencies');
    } catch (e) {
      console.log('Could not fix nested dependencies:', e.message);
      // Try alternative: install in root and symlink
      console.log('Trying alternative approach...');
      process.chdir(originalDir);
      try {
        // Install in root first
        execSync('npm install ajv@8.12.0 ajv-keywords@3.5.2 --no-save --legacy-peer-deps', { 
          stdio: 'inherit',
          cwd: __dirname
        });
        // Then try to copy or symlink to plugin
        const rootAjv = path.join(__dirname, 'node_modules', 'ajv');
        const rootAjvKeywords = path.join(__dirname, 'node_modules', 'ajv-keywords');
        if (fs.existsSync(rootAjv) && fs.existsSync(rootAjvKeywords)) {
          console.log('Root dependencies installed, attempting to link...');
        }
      } catch (e2) {
        console.log('Alternative approach also failed:', e2.message);
      }
    } finally {
      process.chdir(originalDir);
    }
  } catch (e) {
    console.log('Error fixing dependencies:', e.message);
  }
} else {
  console.log('fork-ts-checker-webpack-plugin not found, skipping fix');
}
