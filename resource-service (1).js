/*
 * Resource Service with Prisma implementation
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
 * Build DB resource model
 * @param {Object} resource the resource to build
 * @returns {Object} the DB resource
 */
function buildDBResource(resource) {
  const dbResource = {
    id: resource.id,
    challengeId: resource.challengeId,
    memberId: resource.memberId,
    memberHandle: resource.memberHandle,
    roleId: resource.roleId,
    created: resource.created ? new Date(resource.created) : new Date(),
    createdBy: resource.createdBy,
    updated: resource.updated ? new Date(resource.updated) : new Date(),
    updatedBy: resource.updatedBy,
    legacyId: resource.legacyId
  }
  return dbResource
}

/**
 * Transform DB resource to API resource
 * @param {Object} resource the DB resource
 * @param {Boolean} includeRole whether to include role info
 * @param {Boolean} includePhases whether to include phases info
 * @returns {Object} the API resource
 */
function transformResource(resource, includeRole = false, includePhases = false) {
  if (!resource) return null

  const result = _.pick(resource, [
    'id', 'challengeId', 'memberId', 'memberHandle', 'roleId',
    'created', 'createdBy', 'updated', 'updatedBy', 'legacyId'
  ])

  if (includeRole && resource.role) {
    result.role = _.pick(resource.role, [
      'id', 'name', 'fullAccess', 'selfObtainable'
    ])
  }

  if (includePhases && resource.resourcePhases) {
    result.phases = resource.resourcePhases.map(rp => {
      const phase = _.pick(rp.phase, ['id', 'name', 'description'])
      return phase
    })
  }

  return result
}

/**
 * Validate resource
 * @param {Object} resource the resource to validate
 * @returns {undefined}
 */
function validateResource(resource) {
  const schema = Joi.object().keys({
    id: Joi.string().uuid(),
    challengeId: Joi.string().allow(null),
    memberId: Joi.string().allow(null),
    memberHandle: Joi.string().allow(null),
    roleId: Joi.string().required(),
    created: Joi.date(),
    createdBy: Joi.string().required(),
    updated: Joi.date(),
    updatedBy: Joi.string().allow(null),
    legacyId: Joi.string().allow(null),
    phases: Joi.array().items(Joi.string().uuid())
  }).required()

  const { error } = schema.validate(resource)
  if (error) {
    throw new errors.ValidationError(`Invalid resource data: ${error.message}`)
  }

  // Either challengeId or memberId should be provided
  if (!resource.challengeId && !resource.memberId) {
    throw new errors.ValidationError('Either challengeId or memberId must be provided')
  }
}

/**
 * Get resource by id
 * @param {String} id the resource id
 * @param {Boolean} includeRole whether to include role info
 * @param {Boolean} includePhases whether to include phases info
 * @returns {Object} resource
 */
async function getResource(id, includeRole = false, includePhases = false) {
  logger.debug(`Get resource by id ${id}`)

  const resource = await prisma.resource.findUnique({
    where: { id },
    include: {
      role: includeRole,
      resourcePhases: includePhases ? {
        include: {
          phase: true
        }
      } : false
    }
  })

  if (!resource) {
    throw new errors.NotFoundError(`Resource with id ${id} not found`)
  }

  return transformResource(resource, includeRole, includePhases)
}

/**
 * Create resource
 * @param {Object} resource the resource to create
 * @returns {Object} the created resource
 */
async function createResource(resource) {
  logger.debug(`Create resource ${JSON.stringify(resource)}`)
  validateResource(resource)

  // Check if role exists
  const role = await prisma.role.findUnique({
    where: { id: resource.roleId }
  })

  if (!role) {
    throw new errors.BadRequestError(`Role with id ${resource.roleId} does not exist`)
  }

  // Check if the resource with same challengeId, memberId and roleId already exists
  const whereCondition = {
    roleId: resource.roleId
  }

  if (resource.challengeId) {
    whereCondition.challengeId = resource.challengeId
  }

  if (resource.memberId) {
    whereCondition.memberId = resource.memberId
  }

  const existingResource = await prisma.resource.findFirst({
    where: whereCondition
  })

  if (existingResource) {
    throw new errors.ConflictError('Resource with the same challengeId/memberId and roleId already exists')
  }

  // Extract phase ids for later use
  const phaseIds = resource.phases || []
  delete resource.phases

  // Build DB model
  const dbResource = buildDBResource(resource)
  
  // If id is not provided, generate one
  if (!dbResource.id) {
    dbResource.id = helper.generateUUID()
  }

  // Create resource with transaction to handle phases
  const result = await prisma.$transaction(async (tx) => {
    // Create resource
    const created = await tx.resource.create({
      data: dbResource
    })
    
    // Create resource phases if provided
    if (phaseIds.length > 0) {
      const resourcePhases = phaseIds.map(phaseId => {
        return {
          id: helper.generateUUID(),
          resourceId: created.id,
          phaseId,
          created: new Date(),
          createdBy: resource.createdBy,
          updated: new Date(),
          updatedBy: resource.updatedBy
        }
      })
      
      await tx.resourcePhase.createMany({
        data: resourcePhases
      })
    }
    
    // Return resource with phases if requested
    return tx.resource.findUnique({
      where: { id: created.id },
      include: {
        role: true,
        resourcePhases: {
          include: {
            phase: true
          }
        }
      }
    })
  })

  return transformResource(result, true, true)
}

