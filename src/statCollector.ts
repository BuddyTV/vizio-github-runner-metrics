import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import axios from 'axios'
import * as core from '@actions/core'
import {
  CPUStats,
  DiskSizeStats,
  DiskStats,
  MemoryStats,
  NetworkStats,
  ProcessedCPUStats,
  ProcessedDiskSizeStats,
  ProcessedDiskStats,
  ProcessedMemoryStats,
  ProcessedNetworkStats,
  ProcessedStats,
  WorkflowJobType
} from './interfaces'
import { ReportMetrics } from './reportGenerator'
import * as logger from './logger'

const STAT_SERVER_PORT = 7777

async function triggerStatCollect(): Promise<void> {
  logger.debug('Triggering stat collect ...')
  const response = await axios.post(
    `http://localhost:${STAT_SERVER_PORT}/collect`
  )
  if (logger.isDebugEnabled()) {
    logger.debug(`Triggered stat collect: ${JSON.stringify(response.data)}`)
  }
}

function computeAvg(points: ProcessedStats[]): number {
  if (!points.length) return 0
  return points.reduce((sum, p) => sum + p.y, 0) / points.length
}

function computeMax(points: ProcessedStats[]): number {
  if (!points.length) return 0
  return Math.max(...points.map(p => p.y))
}

function computeSum(points: ProcessedStats[]): number {
  return points.reduce((sum, p) => sum + p.y, 0)
}

function fmt(val: number, decimals: number = 1): string {
  return val.toFixed(decimals)
}

async function reportWorkflowMetrics(): Promise<string> {
  const { userLoadX, systemLoadX } = await getCPUStats()
  const { activeMemoryX, availableMemoryX } = await getMemoryStats()
  const { networkReadX, networkWriteX } = await getNetworkStats()
  const { diskReadX, diskWriteX } = await getDiskStats()
  const { diskAvailableX, diskUsedX } = await getDiskSizeStats()

  const postContentItems: string[] = []

  // CPU summary
  if (userLoadX && userLoadX.length) {
    const peakUser = computeMax(userLoadX)
    const avgUser = computeAvg(userLoadX)
    const peakSystem = computeMax(systemLoadX)
    const avgSystem = computeAvg(systemLoadX)
    postContentItems.push(
      '### CPU Metrics',
      '',
      '| Metric | Peak | Average |',
      '|---|---|---|',
      `| User Load | ${fmt(peakUser)}% | ${fmt(avgUser)}% |`,
      `| System Load | ${fmt(peakSystem)}% | ${fmt(avgSystem)}% |`,
      ''
    )
  }

  // Memory summary
  if (activeMemoryX && activeMemoryX.length) {
    const peakUsed = computeMax(activeMemoryX)
    const avgUsed = computeAvg(activeMemoryX)
    const totalMem = activeMemoryX[0].y + (availableMemoryX[0] ? availableMemoryX[0].y : 0)
    postContentItems.push(
      '### Memory Metrics',
      '',
      '| Metric | Value |',
      '|---|---|',
      `| Total Memory | ${fmt(totalMem, 0)} MB |`,
      `| Peak Used | ${fmt(peakUsed, 0)} MB |`,
      `| Avg Used | ${fmt(avgUsed, 0)} MB |`,
      ''
    )
  }

  // IO summary
  const hasNetwork = networkReadX && networkReadX.length
  const hasDisk = diskReadX && diskReadX.length
  if (hasNetwork || hasDisk) {
    postContentItems.push(
      '### IO Metrics',
      '',
      '| Metric | Read | Write |',
      '|---|---|---|'
    )
    if (hasNetwork) {
      postContentItems.push(
        `| Network I/O | ${fmt(computeSum(networkReadX))} MB | ${fmt(computeSum(networkWriteX))} MB |`
      )
    }
    if (hasDisk) {
      postContentItems.push(
        `| Disk I/O | ${fmt(computeSum(diskReadX))} MB | ${fmt(computeSum(diskWriteX))} MB |`
      )
    }
    postContentItems.push('')
  }

  // Disk size summary
  if (diskUsedX && diskUsedX.length && diskAvailableX && diskAvailableX.length) {
    const lastUsed = diskUsedX[diskUsedX.length - 1].y
    const lastAvailable = diskAvailableX[diskAvailableX.length - 1].y
    postContentItems.push(
      '### Disk Usage',
      '',
      '| Metric | Value |',
      '|---|---|',
      `| Used | ${fmt(lastUsed, 0)} MB |`,
      `| Available | ${fmt(lastAvailable, 0)} MB |`,
      ''
    )
  }

  postContentItems.push(
    '',
    '> 📊 **Interactive charts with zoom, tooltips, and time range analysis are available in the HTML report artifact.**'
  )

  return postContentItems.join('\n')
}

