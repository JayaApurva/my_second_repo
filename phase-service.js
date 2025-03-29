/*
 * Resource Phase Service with Prisma implementation
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
 * Build DB phase model
 * @param {Object} phase the phase to build
 * @returns {Object} the DB phase
 */
function buildDBPhase(phase) {
  const dbPhase = {
    id: phase.id,
    name: phase.name,
    description: phase.description,
    created: phase.created ? new Date(phase.created) : new Date(),
    createdBy: phase.createdBy,
    updated: phase.updated ? new Date(phase.updated) : new Date(),
    updatedBy: phase.updatedBy
  }
  return dbPhase
}

/**
 * Transform DB phase to API phase
 * @param {Object} phase the DB phase
 * @returns {Object} the API phase
 */
function transformPhase(phase) {
  if (!phase) return null

  return _.pick(phase, [
    'id', 'name', 'description', 
    'created', 'createdBy', 'updated', 'updatedBy'
  ])
}

/**
 * Validate phase
 * @param {Object} phase the phase to validate
 * @returns {undefined}
 */
function validatePhase(phase) {
  const schema = Joi.object().keys({
    id: Joi.string().uuid(),
    name: Joi.string().required(),
    description: Joi.string().allow(null),
    created: Joi.date(),
    createdBy: Joi.string().required(),
    updated: Joi.date(),
    updatedBy: Joi.string().allow(null)
  }).required()

  const { error } = schema.validate(phase)
  if (error) {
    throw new errors.ValidationError(`Invalid phase data: ${error.message}`)
  }
}

/**
 * Get phase by id
 * @param {String} id the phase id
 * @returns {Object} phase
 */
async function getPhase(id) {
  logger.debug(`Get phase by id ${id}`)

  const phase = await prisma.phase.findUnique({
    where: { id }
  })

  if (!phase) {
    throw new errors.NotFoundError(`Phase with id ${id} not found`)
  }

  return transformPhase(phase)
}

/**
 * Create phase
 * @param {Object} phase the phase to create
 * @returns {Object} the created phase
 */
async function createPhase(phase) {
  logger.debug(`Create phase ${JSON.stringify(phase)}`)
  validatePhase(phase)

  // Check if name is already used
  const existingPhase = await prisma.phase.findUnique({
    where: { name: phase.name }
  })

  if (existingPhase) {
    throw new errors.ConflictError(`Phase with name ${phase.name} already exists`)
  }

  // Build DB model
  const dbPhase = buildDBPhase(phase)
  
  // If id is not provided, generate one
  if (!dbPhase.id) {
    dbPhase.id = helper.generateUUID()
  }

  // Create phase
  const created = await prisma.phase.create({
    data: dbPhase
  })

  return transformPhase(created)
}

/**
 * Update phase
 * @param {String} id the phase id
 * @param {Object} data the data to update
 * @returns {Object} the updated phase
 */
async function updatePhase(id, data) {
  logger.debug(`Update phase ${id} with ${JSON.stringify(data)}`)
  
  // Get existing phase
  const existingPhase = await prisma.phase.findUnique({
    where: { id }
  })

  if (!existingPhase) {
    throw new errors.NotFoundError(`Phase with id ${id} not found`)
  }

  // Check if name is already used by another phase
  if (data.name && data.name !== existingPhase.name) {
    const phaseWithName = await prisma.phase.findUnique({
      where: { name: data.name }
    })

    if (phaseWithName) {
      throw new errors.ConflictError(`Phase with name ${data.name} already exists`)
    }
  }

  // Prepare data for update
  const updateData = {
    name: data.name || existingPhase.name,
    description: _.isUndefined(data.description) ? existingPhase.description : data.description,
    updated: new Date(),
    updatedBy: data.updatedBy || existingPhase.updatedBy
  }

  // Update phase
  const updated = await prisma.phase.update({
    where: { id },
    data: updateData
  })

  return transformPhase(updated)
}

/**
 * Delete phase
 * @param {String} id the phase id
 */
async function deletePhase(id) {
  logger.debug(`Delete phase ${id}`)

  const existingPhase = await prisma.phase.findUnique({
    where: { id }
  })

  if (!existingPhase) {
    throw new errors.NotFoundError(`Phase with id ${id} not found`)
  }

  // Check if phase is used by any resource
  const resourcePhaseCount = await prisma.resourcePhase.count({
    where: { phaseId: id }
  })

  if (resourcePhaseCount > 0) {
    throw new errors.ConflictError(`Phase ${id} is used by ${resourcePhaseCount} resource(s)`)
  }

  await prisma.phase.delete({
    where: { id }
  })
}

/**
 * Search phases
 * @param {Object} criteria the search criteria
 * @returns {Object} the search result
 */
async function searchPhases(criteria) {
  logger.debug(`Search phases with ${JSON.stringify(criteria)}`)
  
  const page = criteria.page || 1
  const perPage = criteria.perPage || 20
  const skip = (page - 1) * perPage
  
  // Construct where conditions
  const whereConditions = {}
  if (criteria.name) {
    whereConditions.name = { contains: criteria.name, mode: 'insensitive' }
  }

  // Count total records
  const totalCount = await prisma.phase.count({
    where: whereConditions
  })

  // Get phases
  const phases = await prisma.phase.findMany({
    where: whereConditions,
    skip,
    take: perPage,
    orderBy: {
      name: 'asc'
    }
  })

  // Transform phases
  const transformedPhases = phases.map(transformPhase)

  return {
    total: totalCount,
    page,
    perPage,
    result: transformedPhases
  }
}

module.exports = {
  getPhase,
  createPhase,
  updatePhase,
  deletePhase,
  searchPhases
}
