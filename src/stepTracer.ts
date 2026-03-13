import { WorkflowJobType } from './interfaces'
import * as logger from './logger'

///////////////////////////

export async function start(): Promise<boolean> {
  logger.info(`Starting step tracer ...`)

  try {
    logger.info(`Started step tracer`)

    return true
  } catch (error: any) {
    logger.error('Unable to start step tracer')
    logger.error(error)

    return false
  }
}

export async function finish(currentJob: WorkflowJobType): Promise<boolean> {
  logger.info(`Finishing step tracer ...`)

  try {
    logger.info(`Finished step tracer`)

    return true
  } catch (error: any) {
    logger.error('Unable to finish step tracer')
    logger.error(error)

    return false
  }
}
