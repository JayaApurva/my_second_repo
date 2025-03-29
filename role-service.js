/*
 * Resource Role Service with Prisma implementation
 */

const _ = require('lodash')
const Joi = require('joi')
const config = require('config')
const { PrismaClient } = require('@prisma/client')
const helper = require('../common/helper')
const logger = require('../common/logger')
const errors = require('../common/errors')

const prisma = new PrismaClient()

/**
 * Build DB role model
 * @param {Object} role the role to build
 * @returns {Object} the DB role
 */
function buildDBRole(role) {
  const dbRole = {
    id: role.id,
    name: role.name,
    fullAccess: role.fullAccess || false,
    selfObtainable: role.selfObtainable || false,
    created: role.created ? new Date(role.created) : new Date(),
    createdBy: role.createdBy,
    updated: role.updated ? new Date(role.updated) : new Date(),
    updatedBy: role.updatedBy,
    legacyId: role.legacyId
  }
  return dbRole
}

/**
 * Transform DB role to API role
 * @param {Object} role the DB role
 * @returns {Object} the API role
 */
function transformRole(role) {
  if (!role) return null

  return _.pick(role, [
    'id', 'name', 'fullAccess', 'selfObtainable', 
    'created', 'createdBy', 'updated', 'updatedBy', 'legacyId'
  ])
}

/**
 * Validate role
 * @param {Object} role the role to validate
 * @returns {undefined}
 */
function validateRole(role) {
  const schema = Joi.object().keys({
    id: Joi.string().uuid(),
    name: Joi.string().required(),
    fullAccess: Joi.boolean(),
    selfObtainable: Joi.boolean(),
    created: Joi.date(),
    createdBy: Joi.string().required(),
    updated: Joi.date(),
    updatedBy: Joi.string().allow(null),
    legacyId: Joi.string().allow(null)
  }).required()

  const { error } = schema.validate(role)
  if (error) {
    throw new errors.ValidationError(`Invalid role data: ${error.message}`)
  }
}

/**
 * Get role by id
 * @param {String} id the role id
 * @returns {Object} role
 */
async function getRole(id) {
  logger.debug(`Get role by id ${id}`)

  const role = await prisma.role.findUnique({
    where: { id }
  })

  if (!role) {
    throw new errors.NotFoundError(`Role with id ${id} not found`)
  }

  return transformRole(role)
}

/**
 * Create role
 * @param {Object} role the role to create
 * @returns {Object} the created role
 */
async function createRole(role) {
  logger.debug(`Create role ${JSON.stringify(role)}`)
  validateRole(role)

  // Check if name is already used
  const existingRole = await prisma.role.findUnique({
    where: { name: role.name }
  })

  if (existingRole) {
    throw new errors.ConflictError(`Role with name ${role.name} already exists`)
  }

  // Build DB model
  const dbRole = buildDBRole(role)
  
  // If id is not provided, generate one
  if (!dbRole.id) {
    dbRole.id = helper.generateUUID()
  }

  // Create role
  const created = await prisma.role.create({
    data: dbRole
  })

  return transformRole(created)
}

/**
 * Update role
 * @param {String} id the role id
 * @param {Object} data the data to update
 * @returns {Object} the updated role
 */
async function updateRole(id, data) {
  logger.debug(`Update role ${id} with ${JSON.stringify(data)}`)
  
  // Get existing role
  const existingRole = await prisma.role.findUnique({
    where: { id }
  })

  if (!existingRole) {
    throw new errors.NotFoundError(`Role with id ${id} not found`)
  }

  // Check if name is already used by another role
  if (data.name && data.name !== existingRole.name) {
    const roleWithName = await prisma.role.findUnique({
      where: { name: data.name }
    })

    if (roleWithName) {
      throw new errors.ConflictError(`Role with name ${data.name} already exists`)
    }
  }

  // Prepare data for update
  const updateData = {
    name: data.name || existingRole.name,
    fullAccess: _.isUndefined(data.fullAccess) ? existingRole.fullAccess : data.fullAccess,
    selfObtainable: _.isUndefined(data.selfObtainable) ? existingRole.selfObtainable : data.selfObtainable,
    updated: new Date(),
    updatedBy: data.updatedBy || existingRole.updatedBy,
    legacyId: _.isUndefined(data.legacyId) ? existingRole.legacyId : data.legacyId
  }

  // Update role
  const updated = await prisma.role.update({
    where: { id },
    data: updateData
  })

  return transformRole(updated)
}

/**
 * Delete role
 * @param {String} id the role id
 */
async function deleteRole(id) {
  logger.debug(`Delete role ${id}`)

  const existingRole = await prisma.role.findUnique({
    where: { id }
  })

  if (!existingRole) {
    throw new errors.NotFoundError(`Role with id ${id} not found`)
  }

  // Check if role is used by any resource
  const resourceCount = await prisma.resource.count({
    where: { roleId: id }
  })

  if (resourceCount > 0) {
    throw new errors.ConflictError(`Role ${id} is used by ${resourceCount} resource(s)`)
  }

  await prisma.role.delete({
    where: { id }
  })
}

/**
 * Search roles
 * @param {Object} criteria the search criteria
 * @returns {Object} the search result
 */
async function searchRoles(criteria) {
  logger.debug(`Search roles with ${JSON.stringify(criteria)}`)
  
  const page = criteria.page || 1
  const perPage = criteria.perPage || 20
  const skip = (page - 1) * perPage
  
  // Construct where conditions
  const whereConditions = {}
  if (criteria.name) {
    whereConditions.name = { contains: criteria.name, mode: 'insensitive' }
  }
  if (!_.isUndefined(criteria.fullAccess)) {
    whereConditions.fullAccess = criteria.fullAccess
  }
  if (!_.isUndefined(criteria.selfObtainable)) {
    whereConditions.selfObtainable = criteria.selfObtainable
  }

  // Count total records
  const totalCount = await prisma.role.count({
    where: whereConditions
  })

  // Get roles
  const roles = await prisma.role.findMany({
    where: whereConditions,
    skip,
    take: perPage,
    orderBy: {
      name: 'asc'
    }
  })

  // Transform roles
  const transformedRoles = roles.map(transformRole)

  return {
    total: totalCount,
    page,
    perPage,
    result: transformedRoles
  }
}

module.exports = {
  getRole,
  createRole,
  updateRole,
  deleteRole,
  searchRoles
}
