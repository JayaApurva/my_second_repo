/**
 * Script to seed the database with data from the existing Topcoder Dev API
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const logger = require('../src/common/logger');
const helper = require('../src/common/helper');

const prisma = new PrismaClient();
const API_BASE_URL = 'https://api.topcoder-dev.com/v5';

/**
 * Fetch data from the Topcoder Dev API
 * @param {String} endpoint - API endpoint
 * @returns {Array} - Array of fetched data
 */
async function fetchData(endpoint) {
  try {
    logger.info(`Fetching data from ${API_BASE_URL}${endpoint}`);
    const response = await axios.get(`${API_BASE_URL}${endpoint}`);
    return response.data.result || [];
  } catch (error) {
    logger.error(`Error fetching data from ${endpoint}: ${error.message}`);
    throw error;
  }
}

/**
 * Seed roles into the database
 */
async function seedRoles() {
  try {
    logger.info('Seeding roles...');
    const roles = await fetchData('/resource-roles');
    
    for (const role of roles) {
      // Transform role to match our schema
      const roleData = {
        id: role.id || helper.generateUUID(),
        name: role.name,
        fullAccess: role.fullAccess || false,
        selfObtainable: role.selfObtainable || false,
        createdBy: 'SEED_SCRIPT',
        legacyId: role.id
      };
      
      // Check if role already exists
      const existingRole = await prisma.role.findUnique({
        where: { name: roleData.name }
      });
      
      if (existingRole) {
        logger.info(`Role ${roleData.name} already exists, skipping`);
        continue;
      }
      
      // Create role
      await prisma.role.create({ data: roleData });
      logger.info(`Created role: ${roleData.name}`);
    }
    
    logger.info(`Successfully seeded ${roles.length} roles`);
  } catch (error) {
    logger.error(`Error seeding roles: ${error.message}`);
    throw error;
  }
}

/**
 * Seed phases into the database
 */
async function seedPhases() {
  try {
    logger.info('Seeding phases...');
    const phases = await fetchData('/resource-phases');
    
    for (const phase of phases) {
      // Transform phase to match our schema
      const phaseData = {
        id: phase.id || helper.generateUUID(),
        name: phase.name,
        description: phase.description || null,
        createdBy: 'SEED_SCRIPT'
      };
      
      // Check if phase already exists
      const existingPhase = await prisma.phase.findUnique({
        where: { name: phaseData.name }
      });
      
      if (existingPhase) {
        logger.info(`Phase ${phaseData.name} already exists, skipping`);
        continue;
      }
      
      // Create phase
      await prisma.phase.create({ data: phaseData });
      logger.info(`Created phase: ${phaseData.name}`);
    }
    
    logger.info(`Successfully seeded ${phases.length} phases`);
  } catch (error) {
    logger.error(`Error seeding phases: ${error.message}`);
    throw error;
  }
}

/**
 * Seed resources into the database
 */
async function seedResources() {
  try {
    logger.info('Seeding resources...');
    // Fetching a limited number of resources for testing
    const resources = await fetchData('/resources?perPage=50');
    
    // Get all roles from DB for mapping
    const roles = await prisma.role.findMany();
    const roleMap = new Map(roles.map(role => [role.legacyId, role.id]));
    
    let createdCount = 0;
    for (const resource of resources) {
      try {
        // Map legacy role ID to new role ID
        const roleId = roleMap.get(resource.roleId) || resource.roleId;
        
        // Transform resource to match our schema
        const resourceData = {
          id: resource.id || helper.generateUUID(),
          challengeId: resource.challengeId,
          memberId: resource.memberId,
          memberHandle: resource.memberHandle,
          roleId: roleId,
          createdBy: 'SEED_SCRIPT',
          legacyId: resource.id
        };
        
        // Check if resource already exists
        const existingResource = await prisma.resource.findUnique({
          where: { id: resourceData.id }
        });
        
        if (existingResource) {
          logger.info(`Resource ${resourceData.id} already exists, skipping`);
          continue;
        }
        
        // Create resource
        await prisma.resource.create({ data: resourceData });
        createdCount++;
        
        // Fetch and seed resource phases if any
        if (resource.phases && resource.phases.length > 0) {
          await seedResourcePhases(resourceData.id, resource.phases);
        }
      } catch (error) {
        logger.error(`Error processing resource ${resource.id}: ${error.message}`);
        // Continue with next resource
      }
    }
    
    logger.info(`Successfully seeded ${createdCount} resources out of ${resources.length}`);
  } catch (error) {
    logger.error(`Error seeding resources: ${error.message}`);
    throw error;
  }
}

/**
 * Seed resource phases for a specific resource
 * @param {String} resourceId - Resource ID
 * @param {Array} phaseIds - Array of phase IDs
 */
async function seedResourcePhases(resourceId, phaseIds) {
  try {
    for (const phaseId of phaseIds) {
      // Check if phase exists
      const phase = await prisma.phase.findUnique({
        where: { id: phaseId }
      });
      
      if (!phase) {
        logger.warn(`Phase ${phaseId} not found, skipping`);
        continue;
      }
      
      // Check if resource phase already exists
      const existingResourcePhase = await prisma.resourcePhase.findFirst({
        where: {
          resourceId,
          phaseId
        }
      });
      
      if (existingResourcePhase) {
        logger.info(`Resource phase for resource ${resourceId} and phase ${phaseId} already exists, skipping`);
        continue;
      }
      
      // Create resource phase
      await prisma.resourcePhase.create({
        data: {
          id: helper.generateUUID(),
          resourceId,
          phaseId,
          createdBy: 'SEED_SCRIPT'
        }
      });
      
      logger.info(`Created resource phase for resource ${resourceId} and phase ${phaseId}`);
    }
  } catch (error) {
    logger.error(`Error seeding resource phases for resource ${resourceId}: ${error.message}`);
    // Continue with next resource
  }
}

/**
 * Main seed function
 */
async function seed() {
  try {
    logger.info('Starting database seeding...');
    
    // Seed data in order of dependencies
    await seedRoles();
    await seedPhases();
    await seedResources();
    
    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error(`Database seeding failed: ${error.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seed();