/**
 * Update resource
 * @param {String} id the resource id
 * @param {Object} data the data to update
 * @returns {Object} the updated resource
 */
async function updateResource(id, data) {
  logger.debug(`Update resource ${id} with ${JSON.stringify(data)}`)
  
  // Get existing resource
  const existingResource = await prisma.resource.findUnique({
    where: { id }
  })

  if (!existingResource) {
    throw new errors.NotFoundError(`Resource with id ${id} not found`)
  }

  // Check if role exists if roleId is provided
  if (data.roleId) {
    const role = await prisma.role.findUnique({
      where: { id: data.roleId }
    })

    if (!role) {
      throw new errors.BadRequestError(`Role with id ${data.roleId} does not exist`)
    }
  }

  // Check if the resource with same challengeId, memberId and roleId already exists
  if (data.challengeId || data.memberId || data.roleId) {
    const whereCondition = {
      roleId: data.roleId || existingResource.roleId,
      id: { not: id }
    }

    if (data.challengeId || existingResource.challengeId) {
      whereCondition.challengeId = data.challengeId || existingResource.challengeId
    }

    if (data.memberId || existingResource.memberId) {
      whereCondition.memberId = data.memberId || existingResource.memberId
    }

    const duplicateResource = await prisma.resource.findFirst({
      where: whereCondition
    })

    if (duplicateResource) {
      throw new errors.ConflictError('Resource with the same challengeId/memberId and roleId already exists')
    }
  }

  // Extract phase ids for later use
  const phaseIds = data.phases || []
  delete data.phases

  // Prepare data for update
  const updateData = {
    challengeId: _.isUndefined(data.challengeId) ? existingResource.challengeId : data.challengeId,
    memberId: _.isUndefined(data.memberId) ? existingResource.memberId : data.memberId,
    memberHandle: _.isUndefined(data.memberHandle) ? existingResource.memberHandle : data.memberHandle,
    roleId: data.roleId || existingResource.roleId,
    updated: new Date(),
    updatedBy: data.updatedBy || existingResource.updatedBy,
    legacyId: _.isUndefined(data.legacyId) ? existingResource.legacyId : data.legacyId
  }

  // Update resource with transaction to handle phases
  const result = await prisma.$transaction(async (tx) => {
    // Update resource
    const updated = await tx.resource.update({
      where: { id },
      data: updateData
    })
    
    // Update resource phases if provided
    if (phaseIds.length > 0) {
      // Delete existing resource phases
      await tx.resourcePhase.deleteMany({
        where: { resourceId: id }
      })
      
      // Create new resource phases
      const resourcePhases = phaseIds.map(phaseId => {
        return {
          id: helper.generateUUID(),
          resourceId: id,
          phaseId,
          created: new Date(),
          createdBy: data.updatedBy || existingResource.updatedBy,
          updated: new Date(),
          updatedBy: data.updatedBy || existingResource.updatedBy
        }
      })
      
      await tx.resourcePhase.createMany({
        data: resourcePhases
      })
    }
    
    // Return resource with phases
    return tx.resource.findUnique({
      where: { id },
      include: {
        role: true,
        resourcePhases: {
          include: {
            phase: true
          }
        }
      }
    })
  })

  return transformResource(result, true, true)
}

/**
 * Delete resource
 * @param {String} id the resource id
 */
async function deleteResource(id) {
  logger.debug(`Delete resource ${id}`)

  const existingResource = await prisma.resource.findUnique({
    where: { id }
  })

  if (!existingResource) {
    throw new errors.NotFoundError(`Resource with id ${id} not found`)
  }

  // Delete resource - thanks to onDelete: Cascade in the schema, all related resourcePhases will be deleted
  await prisma.resource.delete({
    where: { id }
  })
}

/**
 * Search resources
 * @param {Object} criteria the search criteria
 * @returns {Object} the search result
 */
async function searchResources(criteria) {
  logger.debug(`Search resources with ${JSON.stringify(criteria)}`)
  
  const page = criteria.page || 1
  const perPage = criteria.perPage || 20
  const skip = (page - 1) * perPage
  
  // Construct where conditions
  const whereConditions = {}
  if (criteria.challengeId) {
    whereConditions.challengeId = criteria.challengeId
  }
  if (criteria.memberId) {
    whereConditions.memberId = criteria.memberId
  }
  if (criteria.memberHandle) {
    whereConditions.memberHandle = { contains: criteria.memberHandle, mode: 'insensitive' }
  }
  if (criteria.roleId) {
    whereConditions.roleId = criteria.roleId
  }
  if (criteria.legacyId) {
    whereConditions.legacyId = criteria.legacyId
  }

  // Count total records
  const totalCount = await prisma.resource.count({
    where: whereConditions
  })

  // Get resources
  const resources = await prisma.resource.findMany({
    where: whereConditions,
    skip,
    take: perPage,
    include: {
      role: criteria.includeRole === true,
      resourcePhases: criteria.includePhases === true ? {
        include: {
          phase: true
        }
      } : false
    },
    orderBy: {
      created: 'desc'
    }
  })

  // Transform resources
  const transformedResources = resources.map(resource => 
    transformResource(resource, criteria.includeRole === true, criteria.includePhases === true)
  )

  return {
    total: totalCount,
    page,
    perPage,
    result: transformedResources
  }
}

module.exports = {
  getResource,
  createResource,
  updateResource,
  deleteResource,
  searchResources
}
