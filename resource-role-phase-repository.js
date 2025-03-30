/**
 * This module contains the repository methods for resource role phase dependencies
 * using Prisma ORM for PostgreSQL.
 */

const prisma = require('../common/prisma')
const { NotFoundError } = require('../common/errors')
const helper = require('../common/helper')
const logger = require('../common/logger')

/**
 * Create resource role phase dependency in database
 * @param {Object} data the data to create resource role phase dependency
 * @returns {Object} the created resource role phase dependency
 */
async function create (data) {
  try {
    return await prisma.resourceRolePhaseDependency.create({
      data
    })
  } catch (error) {
    logger.error(error)
    throw error
  }
}

/**
 * Get resource role phase dependency by id
 * @param {String} id the resource role phase dependency id
 * @returns {Object} the resource role phase dependency
 */
async function getById (id) {
  try {
    const dependency = await prisma.resourceRolePhaseDependency.findUnique({
      where: { id }
    })

    if (!dependency) {
      throw new NotFoundError(`Resource role phase dependency with id: ${id} doesn't exist`)
    }

    return dependency
  } catch (error) {
    logger.error(error)
    throw error
  }
}

/**
 * Update resource role phase dependency in database
 * @param {String} id the resource role phase dependency id
 * @param {Object} data the data to update resource role phase dependency
 * @returns {Object} the updated resource role phase dependency
 */
async function update (id, data) {
  try {
    // Check if resource role phase dependency exists
    await getById(id)

    return await prisma.resourceRolePhaseDependency.update({
      where: { id },
      data: {
        ...data,
        updated: new Date()
      }
    })
  } catch (error) {
    logger.error(error)
    throw error
  }
}

/**
 * Partially update resource role phase dependency in database
 * @param {String} id the resource role phase dependency id
 * @param {Object} data the data to update resource role phase dependency
 * @returns {Object} the updated resource role phase dependency
 */
async function partialUpdate (id, data) {
  return update(id, data)
}

/**
 * Delete resource role phase dependency from database
 * @param {String} id the resource role phase dependency id
 */
async function remove (id) {
  try {
    // Check if resource role phase dependency exists
    await getById(id)

    await prisma.resourceRolePhaseDependency.delete({
      where: { id }
    })
  } catch (error) {
    logger.error(error)
    throw error
  }
}

/**
 * Search resource role phase dependencies in database
 * @param {Object} criteria the search criteria
 * @returns {Object} the search result
 */
async function search (criteria) {
  const { page, perPage, resourceRoleId, phaseId, phaseType, fields } = criteria

  // Construct where clause
  const whereClause = {}

  if (resourceRoleId) {
    whereClause.resourceRoleId = resourceRoleId
  }

  if (phaseId) {
    whereClause.phaseId = phaseId
  }

  if (phaseType) {
    whereClause.phaseType = phaseType
  }

  try {
    // Get total count
    const total = await prisma.resourceRolePhaseDependency.count({
      where: whereClause
    })

    // Calculate pagination
    const result = await helper.pagedResult(
      prisma.resourceRolePhaseDependency,
      whereClause,
      page,
      perPage,
      total,
      fields
    )
    
    return result
  } catch (error) {
    logger.error(error)
    throw error
  }
}

module.exports = {
  create,
  getById,
  update,
  partialUpdate,
  remove,
  search
}
