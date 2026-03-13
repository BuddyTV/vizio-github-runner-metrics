import { ChildProcess, spawn, exec } from 'child_process'
import path from 'path'
import * as core from '@actions/core'
import si from 'systeminformation'
import { parse } from './procTraceParser'
import { CompletedCommand, WorkflowJobType } from './interfaces'
import * as logger from './logger'

const PROC_TRACER_PID_KEY = 'PROC_TRACER_PID'
const PROC_TRACER_OUTPUT_FILE_NAME = 'proc-trace.out'
const PROC_TRACER_BINARY_NAME_UBUNTU_20: string = 'proc_tracer_ubuntu-20'
const PROC_TRACER_BINARY_NAME_UBUNTU_22: string = 'proc_tracer_ubuntu-22'

let finished = false

async function getProcessTracerBinaryName(): Promise<string | null> {
  const osInfo: si.Systeminformation.OsData = await si.osInfo()
  if (osInfo) {
    // Check whether we are running on Ubuntu
    if (osInfo.distro === 'Ubuntu') {
      const majorVersion: number = parseInt(osInfo.release.split('.')[0])
      if (majorVersion === 20) {
        logger.info(`Using ${PROC_TRACER_BINARY_NAME_UBUNTU_20}`)
        return PROC_TRACER_BINARY_NAME_UBUNTU_20
      }

      if (majorVersion === 22) {
        logger.info(`Using ${PROC_TRACER_BINARY_NAME_UBUNTU_22}`)
        return PROC_TRACER_BINARY_NAME_UBUNTU_22
      }
    }
  }

  logger.info(
    `Process tracing disabled because of unsupported OS: ${JSON.stringify(
      osInfo
    )}`
  )

  return null
}

///////////////////////////

export async function start(): Promise<boolean> {
  logger.info(`Starting process tracer ...`)

  try {
    const procTracerBinaryName: string | null =
      await getProcessTracerBinaryName()
    if (procTracerBinaryName) {
      const procTraceOutFilePath = path.join(
        __dirname,
        '../proc-tracer',
        PROC_TRACER_OUTPUT_FILE_NAME
      )
      const child: ChildProcess = spawn(
        'sudo',
        [
          path.join(__dirname, `../proc-tracer/${procTracerBinaryName}`),
          '-f',
          'json',
          '-o',
          procTraceOutFilePath
        ],
        {
          detached: true,
          stdio: 'ignore',
          env: {
            ...process.env
          }
        }
      )
      child.unref()

      core.saveState(PROC_TRACER_PID_KEY, child.pid?.toString())

      logger.info(`Started process tracer`)

      return true
    } else {
      return false
    }
  } catch (error: any) {
    logger.error('Unable to start process tracer')
    logger.error(error)

    return false
  }
}

export async function finish(currentJob: WorkflowJobType): Promise<boolean> {
  logger.info(`Finishing process tracer ...`)

  const procTracePID: string = core.getState(PROC_TRACER_PID_KEY)
  if (!procTracePID) {
    logger.info(
      `Skipped finishing process tracer since process tracer didn't started`
    )
    return false
  }
  try {
    logger.debug(
      `Interrupting process tracer with pid ${procTracePID} to stop gracefully ...`
    )

    exec(`sudo kill -s INT ${procTracePID}`)
    finished = true

    logger.info(`Finished process tracer`)

    return true
  } catch (error: any) {
    logger.error('Unable to finish process tracer')
    logger.error(error)

    return false
  }
}

export async function getParsedCommands(): Promise<CompletedCommand[]> {
  if (!finished) {
    return []
  }
  try {
    const procTraceOutFilePath = path.join(
      __dirname,
      '../proc-tracer',
      PROC_TRACER_OUTPUT_FILE_NAME
    )

    let procTraceMinDuration = -1
    const procTraceMinDurationInput: string = core.getInput(
      'proc_trace_min_duration'
    )
    if (procTraceMinDurationInput) {
      const minProcDurationVal: number = parseInt(procTraceMinDurationInput)
      if (Number.isInteger(minProcDurationVal)) {
        procTraceMinDuration = minProcDurationVal
      }
    }
    const procTraceSysEnable: boolean =
      core.getInput('proc_trace_sys_enable') === 'true'

    return await parse(procTraceOutFilePath, {
      minDuration: procTraceMinDuration,
      traceSystemProcesses: procTraceSysEnable
    })
  } catch (error: any) {
    logger.error('Unable to get parsed commands for HTML report')
    logger.error(error)
    return []
  }
}
