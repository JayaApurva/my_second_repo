/**
 * Seed script to populate the database with test data.
 */
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')
const logger = require('../src/common/logger')

const prisma = new PrismaClient()

/**
 * Main seeding function
 */
async function main() {
  try {
    logger.info('Starting database seeding...')

    // Load resource roles data
    const resourceRolesPath = path.join(__dirname, '../data/resource-roles.json')
    if (fs.existsSync(resourceRolesPath)) {
      const resourceRolesData = JSON.parse(fs.readFileSync(resourceRolesPath, 'utf8'))
      logger.info(`Loaded ${resourceRolesData.length} resource roles`)

      // Insert resource roles
      for (const role of resourceRolesData) {
        await prisma.resourceRole.upsert({
          where: { id: role.id },
          update: {},
          create: {
            id: role.id,
            name: role.name,
            nameLower: role.name.toLowerCase(),
            fullAccess: role.fullAccess || false,
            isActive: role.isActive !== false,
            selfObtainable: role.selfObtainable || false,
            legacyId: role.legacyId,
            createdBy: role.createdBy || 'seeder',
            updatedBy: role.updatedBy
          }
        })
      }
      logger.info('Resource roles seeded successfully')
    } else {
      logger.warn('Resource roles data file not found. Skipping resource roles seeding.')
    }

    // Load resource role phase dependencies data
    const rolePhaseDepsPath = path.join(__dirname, '../data/resource-role-phase-dependencies.json')
    if (fs.existsSync(rolePhaseDepsPath)) {
      const rolePhaseDepsData = JSON.parse(fs.readFileSync(rolePhaseDepsPath, 'utf8'))
      logger.info(`Loaded ${rolePhaseDepsData.length} resource role phase dependencies`)

      // Insert resource role phase dependencies
      for (const dep of rolePhaseDepsData) {
        await prisma.resourceRolePhaseDependency.upsert({
          where: { id: dep.id },
          update: {},
          create: {
            id: dep.id,
            resourceRoleId: dep.resourceRoleId,
            phaseId: dep.phaseId,
            phaseType: dep.phaseType,
            createdBy: dep.createdBy || 'seeder',
            updatedBy: dep.updatedBy
          }
        })
      }
      logger.info('Resource role phase dependencies seeded successfully')
    } else {
      logger.warn('Resource role phase dependencies data file not found. Skipping dependencies seeding.')
    }

    // Load resources data
    const resourcesPath = path.join(__dirname, '../data/resources.json')
    if (fs.existsSync(resourcesPath)) {
      const resourcesData = JSON.parse(fs.readFileSync(resourcesPath, 'utf8'))
      logger.info(`Loaded ${resourcesData.length} resources`)

      // Insert resources
      for (const resource of resourcesData) {
        await prisma.resource.upsert({
          where: { id: resource.id },
          update: {},
          create: {
            id: resource.id,
            challengeId: resource.challengeId,
            memberId: resource.memberId,
            roleId: resource.roleId,
            created: new Date(resource.created || resource.createdAt || Date.now()),
            updated: new Date(resource.updated || resource.updatedAt || Date.now()),
            createdBy: resource.createdBy || 'seeder',
            updatedBy: resource.updatedBy,
            deleted: resource.deleted || false
          }
        })
      }
      logger.info('Resources seeded successfully')
    } else {
      logger.warn('Resources data file not found. Skipping resources seeding.')
    }

    logger.info('Database seeding completed successfully')
  } catch (error) {
    logger.error(`Error seeding database: ${error.message}`)
    throw error
  }
}

// Run main function and handle errors
main()
  .catch((error) => {
    logger.error(error)
    process.exit(1)
  })
  .finally(async () => {
    // Close Prisma client connection
    await prisma.$disconnect()
  })
