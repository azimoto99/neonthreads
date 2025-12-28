const fs = require('fs');
const path = require('path');

// Fix nested ajv-keywords in fork-ts-checker-webpack-plugin
const pluginPath = path.join(__dirname, 'node_modules', 'fork-ts-checker-webpack-plugin', 'node_modules', 'ajv-keywords');
const ajvPath = path.join(__dirname, 'node_modules', 'fork-ts-checker-webpack-plugin', 'node_modules', 'ajv');

if (fs.existsSync(pluginPath)) {
  try {
    // Try to install correct versions in the nested location
    const { execSync } = require('child_process');
    console.log('Fixing nested ajv dependencies...');
    process.chdir(path.join(__dirname, 'node_modules', 'fork-ts-checker-webpack-plugin'));
    try {
      execSync('npm install ajv@^8.12.0 ajv-keywords@^5.1.0 --no-save --legacy-peer-deps', { stdio: 'inherit' });
      console.log('Fixed nested ajv dependencies');
    } catch (e) {
      console.log('Could not fix nested dependencies, continuing...');
    }
  } catch (e) {
    console.log('Error fixing dependencies:', e.message);
  }
} else {
  console.log('fork-ts-checker-webpack-plugin nested dependencies not found, skipping fix');
}

