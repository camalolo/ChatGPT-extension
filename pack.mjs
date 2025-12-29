import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { default as ChromeCrxBuilder } from 'webext-buildtools-chrome-crx-builder';

// Private key for CRX signing is stored outside repository at: ../Chrome-Extension-Keys/key.pem

async function packExtension() {
  try {
    // Read manifest.json to get version
    const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
    const version = manifest.version;

    // Create dist directory if it doesn't exist
    if (!fs.existsSync('./dist')) {
      fs.mkdirSync('./dist');
    }

    // Build the extension using web-ext (creates zip)
    execSync('npx web-ext build --overwrite-dest --ignore-files "dist/" "package.json" "package-lock.json" "eslint.config.mjs" "jsconfig.json" "README.md" "PRIVACY_POLICY.md" "pack.mjs" "tag_release.sh" "web-extension.crx"', { stdio: 'inherit' });

    // Move the generated zip to dist with a cleaner name
    const sourceZip = path.join('web-ext-artifacts', `ai_buddy-${version}.zip`);
    const targetZip = path.join('dist', `ai-buddy-v${version}.zip`);
    const targetCrx = path.join('dist', `ai-buddy-v${version}.crx`);



    try {
      if (fs.existsSync(sourceZip)) {
        fs.copyFileSync(sourceZip, targetZip);
        console.log(`Successfully created ZIP: ${targetZip}`);

      // Also create CRX format for releases (better for users)
      const privateKeyPath = path.resolve('../Chrome-Extension-Keys/key.pem');

      // Read the ZIP file created by web-ext
      const zipBuffer = fs.readFileSync(sourceZip);

      // Create CRX using ChromeCrxBuilder
      const builder = new ChromeCrxBuilder.default({
        privateKeyFilePath: privateKeyPath,
        crxFilePath: targetCrx
      }, console.log);

      builder.setInputZipBuffer(zipBuffer);
      builder.requireCrxFile();

      const buildResult = await builder.build();
      console.log(`Successfully created CRX: ${targetCrx}`);
      } else {
        throw new Error(`Generated zip file not found: ${sourceZip}`);
      }

    } catch (error) {
      throw new Error(`CRX creation failed: ${error.message}`);
    }
  } catch (error) {
    console.error('Error packing extension:', error.message);
    throw error;
  }
}

packExtension();