async function getCPUStats(): Promise<ProcessedCPUStats> {
  const userLoadX: ProcessedStats[] = []
  const systemLoadX: ProcessedStats[] = []

  logger.debug('Getting CPU stats ...')
  const response = await axios.get(`http://localhost:${STAT_SERVER_PORT}/cpu`)
  if (logger.isDebugEnabled()) {
    logger.debug(`Got CPU stats: ${JSON.stringify(response.data)}`)
  }

  response.data.forEach((element: CPUStats) => {
    userLoadX.push({
      x: element.time,
      y: element.userLoad && element.userLoad > 0 ? element.userLoad : 0
    })

    systemLoadX.push({
      x: element.time,
      y: element.systemLoad && element.systemLoad > 0 ? element.systemLoad : 0
    })
  })

  return { userLoadX, systemLoadX }
}

async function getMemoryStats(): Promise<ProcessedMemoryStats> {
  const activeMemoryX: ProcessedStats[] = []
  const availableMemoryX: ProcessedStats[] = []

  logger.debug('Getting memory stats ...')
  const response = await axios.get(
    `http://localhost:${STAT_SERVER_PORT}/memory`
  )
  if (logger.isDebugEnabled()) {
    logger.debug(`Got memory stats: ${JSON.stringify(response.data)}`)
  }

  response.data.forEach((element: MemoryStats) => {
    activeMemoryX.push({
      x: element.time,
      y:
        element.activeMemoryMb && element.activeMemoryMb > 0
          ? element.activeMemoryMb
          : 0
    })

    availableMemoryX.push({
      x: element.time,
      y:
        element.availableMemoryMb && element.availableMemoryMb > 0
          ? element.availableMemoryMb
          : 0
    })
  })

  return { activeMemoryX, availableMemoryX }
}

async function getNetworkStats(): Promise<ProcessedNetworkStats> {
  const networkReadX: ProcessedStats[] = []
  const networkWriteX: ProcessedStats[] = []

  logger.debug('Getting network stats ...')
  const response = await axios.get(
    `http://localhost:${STAT_SERVER_PORT}/network`
  )
  if (logger.isDebugEnabled()) {
    logger.debug(`Got network stats: ${JSON.stringify(response.data)}`)
  }

  response.data.forEach((element: NetworkStats) => {
    networkReadX.push({
      x: element.time,
      y: element.rxMb && element.rxMb > 0 ? element.rxMb : 0
    })

    networkWriteX.push({
      x: element.time,
      y: element.txMb && element.txMb > 0 ? element.txMb : 0
    })
  })

  return { networkReadX, networkWriteX }
}

async function getDiskStats(): Promise<ProcessedDiskStats> {
  const diskReadX: ProcessedStats[] = []
  const diskWriteX: ProcessedStats[] = []

  logger.debug('Getting disk stats ...')
  const response = await axios.get(`http://localhost:${STAT_SERVER_PORT}/disk`)
  if (logger.isDebugEnabled()) {
    logger.debug(`Got disk stats: ${JSON.stringify(response.data)}`)
  }

  response.data.forEach((element: DiskStats) => {
    diskReadX.push({
      x: element.time,
      y: element.rxMb && element.rxMb > 0 ? element.rxMb : 0
    })

    diskWriteX.push({
      x: element.time,
      y: element.wxMb && element.wxMb > 0 ? element.wxMb : 0
    })
  })

  return { diskReadX, diskWriteX }
}

