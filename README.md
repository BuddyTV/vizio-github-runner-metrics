# workflow-telemetry-action

A GitHub Action to track and monitor the 
- workflow runs, jobs and steps
- resource metrics 
- and process activities 
of your GitHub Action workflow runs. 

The action generates a **self-contained interactive HTML report** that is uploaded as a downloadable pipeline artifact. The report includes zoomable charts, time range analysis, sortable tables, and a light/dark theme toggle — all in a single `.html` file with zero external dependencies. **No static images or markdown reports are posted to PR comments or job summaries.**

The action traces the jobs' step executions and shows them in the HTML report,

And collects the following metrics:
- CPU Load (user and system) in percentage
- Memory usage (used and free) in MB
- Network I/O (read and write) in MB
- Disk I/O (read and write) in MB

And traces the process executions (only supported on `Ubuntu`) with the following information:
- Name
- PID / Parent PID / User ID
- Start time
- Duration (in ms)
- Exit code
- File name and arguments

## Interactive HTML Report

The HTML report provides a rich interactive experience:

- **Zoomable charts** — click-drag to zoom into any time range, scroll wheel to zoom in/out, double-click to reset
- **Hover tooltips** — see exact metric values at any point in time with crosshair tracking
- **Overview dashboard** — summary cards showing peak CPU, average CPU, peak memory, total network/disk I/O, step and process counts
- **Dedicated tabs** — separate views for CPU, Memory, I/O, Disk, Steps, and Processes
- **Step timeline** — horizontal Gantt-style chart with color-coded status (green=success, red=failure, grey=skipped)
- **Process timeline** — top 100 processes by duration with real-time filter by name or PID
- **Sortable tables** — click any column header to sort steps or processes
- **CSV export** — export CPU, memory, or disk metrics as CSV files for external analysis
- **Light/dark theme** — toggle between light and dark themes
- **Downloadable** — save the report locally via the built-in download button; the file is fully self-contained

### How to access the report

1. After your workflow completes, go to the workflow run page
2. Scroll to the **Artifacts** section
3. Download the `workflow-telemetry-{job_name}` artifact
4. Open the `.html` file in any browser

## Usage

To use the action, add the following step before the steps you want to track.

> **Permissions:** The action requires `actions: read` to look up the current job's step details. Without it, step data will not appear in the HTML report, but metrics and process trace data will still be collected.

```yaml
permissions:
  actions: read
jobs:
  workflow-telemetry-action:
    runs-on: ubuntu-latest
    steps:
      - name: Collect Workflow Telemetry
        uses: BuddyTV/vizio-github-runner-metrics@v1
```

### With custom options

```yaml
permissions:
  actions: read
jobs:
  workflow-telemetry-action:
    runs-on: ubuntu-latest
    steps:
      - name: Collect Workflow Telemetry
        uses: BuddyTV/vizio-github-runner-metrics@v1
        with:
          html_report_artifact_name: 'my-pipeline-telemetry'
          theme: 'dark'
```

### Using report path in subsequent steps

```yaml
steps:
  - name: Collect Workflow Telemetry
    id: telemetry
    uses: BuddyTV/vizio-github-runner-metrics@v1

  # ... your build/test steps ...

  # The HTML report path is available after the post-action runs.
  # You can reference it via the outputs:
  #   steps.telemetry.outputs.html_report_path
  #   steps.telemetry.outputs.html_report_dir
```

## Configuration

### Inputs

| Option                        | Requirement | Description
|-------------------------------|-------------|---
| `github_token`                | Optional    | An alternative GitHub token, other than the default provided by GitHub Actions runner.
| `metric_frequency`            | Optional    | Metric collection frequency in seconds. Must be a number. Defaults to `5`.
| `proc_trace_min_duration`     | Optional    | Puts minimum limit for process execution duration to be traced. Must be a number. Defaults to `-1` which means process duration filtering is not applied.
| `proc_trace_sys_enable`       | Optional    | Enables tracing default system processes (`aws`, `cat`, `sed`, ...). Defaults to `false`.
| `theme`                       | Optional    | Set to `dark` to generate the HTML report in dark mode. Defaults to `light`.
| `html_report_output_dir`      | Optional    | Directory to write the HTML report file. Defaults to `$RUNNER_TEMP/workflow-telemetry-reports`.
| `html_report_artifact_name`   | Optional    | Name for the uploaded HTML report artifact. Defaults to `workflow-telemetry-{job_name}`.

### Outputs

| Output             | Description
|--------------------|---
| `html_report_path` | Absolute path to the generated HTML report file.
| `html_report_dir`  | Directory containing the generated HTML report.
