module.exports = {
  async generateSitemap(ctx) {
    ctx.set('Content-Type', 'application/xml');
    
    // Use frontend URL for proper SEO
    const baseUrl = process.env.FRONTEND_URL || 'https://nuxtjs-boilerplate-alpha-opal.vercel.app';
    
    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    try {
      // Get all published articles
      const articles = await strapi.entityService.findMany('api::article.article', {
        publicationState: 'live',
        populate: {
          slug: true,
        },
      });

      // Add articles to sitemap
      articles.forEach(article => {
        if (article.slug) {
          sitemap += '  <url>\n';
          sitemap += `    <loc>${baseUrl}/articles/${article.slug}</loc>\n`;
          sitemap += `    <lastmod>${new Date(article.updatedAt).toISOString()}</lastmod>\n`;
          sitemap += '    <changefreq>weekly</changefreq>\n';
          sitemap += '    <priority>0.8</priority>\n';
          sitemap += '  </url>\n';
        }
      });

      // Get all published authors
      const authors = await strapi.entityService.findMany('api::author.author', {
        publicationState: 'live',
      });

      // Add authors to sitemap
      authors.forEach(author => {
        sitemap += '  <url>\n';
        sitemap += `    <loc>${baseUrl}/authors/${author.id}</loc>\n`;
        sitemap += `    <lastmod>${new Date(author.updatedAt).toISOString()}</lastmod>\n`;
        sitemap += '    <changefreq>monthly</changefreq>\n';
        sitemap += '    <priority>0.6</priority>\n';
        sitemap += '  </url>\n';
      });

      // Get all published categories
      const categories = await strapi.entityService.findMany('api::category.category', {
        publicationState: 'live',
      });

      // Add categories to sitemap
      categories.forEach(category => {
        if (category.slug) {
          sitemap += '  <url>\n';
          sitemap += `    <loc>${baseUrl}/categories/${category.slug}</loc>\n`;
          sitemap += `    <lastmod>${new Date(category.updatedAt).toISOString()}</lastmod>\n`;
          sitemap += '    <changefreq>weekly</changefreq>\n';
          sitemap += '    <priority>0.7</priority>\n';
          sitemap += '  </url>\n';
        }
      });

      // Add static pages
      const staticPages = [
        { url: '/', priority: '1.0', changefreq: 'daily' },
        { url: '/about', priority: '0.8', changefreq: 'monthly' },
        { url: '/articles', priority: '0.9', changefreq: 'daily' },
        { url: '/categories', priority: '0.8', changefreq: 'weekly' },
        { url: '/authors', priority: '0.8', changefreq: 'weekly' },
      ];

      staticPages.forEach(page => {
        sitemap += '  <url>\n';
        sitemap += `    <loc>${baseUrl}${page.url}</loc>\n`;
        sitemap += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
        sitemap += `    <changefreq>${page.changefreq}</changefreq>\n`;
        sitemap += `    <priority>${page.priority}</priority>\n`;
        sitemap += '  </url>\n';
      });

    } catch (error) {
      strapi.log.error('Error generating sitemap:', error);
      ctx.status = 500;
      return ctx.body = '<?xml version="1.0" encoding="UTF-8"?><error>Failed to generate sitemap</error>';
    }

    sitemap += '</urlset>';
    return sitemap;
  },
};