module.exports = () => ({
  // SEO Plugin Configuration
  seo: {
    enabled: true,
  },
  // Import Export Plugin (Strapi 5) configuration
  'strapi-import-export': {
    enabled: true,
    config: {
      // Needed for generating absolute URLs in exported data if behind a reverse proxy / cloud
      serverPublicHostname: process.env.PUBLIC_URL || '',
    },
  },
});
