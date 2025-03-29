/**
 * Seed data script to import data from the existing API
 * 
 * This script fetches data from the Topcoder Dev API and seeds it into the local database
 * using Prisma client.
 */

const axios = require('axios')
const { PrismaClient } = require('@prisma/client')
const logger = require('../common/logger')
const helper = require('../common/helper')

const prisma = new PrismaClient()

// API URLs
const API_BASE_URL = 'https://api.topcoder-dev.com/v5'
const ROLES_URL = `${API_BASE_URL}/resource-roles`
const RESOURCES_URL = `${API_BASE_URL}/resources`
const PHASES_URL = `${API_BASE_URL}/resource-phases`

/**
 * Fetch data from an API endpoint
 * @param {String} url the API URL
 * @returns {Array} the fetched data
 */
async function fetchData(url) {
  try {
    const response = await axios.get(url)
    return response.data
  } catch (error) {
    logger.error(`Error fetching data from ${url}: ${error.message}`)
    throw error
  }
}

/**
 * Seed roles data
 */
async function seedRoles() {
  logger.info('Seeding roles data...')
  
  // Fetch roles from API
  const rolesData = await fetchData(ROLES_URL)
  
  // Clear existing roles
  await prisma.role.deleteMany()
  
  // Insert roles
  for (const role of rolesData) {
    await prisma.role.create({
      data: {
        id: role.id,
        name: role.name,
        fullAccess: !!role.fullAccess,
        selfObtainable: !!role.selfObtainable,
        created: new Date(role.created),
        createdBy: role.createdBy || 'system',
        updated: new Date(role.updated || role.created),
        updatedBy: role.updatedBy || role.createdBy || 'system',
        legacyId: role.legacyId || null
      }
    })
  }
  
  logger.info(`Seeded ${rolesData.length} roles`)
}

/**
 * Seed phases data
 */
async function seedPhases() {
  logger.info('Seeding phases data...')
  
  // Fetch phases from API
  const phasesData = await fetchData(PHASES_URL)
  
  // Clear existing phases
  await prisma.phase.deleteMany()
  
  // Insert phases
  for (const phase of phasesData) {
    await prisma.phase.create({
      data: {
        id: phase.id,
        name: phase.name,
        description: phase.description || null,
        created: new Date(phase.created),
        createdBy: phase.createdBy || 'system',
        updated: new Date(phase.updated || phase.created),
        updatedBy: phase.updatedBy || phase.createdBy || 'system'
      }
    })
  }
  
  logger.info(`Seeded ${phasesData.length} phases`)
}

/**
 * Seed resources data
 */
async function seedResources() {
  logger.info('Seeding resources data...')
  
  // Fetch resources from API
  const resourcesData = await fetchData(RESOURCES_URL)
  
  // Clear existing resources and resource phases
  await prisma.resourcePhase.deleteMany()
  await prisma.resource.deleteMany()
  
  // Insert resources and resource phases
  for (const resource of resourcesData) {
    // Create resource
    const createdResource = await prisma.resource.create({
      data: {
        id: resource.id,
        challengeId: resource.challengeId || null,
        memberId: resource.memberId || null,
        memberHandle: resource.memberHandle || null,
        roleId: resource.roleId,
        created: new Date(resource.created),
        createdBy: resource.createdBy || 'system',
        updated: new Date(resource.updated || resource.created),
        updatedBy: resource.updatedBy || resource.createdBy || 'system',
        legacyId: resource.legacyId || null
      }
    })
    
    // Create resource phases if they exist
    if (resource.phases && resource.phases.length > 0) {
      for (const phase of resource.phases) {
        await prisma.resourcePhase.create({
          data: {
            id: helper.generateUUID(),
            resourceId: createdResource.id,
            phaseId: phase.id,
            created: new Date(),
            createdBy: resource.createdBy || 'system',
            updated: new Date(),
            updatedBy: resource.updatedBy || resource.createdBy || 'system'
          }
        })
      }
    }
  }
  
  logger.info(`Seeded ${resourcesData.length} resources`)
}

/**
 * Main seed function
 */
async function seedData() {
  try {
    logger.info('Starting data seeding...')
    
    // Seed in sequence to maintain relationships
    await seedRoles()
    await seedPhases()
    await seedResources()
    
    logger.info('Data seeding completed successfully!')
  } catch (error) {
    logger.error(`Error seeding data: ${error.message}`)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the seed function
seedData()