async function getDiskSizeStats(): Promise<ProcessedDiskSizeStats> {
  const diskAvailableX: ProcessedStats[] = []
  const diskUsedX: ProcessedStats[] = []

  logger.debug('Getting disk size stats ...')
  const response = await axios.get(
    `http://localhost:${STAT_SERVER_PORT}/disk_size`
  )
  if (logger.isDebugEnabled()) {
    logger.debug(`Got disk size stats: ${JSON.stringify(response.data)}`)
  }

  response.data.forEach((element: DiskSizeStats) => {
    diskAvailableX.push({
      x: element.time,
      y:
        element.availableSizeMb && element.availableSizeMb > 0
          ? element.availableSizeMb
          : 0
    })

    diskUsedX.push({
      x: element.time,
      y: element.usedSizeMb && element.usedSizeMb > 0 ? element.usedSizeMb : 0
    })
  })

  return { diskAvailableX, diskUsedX }
}

///////////////////////////

export async function start(): Promise<boolean> {
  logger.info(`Starting stat collector ...`)

  try {
    let metricFrequency = 0
    const metricFrequencyInput: string = core.getInput('metric_frequency')
    if (metricFrequencyInput) {
      const metricFrequencyVal: number = parseInt(metricFrequencyInput)
      if (Number.isInteger(metricFrequencyVal)) {
        metricFrequency = metricFrequencyVal * 1000
      }
    }

    const child: ChildProcess = spawn(
      process.argv[0],
      [path.join(__dirname, '../scw/index.js')],
      {
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          WORKFLOW_TELEMETRY_STAT_FREQ: metricFrequency
            ? `${metricFrequency}`
            : undefined
        }
      }
    )
    child.unref()

    logger.info(`Started stat collector`)

    return true
  } catch (error: any) {
    logger.error('Unable to start stat collector')
    logger.error(error)

    return false
  }
}

export async function finish(currentJob: WorkflowJobType): Promise<boolean> {
  logger.info(`Finishing stat collector ...`)

  try {
    // Trigger stat collect, so we will have remaining stats since the latest schedule
    await triggerStatCollect()

    logger.info(`Finished stat collector`)

    return true
  } catch (error: any) {
    logger.error('Unable to finish stat collector')
    logger.error(error)

    return false
  }
}

export async function report(
  currentJob: WorkflowJobType
): Promise<string | null> {
  logger.info(`Reporting stat collector result ...`)

  try {
    const postContent: string = await reportWorkflowMetrics()

    logger.info(`Reported stat collector result`)

    return postContent
  } catch (error: any) {
    logger.error('Unable to report stat collector result')
    logger.error(error)

    return null
  }
}

export async function getRawMetrics(): Promise<ReportMetrics> {
  logger.info(`Getting raw metrics for HTML report ...`)

  const { userLoadX, systemLoadX } = await getCPUStats()
  const { activeMemoryX, availableMemoryX } = await getMemoryStats()
  const { networkReadX, networkWriteX } = await getNetworkStats()
  const { diskReadX, diskWriteX } = await getDiskStats()
  const { diskAvailableX, diskUsedX } = await getDiskSizeStats()

  return {
    cpu: { userLoad: userLoadX, systemLoad: systemLoadX },
    memory: { active: activeMemoryX, available: availableMemoryX },
    networkRead: networkReadX,
    networkWrite: networkWriteX,
    diskRead: diskReadX,
    diskWrite: diskWriteX,
    diskSize: { used: diskUsedX, available: diskAvailableX }
  }
}
