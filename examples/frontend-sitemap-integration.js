// Example: Frontend sitemap generation from Strapi
// This would run in your frontend build process (Next.js, Nuxt, etc.)

async function generateSitemapFromStrapi() {
  try {
    // Fetch Strapi's sitemap
    const strapiSitemap = await fetch(`${process.env.STRAPI_URL}/sitemap.xml`);
    const xmlText = await strapiSitemap.text();
    
    // Or better: fetch content directly from API
    const articles = await fetch(`${process.env.STRAPI_URL}/api/articles?populate=*`);
    const articlesData = await articles.json();
    
    // Generate frontend sitemap
    const frontendUrls = articlesData.data.map(article => ({
      loc: `${process.env.FRONTEND_URL}/blog/${article.attributes.slug}`,
      lastmod: article.attributes.updatedAt,
      changefreq: 'weekly',
      priority: 0.8
    }));
    
    // Generate sitemap.xml for your frontend
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${frontendUrls.map(url => `
  <url>
    <loc>${url.loc}</loc>
    <lastmod>${new Date(url.lastmod).toISOString().split('T')[0]}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('')}
</urlset>`;
    
    return sitemap;
  } catch (error) {
    console.error('Sitemap generation failed:', error);
  }
}

// Usage in Next.js (pages/sitemap.xml.js)
export async function getServerSideProps({ res }) {
  const sitemap = await generateSitemapFromStrapi();
  
  res.setHeader('Content-Type', 'text/xml');
  res.write(sitemap);
  res.end();
  
  return { props: {} };
}