'use strict';

const bootstrap = require("./bootstrap");

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to exte    strapi.log.info('🔥 SMART Auto-Redirect System activated! Handles chains & reverts automatically!');d code.
   */
  register({ strapi }) {
    // 🔥 FULLY AUTOMATIC REDIRECT SYSTEM 🔥
    // Auto-detects ALL content types with slugs and creates redirects
    // Features: Loop prevention, chain resolution, self-reference blocking
    // Configuration: Managed through Global Settings > Redirect URL Mappings
    
    // Register global lifecycle middleware for ALL content types
    strapi.db.lifecycles.subscribe(async (event) => {
      const { action, model, params, result } = event;
      
      // Handle update events for slug changes
      if (action === 'beforeUpdate' || action === 'afterUpdate') {
        await handleSlugChanges(event);
      }
      
      // Handle content deletion - deactivate orphaned redirects
      if (action === 'afterDelete') {
        await handleContentDeletion(event);
      }
    });

    // Handle slug changes with automatic redirect creation
    async function handleSlugChanges(event) {
      const { action, model, params, result } = event;
      
      // Only handle update events
      if (action !== 'beforeUpdate' && action !== 'afterUpdate') return;
      
      // Skip system content types
      if (model.uid.startsWith('admin::') || model.uid.startsWith('plugin::')) return;
      
      // Check if model has a slug attribute
      const hasSlug = model.attributes.slug && model.attributes.slug.type === 'uid';
      if (!hasSlug) return;

      if (action === 'beforeUpdate') {
        // Store the old slug before update
        if (params.where && params.where.id) {
          try {
            const oldEntity = await strapi.entityService.findOne(model.uid, params.where.id, {
              fields: ['slug'],
            });
            
            if (oldEntity && oldEntity.slug) {
              // Store old slug in a temporary cache
              strapi._slugCache = strapi._slugCache || new Map();
              strapi._slugCache.set(`${model.uid}:${params.where.id}`, oldEntity.slug);
            }
          } catch (error) {
            strapi.log.debug('Could not fetch old slug for redirect:', error.message);
          }
        }
      }

      if (action === 'afterUpdate' && result) {
        // Check if slug changed and create redirect
        const entityId = result.id || (params.where && params.where.id);
        const cacheKey = `${model.uid}:${entityId}`;
        
        if (strapi._slugCache && strapi._slugCache.has(cacheKey)) {
          const oldSlug = strapi._slugCache.get(cacheKey);
          const newSlug = result.slug;
          
          // Clean up cache
          strapi._slugCache.delete(cacheKey);
          
          if (oldSlug && newSlug && oldSlug !== newSlug) {
            await createAutoRedirect(model, oldSlug, newSlug);
          } else if (oldSlug === newSlug) {
            strapi.log.debug(`Slug unchanged for ${model.uid}, no redirect needed: ${oldSlug}`);
          }
        }
      }
    }

    // Handle content deletion - deactivate orphaned redirects
    async function handleContentDeletion(event) {
      const { model, params } = event;
      
      // Skip system content types
      if (model.uid.startsWith('admin::') || model.uid.startsWith('plugin::')) return;
      
      // Check if model has a slug attribute
      const hasSlug = model.attributes.slug && model.attributes.slug.type === 'uid';
      if (!hasSlug) return;

      try {
        // Auto-generate URL pattern from content type name
        const contentTypeName = model.uid.replace('api::', '').replace(/\..+$/, '');
        const pluralName = model.info?.pluralName || contentTypeName + 's';
        
        // We don't know the deleted slug, so we'll find redirects pointing to this content type
        // and deactivate ones that no longer have valid targets
        const allRedirects = await strapi.entityService.findMany('api::redirect.redirect', {
          filters: { 
            toPath: { $startsWith: `/${pluralName}/` },
            isActive: true 
          }
        });

        // Check which redirects point to non-existent content
        for (const redirect of allRedirects) {
          const slug = redirect.toPath.replace(`/${pluralName}/`, '');
          const exists = await strapi.entityService.count(model.uid, {
            filters: { slug }
          });
          
          if (exists === 0) {
            // Deactivate redirect to deleted content
            await strapi.entityService.update('api::redirect.redirect', redirect.id, {
              data: {
                isActive: false,
                description: `${redirect.description} (Deactivated: target content deleted)`
              }
            });
            
            strapi.log.info(`🗑️ Deactivated redirect to deleted content: ${redirect.toPath}`);
          }
        }
      } catch (error) {
        strapi.log.error(`Failed to handle content deletion for ${model.uid}:`, error.message);
      }
    }

    // Smart redirect creation with chain resolution and loop prevention
    async function createAutoRedirect(model, oldSlug, newSlug) {
      try {
        // Get frontend URL mappings from Global settings
        const globalSettings = await strapi.entityService.findMany('api::global.global', { limit: 1 });
        const redirectMappings = globalSettings[0]?.redirectUrlMappings || { article: 'blog' };
        
        // Get frontend URL pattern from configuration
        const contentTypeName = model.uid.replace('api::', '').replace(/\..+$/, '');
        const frontendPath = redirectMappings[contentTypeName] || model.info?.pluralName || contentTypeName + 's';
        
        const oldPath = `/${frontendPath}/${oldSlug}`;
        const newPath = `/${frontendPath}/${newSlug}`;
        
        // SMART REDIRECT LOGIC
        
        // 1. First check if direct redirect already exists
        const existingRedirect = await strapi.entityService.findMany('api::redirect.redirect', {
          filters: { fromPath: oldPath },
          limit: 1,
        });

        if (existingRedirect && existingRedirect.length > 0) {
          strapi.log.info(`🔄 Redirect already exists: ${oldPath}`);
          return;
        }

        // 2. Check for potential chains and resolve them
        const chainRedirects = await strapi.entityService.findMany('api::redirect.redirect', {
          filters: { 
            toPath: oldPath,  // Other redirects pointing to our old path
            isActive: true 
          },
        });

        // Update chain redirects to point directly to new path
        for (const chainRedirect of chainRedirects) {
          // 🚫 PREVENT SELF-REFERENCING CHAINS
          if (chainRedirect.fromPath === newPath) {
            strapi.log.info(`🚫 Skipping chain update to prevent self-loop: ${chainRedirect.fromPath} → ${newPath}`);
            continue;
          }
          
          await strapi.entityService.update('api::redirect.redirect', chainRedirect.id, {
            data: {
              toPath: newPath,
              description: `🔗 Chain resolved: ${model.info?.displayName || contentTypeName} slug changed to "${newSlug}"`
            }
          });
          
          strapi.log.info(`🔗 Resolved redirect chain: ${chainRedirect.fromPath} now points to ${newPath}`);
        }

        // 3. Prevent self-referencing redirects
        if (oldPath === newPath) {
          strapi.log.debug(`🚫 Skipping self-referencing redirect: ${oldPath} → ${newPath}`);
          return;
        }

        // 3.5. Prevent redirect loops (A→B when B→A already exists)
        const reverseRedirect = await strapi.entityService.findMany('api::redirect.redirect', {
          filters: { 
            fromPath: newPath, 
            toPath: oldPath,
            isActive: true 
          },
          limit: 1,
        });

        if (reverseRedirect && reverseRedirect.length > 0) {
          strapi.log.info(`🔄 Loop detected: ${oldPath} → ${newPath} conflicts with existing ${newPath} → ${oldPath}`);
          // Instead of creating a new redirect, update the existing one to reverse direction
          await strapi.entityService.update('api::redirect.redirect', reverseRedirect[0].id, {
            data: {
              fromPath: oldPath,
              toPath: newPath,
              description: `🔄 Updated direction: ${model.info?.displayName || contentTypeName} slug changed from "${oldSlug}" to "${newSlug}"`
            }
          });
          strapi.log.info(`🔄 Reversed existing redirect: ${oldPath} → ${newPath}`);
          return; // Don't create a new redirect, we updated the existing one
        }

        // 4. Create new redirect
        const redirectData = {
          fromPath: oldPath,
          toPath: newPath,
          statusCode: 301,
          isActive: true,
          priority: 100,
          description: `🤖 Auto-generated: ${model.info?.displayName || contentTypeName} slug changed from "${oldSlug}" to "${newSlug}"`,
        };

        const redirect = await strapi.entityService.create('api::redirect.redirect', {
          data: redirectData,
        });

        strapi.log.info(`✨ Smart redirect created: ${oldPath} → ${newPath}`);
        return redirect;
      } catch (error) {
        strapi.log.error(`❌ Failed to create auto-redirect for ${model.uid}:`, error.message);
      }
    }

    strapi.log.info('🔥 SMART Auto-Redirect System activated! Handles chains & reverts automatically! �');
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   */
  bootstrap,
};
