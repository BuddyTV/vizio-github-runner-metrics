import * as fs from 'fs'
import * as path from 'path'
import { ProcessedStats, CompletedCommand, WorkflowJobType } from './interfaces'
import * as logger from './logger'

export interface ReportMetrics {
  cpu: { userLoad: ProcessedStats[]; systemLoad: ProcessedStats[] }
  memory: { active: ProcessedStats[]; available: ProcessedStats[] }
  networkRead: ProcessedStats[]
  networkWrite: ProcessedStats[]
  diskRead: ProcessedStats[]
  diskWrite: ProcessedStats[]
  diskSize: { used: ProcessedStats[]; available: ProcessedStats[] }
}

export interface ReportData {
  workflow: string
  jobName: string
  jobUrl: string
  commit: string
  commitUrl: string
  runId: number
  repo: string
  timestamp: string
  metrics: ReportMetrics
  steps: WorkflowJobType['steps']
  processes: CompletedCommand[]
  theme: string
}

export function generateHtmlReport(data: ReportData): string {
  const jsonData = JSON.stringify(data)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Workflow Telemetry - ${escapeHtml(data.workflow)} / ${escapeHtml(data.jobName)}</title>
<style>
${getStyles()}
</style>
</head>
<body>
<div id="app">
  <header class="header">
    <div class="header-left">
      <h1>Workflow Telemetry</h1>
      <div class="header-meta">
        <span class="badge badge-workflow">${escapeHtml(data.workflow)}</span>
        <span class="badge badge-job">${escapeHtml(data.jobName)}</span>
        <a href="${escapeHtml(data.commitUrl)}" target="_blank" class="badge badge-commit">${escapeHtml(data.commit.substring(0, 7))}</a>
        <a href="${escapeHtml(data.jobUrl)}" target="_blank" class="badge badge-link">View Job</a>
      </div>
    </div>
    <div class="header-right">
      <button id="themeToggle" class="btn btn-icon" title="Toggle theme">🌓</button>
      <button id="downloadBtn" class="btn btn-primary" title="Download Report">⬇ Download HTML</button>
    </div>
  </header>

  <nav class="tabs" id="tabNav">
    <button class="tab active" data-tab="overview">Overview</button>
    <button class="tab" data-tab="cpu">CPU</button>
    <button class="tab" data-tab="memory">Memory</button>
    <button class="tab" data-tab="io">I/O</button>
    <button class="tab" data-tab="disk">Disk</button>
    <button class="tab" data-tab="steps">Steps</button>
    <button class="tab" data-tab="processes">Processes</button>
  </nav>

  <div class="tab-content" id="tabContent">
    <section id="tab-overview" class="panel active">
      <div class="summary-cards" id="summaryCards"></div>
      <div class="chart-row">
        <div class="chart-container">
          <div class="chart-header">
            <h3>CPU Load (%)</h3>
            <div class="chart-controls">
              <button class="btn btn-sm" onclick="resetZoom('cpuOverview')">Reset Zoom</button>
            </div>
          </div>
          <canvas id="cpuOverview"></canvas>
        </div>
        <div class="chart-container">
          <div class="chart-header">
            <h3>Memory Usage (MB)</h3>
            <div class="chart-controls">
              <button class="btn btn-sm" onclick="resetZoom('memOverview')">Reset Zoom</button>
            </div>
          </div>
          <canvas id="memOverview"></canvas>
        </div>
      </div>
    </section>

    <section id="tab-cpu" class="panel">
      <div class="chart-container full">
        <div class="chart-header">
          <h3>CPU Load (%) — User &amp; System</h3>
          <div class="chart-controls">
            <button class="btn btn-sm" onclick="resetZoom('cpuFull')">Reset Zoom</button>
            <button class="btn btn-sm" onclick="exportCSV('cpu')">Export CSV</button>
          </div>
        </div>
        <canvas id="cpuFull"></canvas>
        <div class="range-selector" id="cpuRange"></div>
      </div>
    </section>

    <section id="tab-memory" class="panel">
      <div class="chart-container full">
        <div class="chart-header">
          <h3>Memory Usage (MB) — Active &amp; Available</h3>
          <div class="chart-controls">
            <button class="btn btn-sm" onclick="resetZoom('memFull')">Reset Zoom</button>
            <button class="btn btn-sm" onclick="exportCSV('memory')">Export CSV</button>
          </div>
        </div>
        <canvas id="memFull"></canvas>
        <div class="range-selector" id="memRange"></div>
      </div>
    </section>

    <section id="tab-io" class="panel">
      <div class="chart-row">
        <div class="chart-container">
          <div class="chart-header">
            <h3>Network I/O Read (MB)</h3>
            <div class="chart-controls">
              <button class="btn btn-sm" onclick="resetZoom('netRead')">Reset Zoom</button>
            </div>
          </div>
          <canvas id="netRead"></canvas>
        </div>
        <div class="chart-container">
          <div class="chart-header">
            <h3>Network I/O Write (MB)</h3>
            <div class="chart-controls">
              <button class="btn btn-sm" onclick="resetZoom('netWrite')">Reset Zoom</button>
            </div>
          </div>
          <canvas id="netWrite"></canvas>
        </div>
      </div>
      <div class="chart-row">
        <div class="chart-container">
          <div class="chart-header">
            <h3>Disk I/O Read (MB)</h3>
            <div class="chart-controls">
              <button class="btn btn-sm" onclick="resetZoom('diskRead')">Reset Zoom</button>
            </div>
          </div>
          <canvas id="diskRead"></canvas>
        </div>
        <div class="chart-container">
          <div class="chart-header">
            <h3>Disk I/O Write (MB)</h3>
            <div class="chart-controls">
              <button class="btn btn-sm" onclick="resetZoom('diskWrite')">Reset Zoom</button>
            </div>
          </div>
          <canvas id="diskWrite"></canvas>
        </div>
      </div>
    </section>

    <section id="tab-disk" class="panel">
      <div class="chart-container full">
        <div class="chart-header">
          <h3>Disk Usage (MB) — Used &amp; Available</h3>
          <div class="chart-controls">
            <button class="btn btn-sm" onclick="resetZoom('diskSize')">Reset Zoom</button>
            <button class="btn btn-sm" onclick="exportCSV('disk_size')">Export CSV</button>
          </div>
        </div>
        <canvas id="diskSize"></canvas>
      </div>
    </section>

    <section id="tab-steps" class="panel">
      <div class="chart-container full">
        <div class="chart-header">
          <h3>Workflow Step Timeline</h3>
        </div>
        <div id="stepsTimeline" class="timeline-container"></div>
      </div>
      <div class="table-container" id="stepsTable"></div>
    </section>

    <section id="tab-processes" class="panel">
      <div class="chart-container full">
        <div class="chart-header">
          <h3>Top Processes by Duration</h3>
          <div class="chart-controls">
            <input type="text" id="procFilter" placeholder="Filter processes..." class="input-filter">
          </div>
        </div>
        <div id="procTimeline" class="timeline-container"></div>
      </div>
      <div class="table-container" id="procTable"></div>
    </section>
  </div>

  <div class="tooltip" id="tooltip"></div>
</div>

<script>
// ==============================
// Embedded Report Data
// ==============================
const REPORT_DATA = ${jsonData};

${getChartEngine()}
</script>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getStyles(): string {
  return `
:root {
  --bg: #ffffff;
  --bg-secondary: #f6f8fa;
  --bg-card: #ffffff;
  --text: #1f2328;
  --text-secondary: #656d76;
  --border: #d0d7de;
  --accent: #0969da;
  --accent-hover: #0550ae;
  --success: #1a7f37;
  --danger: #cf222e;
  --warning: #9a6700;
  --shadow: 0 1px 3px rgba(0,0,0,0.08);
  --radius: 8px;
  --chart-grid: rgba(0,0,0,0.08);
  --chart-text: #656d76;
}

[data-theme="dark"] {
  --bg: #0d1117;
  --bg-secondary: #161b22;
  --bg-card: #161b22;
  --text: #e6edf3;
  --text-secondary: #8b949e;
  --border: #30363d;
  --accent: #58a6ff;
  --accent-hover: #79c0ff;
  --success: #3fb950;
  --danger: #f85149;
  --warning: #d29922;
  --shadow: 0 1px 3px rgba(0,0,0,0.3);
  --chart-grid: rgba(255,255,255,0.08);
  --chart-text: #8b949e;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
}

#app { max-width: 1400px; margin: 0 auto; padding: 16px; }

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.header h1 { font-size: 20px; font-weight: 600; }

.header-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
.header-right { display: flex; gap: 8px; align-items: center; }

.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  background: var(--bg-secondary);
}
.badge-workflow { background: #ddf4ff; color: #0550ae; border-color: #54aeff66; }
.badge-job { background: #dafbe1; color: #1a7f37; border-color: #4ac26b66; }
.badge-commit { font-family: monospace; background: #fff8c5; color: #9a6700; border-color: #d4a72c66; }
.badge-link { background: var(--accent); color: white; border-color: transparent; }
[data-theme="dark"] .badge-workflow { background: #0d419d44; color: #58a6ff; }
[data-theme="dark"] .badge-job { background: #23863644; color: #3fb950; }
[data-theme="dark"] .badge-commit { background: #9a670044; color: #d29922; }

.btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
}
.btn:hover { background: var(--bg-secondary); border-color: var(--text-secondary); }
.btn-primary { background: var(--accent); color: white; border-color: transparent; }
.btn-primary:hover { background: var(--accent-hover); }
.btn-sm { padding: 3px 10px; font-size: 12px; }
.btn-icon { padding: 4px 8px; font-size: 16px; line-height: 1; }

.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
  overflow-x: auto;
}
.tab {
  padding: 8px 16px;
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: all 0.15s;
}
.tab:hover { color: var(--text); }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }

.panel { display: none; }
.panel.active { display: block; }

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.summary-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  box-shadow: var(--shadow);
}
.summary-card .label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.summary-card .value { font-size: 24px; font-weight: 700; color: var(--text); }
.summary-card .unit { font-size: 13px; font-weight: 400; color: var(--text-secondary); }

.chart-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
@media (max-width: 900px) { .chart-row { grid-template-columns: 1fr; } }

.chart-container {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
  position: relative;
}
.chart-container.full { margin-bottom: 16px; }

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}
.chart-header h3 { font-size: 14px; font-weight: 600; }
.chart-controls { display: flex; gap: 6px; align-items: center; }

canvas {
  width: 100% !important;
  height: 300px !important;
  cursor: crosshair;
}

.range-selector {
  width: 100%;
  height: 50px;
  margin-top: 8px;
  position: relative;
  cursor: pointer;
}

.timeline-container {
  overflow-x: auto;
  overflow-y: auto;
  max-height: 500px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-secondary);
}

.timeline-bar-group {
  display: flex;
  align-items: center;
  padding: 3px 8px;
  border-bottom: 1px solid var(--border);
  min-width: fit-content;
}
.timeline-bar-group:hover { background: var(--bg-card); }
.timeline-label {
  min-width: 200px;
  max-width: 250px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 12px;
  flex-shrink: 0;
}
.timeline-track {
  flex: 1;
  height: 22px;
  position: relative;
  min-width: 400px;
}
.timeline-bar {
  position: absolute;
  height: 100%;
  border-radius: 3px;
  min-width: 2px;
  transition: opacity 0.15s;
  cursor: pointer;
}
.timeline-bar:hover { opacity: 0.85; filter: brightness(1.1); }
.timeline-bar .bar-label {
  font-size: 10px;
  color: white;
  padding: 0 4px;
  line-height: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.table-container {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: auto;
  max-height: 400px;
  box-shadow: var(--shadow);
}
.table-container table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.table-container th {
  position: sticky;
  top: 0;
  background: var(--bg-secondary);
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  border-bottom: 2px solid var(--border);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.table-container th:hover { color: var(--accent); }
.table-container td {
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.table-container tr:hover td { background: var(--bg-secondary); }

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}
.status-success { background: var(--success); }
.status-failure { background: var(--danger); }
.status-skipped { background: var(--text-secondary); }

.tooltip {
  display: none;
  position: fixed;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 1000;
  pointer-events: none;
  max-width: 300px;
}
.tooltip .tt-title { font-weight: 600; margin-bottom: 4px; }
.tooltip .tt-row { display: flex; justify-content: space-between; gap: 16px; }
.tooltip .tt-label { color: var(--text-secondary); }
.tooltip .tt-value { font-weight: 600; font-family: monospace; }

.input-filter {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  background: var(--bg);
  color: var(--text);
  outline: none;
  width: 200px;
}
.input-filter:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(9,105,218,0.15); }

.zoom-hint {
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
  margin-top: 4px;
}
`
}

function getChartEngine(): string {
  return `
// ==============================
// Theme Management
// ==============================
(function() {
  const initialTheme = REPORT_DATA.theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', initialTheme);
})();

document.getElementById('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  Object.values(charts).forEach(c => c.render());
});

// ==============================
// Tab Navigation
// ==============================
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    // Resize charts in new tab
    Object.values(charts).forEach(c => c.resize && c.resize());
  });
});

// ==============================
// Download
// ==============================
document.getElementById('downloadBtn').addEventListener('click', () => {
  const html = document.documentElement.outerHTML;
  const blob = new Blob(['<!DOCTYPE html>' + html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'workflow-telemetry-' + REPORT_DATA.repo.replace(/\\//g, '-') + '-' + REPORT_DATA.runId + '.html';
  a.click();
  URL.revokeObjectURL(url);
});

// ==============================
// Tooltip
// ==============================
const tooltipEl = document.getElementById('tooltip');
function showTooltip(x, y, html) {
  tooltipEl.innerHTML = html;
  tooltipEl.style.display = 'block';
  const rect = tooltipEl.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  let tx = x + 12, ty = y + 12;
  if (tx + rect.width > vw - 10) tx = x - rect.width - 12;
  if (ty + rect.height > vh - 10) ty = y - rect.height - 12;
  tooltipEl.style.left = tx + 'px';
  tooltipEl.style.top = ty + 'px';
}
function hideTooltip() { tooltipEl.style.display = 'none'; }

// ==============================
// Utility
// ==============================
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function formatDuration(ms) {
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  return (ms / 60000).toFixed(1) + 'm';
}
function getComputedColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

// ==============================
// Chart Engine (Canvas-based)
// ==============================
const charts = {};

class TimeSeriesChart {
  constructor(canvasId, config) {
    this.canvasId = canvasId;
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.config = config; // { series: [{ label, color, data: [{x,y}], fill }], yLabel, stacked }
    this.padding = { top: 20, right: 20, bottom: 40, left: 65 };
    this.zoomState = null; // { xMin, xMax }
    this.dragState = null;
    this.selectionState = null;
    this.hoveredPoint = null;
    this.dpr = window.devicePixelRatio || 1;

    this._bindEvents();
    this.resize();
    charts[canvasId] = this;
  }

  get xMin() { return this.zoomState ? this.zoomState.xMin : this._dataXMin(); }
  get xMax() { return this.zoomState ? this.zoomState.xMax : this._dataXMax(); }

  _dataXMin() {
    let min = Infinity;
    this.config.series.forEach(s => s.data.forEach(p => { if (p.x < min) min = p.x; }));
    return min;
  }
  _dataXMax() {
    let max = -Infinity;
    this.config.series.forEach(s => s.data.forEach(p => { if (p.x > max) max = p.x; }));
    return max;
  }
  _dataYMax() {
    if (this.config.stacked) {
      let maxY = 0;
      const allX = new Set();
      this.config.series.forEach(s => s.data.forEach(p => allX.add(p.x)));
      allX.forEach(x => {
        let sum = 0;
        this.config.series.forEach(s => {
          const pt = s.data.find(p => p.x === x);
          if (pt) sum += pt.y;
        });
        if (sum > maxY) maxY = sum;
      });
      return maxY * 1.1;
    }
    let max = 0;
    this.config.series.forEach(s => s.data.forEach(p => { if (p.y > max) max = p.y; }));
    return max * 1.1 || 1;
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = rect.width - 32;
    const h = 300;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.width = w;
    this.height = h;
    this.render();
  }

  resetZoom() {
    this.zoomState = null;
    this.render();
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const { top, right, bottom, left } = this.padding;
    const chartW = this.width - left - right;
    const chartH = this.height - top - bottom;
    const xMin = this.xMin, xMax = this.xMax;
    const yMax = this._dataYMax();

    // Clear
    ctx.clearRect(0, 0, this.width, this.height);

    const gridColor = getComputedColor('--chart-grid');
    const textColor = getComputedColor('--chart-text');

    // Y axis grid + labels
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const val = (yMax / yTicks) * i;
      const y = top + chartH - (i / yTicks) * chartH;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + chartW, y);
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.fillText(val >= 1000 ? (val/1000).toFixed(1) + 'k' : val.toFixed(1), left - 8, y);
    }

    // X axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xTicks = Math.min(8, Math.floor(chartW / 100));
    for (let i = 0; i <= xTicks; i++) {
      const val = xMin + (i / xTicks) * (xMax - xMin);
      const x = left + (i / xTicks) * chartW;
      ctx.fillStyle = textColor;
      ctx.fillText(formatTime(val), x, top + chartH + 6);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + chartH);
      ctx.stroke();
    }

    // Y axis label
    ctx.save();
    ctx.translate(12, top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = textColor;
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(this.config.yLabel || '', 0, 0);
    ctx.restore();

    // Filter data to visible range
    const toCanvasX = (xVal) => left + ((xVal - xMin) / (xMax - xMin)) * chartW;
    const toCanvasY = (yVal) => top + chartH - (yVal / yMax) * chartH;

    // Draw series
    if (this.config.stacked) {
      this._drawStacked(ctx, toCanvasX, toCanvasY, chartH, top, yMax);
    } else {
      this.config.series.forEach(series => {
        const filtered = series.data.filter(p => p.x >= xMin && p.x <= xMax);
        if (filtered.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(toCanvasX(filtered[0].x), toCanvasY(filtered[0].y));
        for (let i = 1; i < filtered.length; i++) {
          ctx.lineTo(toCanvasX(filtered[i].x), toCanvasY(filtered[i].y));
        }
        ctx.strokeStyle = series.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        if (series.fill) {
          ctx.lineTo(toCanvasX(filtered[filtered.length - 1].x), top + chartH);
          ctx.lineTo(toCanvasX(filtered[0].x), top + chartH);
          ctx.closePath();
          ctx.fillStyle = series.color + '30';
          ctx.fill();
        }
      });
    }

    // Selection highlight
    if (this.selectionState) {
      const sx = Math.min(this.selectionState.startX, this.selectionState.endX);
      const sw = Math.abs(this.selectionState.endX - this.selectionState.startX);
      ctx.fillStyle = getComputedColor('--accent') + '22';
      ctx.fillRect(sx, top, sw, chartH);
      ctx.strokeStyle = getComputedColor('--accent');
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(sx, top, sw, chartH);
      ctx.setLineDash([]);
    }

    // Hovered point crosshair + tooltip
    if (this.hoveredPoint) {
      const { canvasX, canvasY } = this.hoveredPoint;
      ctx.strokeStyle = getComputedColor('--accent') + '66';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(canvasX, top);
      ctx.lineTo(canvasX, top + chartH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Legend
    const legendY = this.height - 6;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'bottom';
    let legendX = left;
    this.config.series.forEach(s => {
      ctx.fillStyle = s.color;
      ctx.fillRect(legendX, legendY - 9, 12, 3);
      legendX += 16;
      ctx.fillStyle = textColor;
      ctx.textAlign = 'left';
      ctx.fillText(s.label, legendX, legendY);
      legendX += ctx.measureText(s.label).width + 20;
    });

    // Zoom hint
    if (!this.zoomState) {
      ctx.fillStyle = textColor;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Click-drag to zoom | Scroll to zoom | Double-click to reset', this.width - right, this.height - 2);
    }
  }

  _drawStacked(ctx, toCanvasX, toCanvasY, chartH, top, yMax) {
    const xMin = this.xMin, xMax = this.xMax;
    const seriesData = this.config.series.map(s => s.data.filter(p => p.x >= xMin && p.x <= xMax));

    if (seriesData.every(d => d.length < 2)) return;

    // Assume all series have same x values (they should)
    const baseXs = seriesData[0] || [];
    const cumulativeY = new Array(baseXs.length).fill(0);

    for (let si = 0; si < seriesData.length; si++) {
      const data = seriesData[si];
      const prevCum = [...cumulativeY];

      for (let i = 0; i < data.length; i++) {
        cumulativeY[i] = (prevCum[i] || 0) + data[i].y;
      }

      // Draw filled area
      ctx.beginPath();
      ctx.moveTo(toCanvasX(data[0].x), toCanvasY(cumulativeY[0]));
      for (let i = 1; i < data.length; i++) {
        ctx.lineTo(toCanvasX(data[i].x), toCanvasY(cumulativeY[i]));
      }
      // Close back along bottom (previous cumulative)
      for (let i = data.length - 1; i >= 0; i--) {
        ctx.lineTo(toCanvasX(data[i].x), toCanvasY(prevCum[i] || 0));
      }
      ctx.closePath();
      ctx.fillStyle = this.config.series[si].color + '44';
      ctx.fill();

      // Draw line on top
      ctx.beginPath();
      ctx.moveTo(toCanvasX(data[0].x), toCanvasY(cumulativeY[0]));
      for (let i = 1; i < data.length; i++) {
        ctx.lineTo(toCanvasX(data[i].x), toCanvasY(cumulativeY[i]));
      }
      ctx.strokeStyle = this.config.series[si].color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  _bindEvents() {
    if (!this.canvas) return;
    const { top, right, bottom, left } = this.padding;

    // Mouse move => hover
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const chartW = this.width - left - right;
      const chartH = this.height - top - bottom;

      if (mx >= left && mx <= left + chartW && my >= top && my <= top + chartH) {
        const xVal = this.xMin + ((mx - left) / chartW) * (this.xMax - this.xMin);

        // Find nearest point across all series
        let tooltipHtml = '<div class="tt-title">' + formatTime(xVal) + '</div>';
        this.config.series.forEach(s => {
          const nearest = s.data.reduce((best, p) =>
            Math.abs(p.x - xVal) < Math.abs(best.x - xVal) ? p : best
          , s.data[0]);
          if (nearest) {
            tooltipHtml += '<div class="tt-row"><span class="tt-label" style="color:'+s.color+'">' + s.label + '</span><span class="tt-value">' + nearest.y.toFixed(2) + '</span></div>';
          }
        });

        this.hoveredPoint = { canvasX: mx, canvasY: my };
        this.render();
        showTooltip(e.clientX, e.clientY, tooltipHtml);
      } else {
        this.hoveredPoint = null;
        this.render();
        hideTooltip();
      }

      // Selection drag
      if (this.selectionState && this.selectionState.dragging) {
        this.selectionState.endX = Math.max(left, Math.min(mx, left + chartW));
        this.render();
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredPoint = null;
      this.render();
      hideTooltip();
    });

    // Mouse down => start selection
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      this.selectionState = { startX: mx, endX: mx, dragging: true };
    });

    // Mouse up => apply zoom
    this.canvas.addEventListener('mouseup', (e) => {
      if (this.selectionState && this.selectionState.dragging) {
        const chartW = this.width - left - right;
        const sx = Math.min(this.selectionState.startX, this.selectionState.endX);
        const ex = Math.max(this.selectionState.startX, this.selectionState.endX);
        const selWidth = ex - sx;

        if (selWidth > 10) {
          const xMin = this.xMin + ((sx - left) / chartW) * (this.xMax - this.xMin);
          const xMax = this.xMin + ((ex - left) / chartW) * (this.xMax - this.xMin);
          this.zoomState = { xMin: Math.max(xMin, this._dataXMin()), xMax: Math.min(xMax, this._dataXMax()) };
        }
        this.selectionState = null;
        this.render();
      }
    });

    // Scroll => zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const chartW = this.width - left - right;
      const chartLeft = left;

      const fraction = (mx - chartLeft) / chartW;
      const currentXMin = this.xMin;
      const currentXMax = this.xMax;
      const range = currentXMax - currentXMin;
      const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8;
      const newRange = range * zoomFactor;

      const pivot = currentXMin + fraction * range;
      let newXMin = pivot - fraction * newRange;
      let newXMax = pivot + (1 - fraction) * newRange;

      newXMin = Math.max(newXMin, this._dataXMin());
      newXMax = Math.min(newXMax, this._dataXMax());

      if (newXMax - newXMin > 1000) { // min range 1 second
        this.zoomState = { xMin: newXMin, xMax: newXMax };
        this.render();
      }
    }, { passive: false });

    // Double click => reset zoom
    this.canvas.addEventListener('dblclick', () => {
      this.resetZoom();
    });

    // Resize
    window.addEventListener('resize', () => this.resize());
  }
}

function resetZoom(chartId) {
  if (charts[chartId]) charts[chartId].resetZoom();
}

// ==============================
// CSV Export
// ==============================
function exportCSV(type) {
  let csv = '';
  const m = REPORT_DATA.metrics;

  if (type === 'cpu') {
    csv = 'Time,User Load (%),System Load (%)\\n';
    m.cpu.userLoad.forEach((p, i) => {
      const sys = m.cpu.systemLoad[i];
      csv += formatTime(p.x) + ',' + p.y.toFixed(2) + ',' + (sys ? sys.y.toFixed(2) : '') + '\\n';
    });
  } else if (type === 'memory') {
    csv = 'Time,Active (MB),Available (MB)\\n';
    m.memory.active.forEach((p, i) => {
      const avail = m.memory.available[i];
      csv += formatTime(p.x) + ',' + p.y.toFixed(2) + ',' + (avail ? avail.y.toFixed(2) : '') + '\\n';
    });
  } else if (type === 'disk_size') {
    csv = 'Time,Used (MB),Available (MB)\\n';
    m.diskSize.used.forEach((p, i) => {
      const avail = m.diskSize.available[i];
      csv += formatTime(p.x) + ',' + p.y.toFixed(2) + ',' + (avail ? avail.y.toFixed(2) : '') + '\\n';
    });
  }

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'metrics-' + type + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ==============================
// Summary Cards
// ==============================
function renderSummaryCards() {
  const m = REPORT_DATA.metrics;
  const cards = [];

  if (m.cpu.userLoad.length) {
    const peakCpu = Math.max(...m.cpu.userLoad.map(p => p.y), ...m.cpu.systemLoad.map(p => p.y));
    const avgCpu = m.cpu.userLoad.reduce((s, p) => s + p.y, 0) / m.cpu.userLoad.length;
    cards.push({ label: 'Peak CPU', value: peakCpu.toFixed(1), unit: '%' });
    cards.push({ label: 'Avg CPU (User)', value: avgCpu.toFixed(1), unit: '%' });
  }

  if (m.memory.active.length) {
    const peakMem = Math.max(...m.memory.active.map(p => p.y));
    const totalMem = m.memory.active.length > 0 ?
      m.memory.active[0].y + (m.memory.available[0] ? m.memory.available[0].y : 0) : 0;
    cards.push({ label: 'Peak Memory', value: peakMem.toFixed(0), unit: 'MB' });
    cards.push({ label: 'Total Memory', value: totalMem.toFixed(0), unit: 'MB' });
  }

  if (m.networkRead.length) {
    const totalNetRead = m.networkRead.reduce((s, p) => s + p.y, 0);
    const totalNetWrite = m.networkWrite.reduce((s, p) => s + p.y, 0);
    cards.push({ label: 'Net Read', value: totalNetRead.toFixed(1), unit: 'MB' });
    cards.push({ label: 'Net Write', value: totalNetWrite.toFixed(1), unit: 'MB' });
  }

  if (m.diskRead.length) {
    const totalDiskRead = m.diskRead.reduce((s, p) => s + p.y, 0);
    const totalDiskWrite = m.diskWrite.reduce((s, p) => s + p.y, 0);
    cards.push({ label: 'Disk Read', value: totalDiskRead.toFixed(1), unit: 'MB' });
    cards.push({ label: 'Disk Write', value: totalDiskWrite.toFixed(1), unit: 'MB' });
  }

  if (REPORT_DATA.steps && REPORT_DATA.steps.length) {
    cards.push({ label: 'Steps', value: REPORT_DATA.steps.length, unit: '' });
  }

  if (REPORT_DATA.processes && REPORT_DATA.processes.length) {
    cards.push({ label: 'Processes', value: REPORT_DATA.processes.length, unit: '' });
  }

  const container = document.getElementById('summaryCards');
  container.innerHTML = cards.map(c =>
    '<div class="summary-card"><div class="label">' + c.label + '</div><div class="value">' + c.value + ' <span class="unit">' + c.unit + '</span></div></div>'
  ).join('');
}

// ==============================
// Render Charts
// ==============================
function renderCharts() {
  const m = REPORT_DATA.metrics;

  // CPU - Overview
  if (m.cpu.userLoad.length) {
    new TimeSeriesChart('cpuOverview', {
      series: [
        { label: 'User Load', color: '#3b82f6', data: m.cpu.userLoad, fill: false },
        { label: 'System Load', color: '#f59e0b', data: m.cpu.systemLoad, fill: false }
      ],
      yLabel: 'CPU (%)',
      stacked: true
    });

    // CPU - Full
    new TimeSeriesChart('cpuFull', {
      series: [
        { label: 'User Load', color: '#3b82f6', data: m.cpu.userLoad, fill: false },
        { label: 'System Load', color: '#f59e0b', data: m.cpu.systemLoad, fill: false }
      ],
      yLabel: 'CPU (%)',
      stacked: true
    });
  }

  // Memory - Overview
  if (m.memory.active.length) {
    new TimeSeriesChart('memOverview', {
      series: [
        { label: 'Used', color: '#8b5cf6', data: m.memory.active, fill: false },
        { label: 'Free', color: '#10b981', data: m.memory.available, fill: false }
      ],
      yLabel: 'Memory (MB)',
      stacked: true
    });

    // Memory - Full
    new TimeSeriesChart('memFull', {
      series: [
        { label: 'Used', color: '#8b5cf6', data: m.memory.active, fill: false },
        { label: 'Free', color: '#10b981', data: m.memory.available, fill: false }
      ],
      yLabel: 'Memory (MB)',
      stacked: true
    });
  }

  // Network
  if (m.networkRead.length) {
    new TimeSeriesChart('netRead', {
      series: [{ label: 'Read', color: '#06b6d4', data: m.networkRead, fill: true }],
      yLabel: 'MB'
    });
  }
  if (m.networkWrite.length) {
    new TimeSeriesChart('netWrite', {
      series: [{ label: 'Write', color: '#f97316', data: m.networkWrite, fill: true }],
      yLabel: 'MB'
    });
  }

  // Disk I/O
  if (m.diskRead.length) {
    new TimeSeriesChart('diskRead', {
      series: [{ label: 'Read', color: '#ec4899', data: m.diskRead, fill: true }],
      yLabel: 'MB'
    });
  }
  if (m.diskWrite.length) {
    new TimeSeriesChart('diskWrite', {
      series: [{ label: 'Write', color: '#14b8a6', data: m.diskWrite, fill: true }],
      yLabel: 'MB'
    });
  }

  // Disk Size
  if (m.diskSize.used.length) {
    new TimeSeriesChart('diskSize', {
      series: [
        { label: 'Used', color: '#6366f1', data: m.diskSize.used, fill: false },
        { label: 'Free', color: '#22c55e', data: m.diskSize.available, fill: false }
      ],
      yLabel: 'Disk (MB)',
      stacked: true
    });
  }
}

// ==============================
// Steps Timeline
// ==============================
function renderStepsTimeline() {
  const steps = REPORT_DATA.steps;
  if (!steps || !steps.length) {
    document.getElementById('tab-steps').innerHTML = '<p style="padding:20px;color:var(--text-secondary)">No step data available.</p>';
    return;
  }

  const validSteps = steps.filter(s => s.started_at && s.completed_at);
  if (!validSteps.length) return;

  const globalStart = Math.min(...validSteps.map(s => new Date(s.started_at).getTime()));
  const globalEnd = Math.max(...validSteps.map(s => new Date(s.completed_at).getTime()));
  const totalDuration = globalEnd - globalStart || 1;

  const colors = {
    success: getComputedColor('--success'),
    failure: getComputedColor('--danger'),
    skipped: getComputedColor('--text-secondary'),
    default: getComputedColor('--accent')
  };

  const container = document.getElementById('stepsTimeline');
  container.innerHTML = validSteps.map(step => {
    const start = new Date(step.started_at).getTime();
    const end = new Date(step.completed_at).getTime();
    const left = ((start - globalStart) / totalDuration * 100);
    const width = Math.max(((end - start) / totalDuration * 100), 0.5);
    const color = colors[step.conclusion] || colors.default;
    const duration = end - start;

    return '<div class="timeline-bar-group">' +
      '<div class="timeline-label" title="' + escapeHtmlJs(step.name) + '">' + escapeHtmlJs(step.name) + '</div>' +
      '<div class="timeline-track">' +
        '<div class="timeline-bar" style="left:' + left + '%;width:' + width + '%;background:' + color + '" ' +
        'onmousemove="showTooltip(event.clientX,event.clientY,\\'<div class=tt-title>' + escapeHtmlJs(step.name) + '</div>' +
        '<div class=tt-row><span class=tt-label>Duration</span><span class=tt-value>' + formatDuration(duration) + '</span></div>' +
        '<div class=tt-row><span class=tt-label>Start</span><span class=tt-value>' + formatTime(start) + '</span></div>' +
        '<div class=tt-row><span class=tt-label>Status</span><span class=tt-value>' + (step.conclusion || 'in_progress') + '</span></div>\\')" ' +
        'onmouseleave="hideTooltip()">' +
          '<span class="bar-label">' + formatDuration(duration) + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  // Steps table
  const tableContainer = document.getElementById('stepsTable');
  tableContainer.innerHTML =
    '<table>' +
    '<thead><tr><th>Step</th><th>Status</th><th>Started</th><th>Completed</th><th>Duration</th></tr></thead>' +
    '<tbody>' + validSteps.map(step => {
      const start = new Date(step.started_at).getTime();
      const end = new Date(step.completed_at).getTime();
      const statusClass = step.conclusion === 'success' ? 'status-success' : step.conclusion === 'failure' ? 'status-failure' : 'status-skipped';
      return '<tr>' +
        '<td>' + escapeHtmlJs(step.name) + '</td>' +
        '<td><span class="status-dot ' + statusClass + '"></span>' + (step.conclusion || 'running') + '</td>' +
        '<td>' + formatTime(start) + '</td>' +
        '<td>' + formatTime(end) + '</td>' +
        '<td>' + formatDuration(end - start) + '</td>' +
        '</tr>';
    }).join('') + '</tbody></table>';
}

function escapeHtmlJs(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/:/g, '-');
}

// ==============================
// Process Timeline
// ==============================
function renderProcessTimeline() {
  const processes = REPORT_DATA.processes;
  if (!processes || !processes.length) {
    document.getElementById('tab-processes').innerHTML = '<p style="padding:20px;color:var(--text-secondary)">No process trace data available.</p>';
    return;
  }

  const sortedByDuration = [...processes].sort((a, b) => b.duration - a.duration).slice(0, 100);
  const sortedByStart = [...sortedByDuration].sort((a, b) => a.startTime - b.startTime);
  const globalStart = Math.min(...sortedByStart.map(p => p.startTime));
  const globalEnd = Math.max(...sortedByStart.map(p => p.startTime + p.duration));
  const totalDuration = globalEnd - globalStart || 1;

  const container = document.getElementById('procTimeline');
  const filterInput = document.getElementById('procFilter');
  let allProcesses = processes;

  function renderBars(filtered) {
    const top100 = [...filtered].sort((a, b) => b.duration - a.duration).slice(0, 100);
    const sorted = [...top100].sort((a, b) => a.startTime - b.startTime);

    container.innerHTML = sorted.map(proc => {
      const left = ((proc.startTime - globalStart) / totalDuration * 100);
      const width = Math.max(((proc.duration) / totalDuration * 100), 0.3);
      const color = proc.exitCode !== 0 ? getComputedColor('--danger') : getComputedColor('--accent');

      return '<div class="timeline-bar-group">' +
        '<div class="timeline-label" title="' + escapeHtmlJs(proc.name) + '">' + escapeHtmlJs(proc.name) + ' (PID: ' + proc.pid + ')</div>' +
        '<div class="timeline-track">' +
          '<div class="timeline-bar" style="left:' + left + '%;width:' + width + '%;background:' + color + '" ' +
          'onmousemove="showTooltip(event.clientX,event.clientY,\\'<div class=tt-title>' + escapeHtmlJs(proc.name) + '</div>' +
          '<div class=tt-row><span class=tt-label>Duration</span><span class=tt-value>' + formatDuration(proc.duration) + '</span></div>' +
          '<div class=tt-row><span class=tt-label>PID</span><span class=tt-value>' + proc.pid + '</span></div>' +
          '<div class=tt-row><span class=tt-label>Exit</span><span class=tt-value>' + proc.exitCode + '</span></div>\\')" ' +
          'onmouseleave="hideTooltip()">' +
            '<span class="bar-label">' + formatDuration(proc.duration) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  renderBars(allProcesses);

  if (filterInput) {
    filterInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = q ? allProcesses.filter(p =>
        p.name.toLowerCase().includes(q) || String(p.pid).includes(q) || (p.fileName && p.fileName.toLowerCase().includes(q))
      ) : allProcesses;
      renderBars(filtered);
    });
  }

  // Process table
  let sortCol = 'duration';
  let sortDir = -1;

  function renderTable() {
    const sorted = [...allProcesses].sort((a, b) => {
      const va = a[sortCol], vb = b[sortCol];
      if (typeof va === 'number') return sortDir * (va - vb);
      return sortDir * String(va).localeCompare(String(vb));
    });

    const tableContainer = document.getElementById('procTable');
    tableContainer.innerHTML =
      '<table>' +
      '<thead><tr>' +
        '<th data-col="name">Name</th>' +
        '<th data-col="pid">PID</th>' +
        '<th data-col="ppid">PPID</th>' +
        '<th data-col="startTime">Start</th>' +
        '<th data-col="duration">Duration</th>' +
        '<th data-col="exitCode">Exit Code</th>' +
        '<th data-col="fileName">File</th>' +
      '</tr></thead>' +
      '<tbody>' + sorted.map(proc =>
        '<tr>' +
        '<td>' + escapeHtmlJs(proc.name) + '</td>' +
        '<td>' + proc.pid + '</td>' +
        '<td>' + proc.ppid + '</td>' +
        '<td>' + formatTime(proc.startTime) + '</td>' +
        '<td>' + formatDuration(proc.duration) + '</td>' +
        '<td style="color:' + (proc.exitCode !== 0 ? 'var(--danger)' : 'inherit') + '">' + proc.exitCode + '</td>' +
        '<td>' + escapeHtmlJs(proc.fileName || '') + '</td>' +
        '</tr>'
      ).join('') + '</tbody></table>';

    tableContainer.querySelectorAll('th').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (sortCol === col) sortDir *= -1;
        else { sortCol = col; sortDir = -1; }
        renderTable();
      });
    });
  }

  renderTable();
}

// ==============================
// Initialize
// ==============================
renderSummaryCards();
renderCharts();
renderStepsTimeline();
renderProcessTimeline();
`
}

export async function writeHtmlReport(
  data: ReportData,
  outputDir: string
): Promise<string> {
  const fileName = `workflow-telemetry-${data.runId}.html`
  const outputPath = path.join(outputDir, fileName)

  logger.info(`Generating HTML report at ${outputPath} ...`)

  const html = generateHtmlReport(data)

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(outputPath, html, 'utf-8')

  logger.info(`Generated HTML report: ${outputPath}`)

  return outputPath
}
