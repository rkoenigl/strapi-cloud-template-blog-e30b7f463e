module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/sitemap.xml',
      handler: 'sitemap.generateSitemap',
    },
  ],
};