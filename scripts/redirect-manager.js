// redirect-manager.js - Standalone redirect management script
const fs = require('fs');
const path = require('path');

// Configuration
const STRAPI_API_URL = process.env.STRAPI_API_URL || 'http://localhost:1337';
const API_TOKEN = process.env.STRAPI_API_TOKEN; // You'll need to generate this in admin

class RedirectManager {
  constructor(apiUrl, token) {
    this.apiUrl = apiUrl;
    this.token = token;
  }

  // Export redirects to CSV
  async exportToCsv(filename = 'redirects-export.csv') {
    try {
      const response = await fetch(`${this.apiUrl}/api/redirects`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const redirects = data.data;

      // Convert to CSV
      const csvContent = [
        'fromPath,toPath,statusCode,isActive,description,priority',
        ...redirects.map(r => 
          `"${r.fromPath}","${r.toPath}",${r.statusCode},${r.isActive},"${r.description || ''}",${r.priority}`
        )
      ].join('\n');

      fs.writeFileSync(filename, csvContent);
      console.log(`✅ Exported ${redirects.length} redirects to ${filename}`);
      return filename;
    } catch (error) {
      console.error('❌ Export failed:', error.message);
      throw error;
    }
  }

  // Import redirects from CSV
  async importFromCsv(filename) {
    try {
      if (!fs.existsSync(filename)) {
        throw new Error(`File ${filename} not found`);
      }

      const csvContent = fs.readFileSync(filename, 'utf-8');
      const lines = csvContent.split('\n').slice(1); // Skip header

      const redirects = lines
        .filter(line => line.trim())
        .map(line => {
          const [fromPath, toPath, statusCode, isActive, description, priority] = 
            line.split(',').map(field => field.replace(/"/g, ''));
          
          return {
            fromPath: fromPath.trim(),
            toPath: toPath.trim(),
            statusCode: parseInt(statusCode) || 301,
            isActive: isActive.toLowerCase() === 'true',
            description: description || '',
            priority: parseInt(priority) || 100
          };
        });

      console.log(`📥 Importing ${redirects.length} redirects...`);

      // Batch import
      const results = [];
      for (const redirect of redirects) {
        try {
          const response = await fetch(`${this.apiUrl}/api/redirects`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data: redirect })
          });

          if (response.ok) {
            results.push({ success: true, redirect });
          } else {
            results.push({ success: false, redirect, error: await response.text() });
          }
        } catch (error) {
          results.push({ success: false, redirect, error: error.message });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(`✅ Successfully imported: ${successful}`);
      if (failed > 0) {
        console.log(`❌ Failed imports: ${failed}`);
        console.log('Failed items:', results.filter(r => !r.success));
      }

      return { successful, failed, results };
    } catch (error) {
      console.error('❌ Import failed:', error.message);
      throw error;
    }
  }
}

// CLI Usage
async function main() {
  const [command, filename] = process.argv.slice(2);
  
  if (!API_TOKEN) {
    console.error('❌ Please set STRAPI_API_TOKEN environment variable');
    console.log('Generate one in Strapi Admin: Settings > API Tokens > Create new API Token');
    process.exit(1);
  }

  const manager = new RedirectManager(STRAPI_API_URL, API_TOKEN);

  try {
    switch (command) {
      case 'export':
        await manager.exportToCsv(filename || 'redirects-export.csv');
        break;
      case 'import':
        if (!filename) {
          console.error('❌ Please provide CSV filename to import');
          process.exit(1);
        }
        await manager.importFromCsv(filename);
        break;
      default:
        console.log(`
🔧 Redirect Manager for Strapi

Usage:
  node redirect-manager.js export [filename.csv]     # Export redirects to CSV
  node redirect-manager.js import filename.csv       # Import redirects from CSV

Environment Variables:
  STRAPI_API_URL      # Strapi API URL (default: http://localhost:1337)
  STRAPI_API_TOKEN    # Your Strapi API token (required)

Examples:
  node redirect-manager.js export my-redirects.csv
  node redirect-manager.js import redirects-to-add.csv
        `);
    }
  } catch (error) {
    console.error('❌ Operation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = RedirectManager;