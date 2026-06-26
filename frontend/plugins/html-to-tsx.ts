import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import type { Plugin, HmrContext } from 'vite';

export default function htmlToTsxPlugin(): Plugin {
  return {
    name: 'vite-plugin-html-to-tsx',
    buildStart() {
      console.log('\n[HTML-to-TSX Plugin] Running compilation on startup...');
      try {
        execSync('node scripts/compile-html.js', { stdio: 'inherit' });
      } catch (err) {
        console.error('[HTML-to-TSX Plugin] Compilation failed:', err);
      }
    },
    handleHotUpdate({ file, server }: HmrContext) {
      // Check if the changed file is inside marketing_html
      if (file.includes('marketing_html') && file.endsWith('.html')) {
        console.log(`\n[HTML-to-TSX Plugin] Change detected in ${path.basename(file)}, recompiling...`);
        try {
          execSync('node scripts/compile-html.js', { stdio: 'inherit' });
          
          // Force Vite to reload since the TSX files were changed in the background
          server.ws.send({
            type: 'full-reload',
            path: '*'
          });
          
        } catch (err) {
          console.error('[HTML-to-TSX Plugin] Compilation failed:', err);
        }
      }
    }
  };
}
