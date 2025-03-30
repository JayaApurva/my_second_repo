/**
 * This module contains the repository methods for resource roles
 * using Prisma ORM for PostgreSQL.
 */

const prisma = require('../common/prisma')
const { NotFoundError } = require('../common/errors')
const helper = require('../common/helper')
const logger = require('../common/logger')

/**
 * Create resource role in database
 * @param {Object} data the data to create resource role
 * @returns {Object} the created resource role
 */
async function create (data) {
  try {
    return await prisma.resourceRole.create({
      data: {
        ...data,
        nameLower: data.name.toLowerCase()
      }
    })
  } catch (error) {
    logger.error(error)
    throw error
  }
}

/**
 * Get resource role by id
 * @param {String} id the resource role id
 * @returns {Object} the resource role
 */
async function getById (id) {
  try {
    const resourceRole = await prisma.resourceRole.findUnique({
      where: { id }
    })

    if (!resourceRole) {
      throw new NotFoundError(`Resource role with id: ${id} doesn't exist`)
    }

    return resourceRole
  } catch (error) {
    logger.error(error)
    throw error
  }
}

/**
 * Update resource role in database
 * @param {String} id the resource role id
 * @param {Object} data the data to update resource role
 * @returns {Object} the updated resource role
 */
async function update (id, data) {
  try {
    // Check if resource role exists
    await getById(id)

    const updateData = { ...data }
    if (data.name) {
      updateData.nameLower = data.name.toLowerCase()
    }

    return await prisma.resourceRole.update({
      where: { id },
      data: {
        ...updateData,
        updated: new Date()
      }
    })
  } catch (error) {
    logger.error(error)
    throw error
  }
}

/**
 * Partially update resource role in database
 * @param {String} id the resource role id
 * @param {Object} data the data to update resource role
 * @returns {Object} the updated resource role
 */
async function partialUpdate (id, data) {
  return update(id, data)
}

/**
 * Search resource roles in database
 * @param {Object} criteria the search criteria
 * @returns {Object} the search result
 */
async function search (criteria) {
  const { page, perPage, isActive, fields } = criteria

  // Construct where clause
  const whereClause = {}

  if (isActive !== undefined) {
    whereClause.isActive = isActive
  }

  try {
    // Get total count
    const total = await prisma.resourceRole.count({
      where: whereClause
    })

    // Calculate pagination
    const result = await helper.pagedResult(
      prisma.resourceRole,
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
  search
}
