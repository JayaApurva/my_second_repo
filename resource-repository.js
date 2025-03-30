/**
 * This module contains the repository methods for resource
 * using Prisma ORM for PostgreSQL.
 */

const prisma = require('../common/prisma')
const { NotFoundError } = require('../common/errors')
const helper = require('../common/helper')
const logger = require('../common/logger')

/**
 * Create resource in database
 * @param {Object} data the data to create resource
 * @returns {Object} the created resource
 */
async function create (data) {
  try {
    return await prisma.resource.create({
      data: {
        ...data
      }
    })
  } catch (error) {
    logger.error(error)
    throw error
  }
}

/**
 * Get resource by id
 * @param {String} id the resource id
 * @returns {Object} the resource
 */
async function getById (id) {
  try {
    const resource = await prisma.resource.findUnique({
      where: { id }
    })

    if (!resource || resource.deleted) {
      throw new NotFoundError(`Resource with id: ${id} doesn't exist`)
    }

    return resource
  } catch (error) {
    logger.error(error)
    throw error
  }
}

/**
 * Update resource in database
 * @param {String} id the resource id
 * @param {Object} data the data to update resource
 * @returns {Object} the updated resource
 */
async function update (id, data) {
  try {
    // Check if resource exists
    await getById(id)

    return await prisma.resource.update({
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
 * Partially update resource in database
 * @param {String} id the resource id
 * @param {Object} data the data to update resource
 * @returns {Object} the updated resource
 */
async function partialUpdate (id, data) {
  return update(id, data)
}

/**
 * Delete resource from database (soft delete)
 * @param {String} id the resource id
 */
async function remove (id) {
  try {
    // Check if resource exists
    await getById(id)

    await prisma.resource.update({
      where: { id },
      data: {
        deleted: true,
        updated: new Date()
      }
    })
  } catch (error) {
    logger.error(error)
    throw error
  }
}

/**
 * Search resources in database
 * @param {Object} criteria the search criteria
 * @returns {Object} the search result
 */
async function search (criteria) {
  const { page, perPage, memberId, challengeId, roleId, fields } = criteria

  // Construct where clause
  const whereClause = {
    deleted: false
  }

  if (memberId) {
    whereClause.memberId = memberId
  }

  if (challengeId) {
    whereClause.challengeId = challengeId
  }

  if (roleId) {
    whereClause.roleId = roleId
  }

  try {
    // Get total count
    const total = await prisma.resource.count({
      where: whereClause
    })

    // Calculate pagination
    const result = await helper.pagedResult(
      prisma.resource,
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
