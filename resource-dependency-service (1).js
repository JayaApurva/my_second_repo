/*
 * Resource Role Phase Dependency Service with Prisma implementation
 */

const _ = require('lodash')
const config = require('config')
const { PrismaClient } = require('@prisma/client')
const logger = require('../common/logger')
const errors = require('../common/errors')
const helper = require('../common/helper')

const prisma = new PrismaClient()

/**
 * Ensures the role phases dependency
 * @param {String} roleId the role id
 * @param {Array} phaseIds the phase ids
 */
async function ensureRolePhasesDependency(roleId, phaseIds) {
  logger.debug(`Ensure role phases dependency for role ${roleId} and phases ${JSON.stringify(phaseIds)}`)
  
  if (!phaseIds || phaseIds.length === 0) {
    return
  }
  
  // Check if role exists
  const role = await prisma.role.findUnique({
    where: { id: roleId }
  })

  if (!role) {
    throw new errors.NotFoundError(`Role with id ${roleId} not found`)
  }

  // Check if all phases exist
  for (const phaseId of phaseIds) {
    const phase = await prisma.phase.findUnique({
      where: { id: phaseId }
    })
    
    if (!phase) {
      throw new errors.NotFoundError(`Phase with id ${phaseId} not found`)
    }
  }
}

/**
 * Get resource phases
 * @param {String} resourceId the resource id
 * @returns {Array} the resource phases
 */
async function getResourcePhases(resourceId) {
  logger.debug(`Get resource phases for resource ${resourceId}`)
  
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: {
      resourcePhases: {
        include: {
          phase: true
        }
      }
    }
  })

  if (!resource) {
    throw new errors.NotFoundError(`Resource with id ${resourceId} not found`)
  }

  return resource.resourcePhases.map(rp => ({
    id: rp.phase.id,
    name: rp.phase.name,
    description: rp.phase.description
  }))
}

/**
 * Create resource phases
 * @param {String} resourceId the resource id
 * @param {Array} phaseIds the phase ids
 * @param {String} userId the user id
 * @returns {Array} the created resource phases
 */
async function createResourcePhases(resourceId, phaseIds, userId) {
  logger.debug(`Create resource phases for resource ${resourceId} and phases ${JSON.stringify(phaseIds)}`)
  
  if (!phaseIds || phaseIds.length === 0) {
    return []
  }
  
  // Check if resource exists
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: {
      role: true
    }
  })

  if (!resource) {
    throw new errors.NotFoundError(`Resource with id ${resourceId} not found`)
  }

  // Check if all phases exist and get their details
  const phases = []
  for (const phaseId of phaseIds) {
    const phase = await prisma.phase.findUnique({
      where: { id: phaseId }
    })
    
    if (!phase) {
      throw new errors.NotFoundError(`Phase with id ${phaseId} not found`)
    }
    
    phases.push(phase)
  }

  // Check if the resource already has any of these phases
  const existingResourcePhases = await prisma.resourcePhase.findMany({
    where: {
      resourceId,
      phaseId: {
        in: phaseIds
      }
    }
  })

  if (existingResourcePhases.length > 0) {
    const existingPhaseIds = existingResourcePhases.map(rp => rp.phaseId)
    throw new errors.ConflictError(`Resource ${resourceId} already has phases: ${existingPhaseIds.join(', ')}`)
  }

  // Ensure role-phase dependency
  await ensureRolePhasesDependency(resource.roleId, phaseIds)

  // Create resource phases
  const resourcePhases = phaseIds.map(phaseId => {
    return {
      id: helper.generateUUID(),
      resourceId,
      phaseId,
      created: new Date(),
      createdBy: userId,
      updated: new Date(),
      updatedBy: userId
    }
  })
  
  await prisma.resourcePhase.createMany({
    data: resourcePhases
  })

  return phases
}

/**
 * Delete resource phase
 * @param {String} resourceId the resource id
 * @param {String} phaseId the phase id
 */
async function deleteResourcePhase(resourceId, phaseId) {
  logger.debug(`Delete resource phase for resource ${resourceId} and phase ${phaseId}`)
  
  // Check if resource exists
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId }
  })

  if (!resource) {
    throw new errors.NotFoundError(`Resource with id ${resourceId} not found`)
  }

  // Check if phase exists
  const phase = await prisma.phase.findUnique({
    where: { id: phaseId }
  })
  
  if (!phase) {
    throw new errors.NotFoundError(`Phase with id ${phaseId} not found`)
  }

  // Check if the resource has this phase
  const resourcePhase = await prisma.resourcePhase.findFirst({
    where: {
      resourceId,
      phaseId
    }
  })

  if (!resourcePhase) {
    throw new errors.NotFoundError(`Resource ${resourceId} does not have phase ${phaseId}`)
  }

  // Delete resource phase
  await prisma.resourcePhase.delete({
    where: {
      id: resourcePhase.id
    }
  })
}

module.exports = {
  ensureRolePhasesDependency,
  getResourcePhases,
  createResourcePhases,
  deleteResourcePhase
}
