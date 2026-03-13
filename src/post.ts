import * as core from '@actions/core'
import * as github from '@actions/github'
import { Octokit } from '@octokit/action'
import * as path from 'path'
import * as statCollector from './statCollector'
import * as processTracer from './processTracer'
import * as logger from './logger'
import { WorkflowJobType, CompletedCommand } from './interfaces'
import { ReportData, ReportMetrics, writeHtmlReport } from './reportGenerator'

const { pull_request } = github.context.payload
const { workflow, job, repo, runId, sha } = github.context
const PAGE_SIZE = 100
const octokit: Octokit = new Octokit()

async function getCurrentJob(): Promise<WorkflowJobType | null> {
  const _getCurrentJob = async (): Promise<WorkflowJobType | null> => {
    for (let page = 0; ; page++) {
      const result = await octokit.rest.actions.listJobsForWorkflowRun({
        owner: repo.owner,
        repo: repo.repo,
        run_id: runId,
        per_page: PAGE_SIZE,
        page
      })
      const jobs: WorkflowJobType[] = result.data.jobs
      // If there are no jobs, stop here
      if (!jobs || !jobs.length) {
        break
      }
      const currentJobs = jobs.filter(
        it =>
          it.status === 'in_progress' &&
          it.runner_name === process.env.RUNNER_NAME
      )
      if (currentJobs && currentJobs.length) {
        return currentJobs[0]
      }
      // Since returning job count is less than page size, this means that there are no other jobs.
      // So no need to make another request for the next page.
      if (jobs.length < PAGE_SIZE) {
        break
      }
    }
    return null
  }
  try {
    for (let i = 0; i < 10; i++) {
      const currentJob: WorkflowJobType | null = await _getCurrentJob()
      if (currentJob && currentJob.id) {
        return currentJob
      }
      await new Promise(r => setTimeout(r, 1000))
    }
  } catch (error: any) {
    logger.error(
      `Unable to get current workflow job info. ` +
        `Please sure that your workflow have "actions:read" permission!`
    )
  }
  return null
}

async function run(): Promise<void> {
  try {
    logger.info(`Finishing ...`)

    const currentJob: WorkflowJobType | null = await getCurrentJob()

    if (currentJob) {
      logger.debug(`Current job: ${JSON.stringify(currentJob)}`)
    } else {
      logger.info(
        `Couldn't find current job info. ` +
          `Step details will not be available in the HTML report. ` +
          `To include step data, add "actions: read" permission to your workflow.`
      )
    }

    // Finish stat collector (triggers final metric collection)
    try {
      await statCollector.finish(currentJob as WorkflowJobType)
    } catch (e: any) {
      logger.debug(`Stat collector finish: ${e.message}`)
    }
    // Finish process tracer (uses PID from state)
    try {
      await processTracer.finish(currentJob as WorkflowJobType)
    } catch (e: any) {
      logger.debug(`Process tracer finish: ${e.message}`)
    }

    // Generate interactive HTML report
    try {
      logger.info(`Generating interactive HTML report ...`)

      const rawMetrics: ReportMetrics = await statCollector.getRawMetrics()
      const parsedCommands: CompletedCommand[] =
        await processTracer.getParsedCommands()

      const commit: string =
        (pull_request && pull_request.head && pull_request.head.sha) || sha

      const jobName = currentJob
        ? currentJob.name
        : process.env.GITHUB_JOB || job || 'unknown'
      const jobId = currentJob ? currentJob.id : 0

      const reportData: ReportData = {
        workflow,
        jobName,
        jobUrl: jobId
          ? `https://github.com/${repo.owner}/${repo.repo}/runs/${jobId}?check_suite_focus=true`
          : `https://github.com/${repo.owner}/${repo.repo}/actions/runs/${runId}`,
        commit,
        commitUrl: `https://github.com/${repo.owner}/${repo.repo}/commit/${commit}`,
        runId,
        repo: `${repo.owner}/${repo.repo}`,
        timestamp: new Date().toISOString(),
        metrics: rawMetrics,
        steps: currentJob ? currentJob.steps || [] : [],
        processes: parsedCommands,
        theme: core.getInput('theme', { required: false }) || 'light'
      }

      const outputDir =
        core.getInput('html_report_output_dir', { required: false }) ||
        path.join(
          process.env.RUNNER_TEMP || '/tmp',
          'workflow-telemetry-reports'
        )
      const reportPath = await writeHtmlReport(reportData, outputDir)

      core.setOutput('html_report_path', reportPath)
      core.setOutput('html_report_dir', outputDir)

      // Upload as artifact
      try {
        const artifact = await import('@actions/artifact')
        const artifactName =
          core.getInput('html_report_artifact_name', {
            required: false
          }) || `workflow-telemetry-${jobName}`

        logger.info(
          `Uploading HTML report artifact "${artifactName}" from ${reportPath} (root: ${outputDir}) ...`
        )

        const client = artifact.default
        const uploadResponse = await client.uploadArtifact(
          artifactName,
          [reportPath],
          outputDir
        )
        logger.info(
          `HTML report uploaded as artifact: ${artifactName} (id: ${uploadResponse.id}, size: ${uploadResponse.size})`
        )
      } catch (artifactError: any) {
        logger.error(
          `Unable to upload HTML report artifact: ${artifactError.message}`
        )
        logger.error(
          `Report is available on the runner filesystem at: ${reportPath}`
        )
        if (artifactError.stack) {
          logger.debug(`Artifact upload stack: ${artifactError.stack}`)
        }
      }

      logger.info(`Interactive HTML report generated: ${reportPath}`)
    } catch (reportError: any) {
      logger.error(
        `Unable to generate HTML report: ${reportError.message}`
      )
    }

    logger.info(`Finish completed`)
  } catch (error: any) {
    logger.error(error.message)
  }
}

run()
