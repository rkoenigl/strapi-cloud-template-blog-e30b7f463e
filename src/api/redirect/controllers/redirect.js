'use strict';

/**
 * redirect controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::redirect.redirect', ({ strapi }) => ({
  // Get all active redirects for frontend consumption
  async findActive(ctx) {
    const redirects = await strapi.entityService.findMany('api::redirect.redirect', {
      filters: { isActive: true },
      sort: { priority: 'asc' },
      fields: ['fromPath', 'toPath', 'statusCode'],
    });

    return { data: redirects };
  },

  // Bulk import redirects (works with Import/Export plugin)
  async bulkImport(ctx) {
    const { data } = ctx.request.body;
    
    if (!Array.isArray(data)) {
      return ctx.badRequest('Data must be an array of redirect objects');
    }

    try {
      const results = await Promise.all(
        data.map(redirect => 
          strapi.entityService.create('api::redirect.redirect', { data: redirect })
        )
      );

      return { 
        message: `Successfully imported ${results.length} redirects`,
        data: results 
      };
    } catch (error) {
      return ctx.badRequest(`Import failed: ${error.message}`);
    }
  },
}));