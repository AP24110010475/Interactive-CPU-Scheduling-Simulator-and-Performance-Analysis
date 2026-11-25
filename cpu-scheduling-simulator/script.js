(function () {
  'use strict';

  const STORAGE_KEY = 'coa_cpu_scheduler_state_v1';

  const PROCESS_COLORS = [
    '#8b5cf6',
    '#3b82f6',
    '#06b6d4',
    '#10b981',
    '#f59e0b',
    '#ec4899',
    '#6366f1',
    '#14b8a6',
    '#f97316',
    '#a855f7'
  ];

  const PRESETS = {
    standard: [
      { id: 'P1', at: 0, bt: 5, priority: 2 },
      { id: 'P2', at: 1, bt: 3, priority: 1 },
      { id: 'P3', at: 2, bt: 8, priority: 3 },
      { id: 'P4', at: 3, bt: 6, priority: 2 }
    ],
    idle: [
      { id: 'P1', at: 2, bt: 4, priority: 2 },
      { id: 'P2', at: 8, bt: 3, priority: 1 },
      { id: 'P3', at: 13, bt: 5, priority: 3 }
    ],
    convoy: [
      { id: 'P1', at: 0, bt: 24, priority: 3 },
      { id: 'P2', at: 1, bt: 3, priority: 1 },
      { id: 'P3', at: 2, bt: 3, priority: 2 }
    ],
    burst: [
      { id: 'P1', at: 0, bt: 7, priority: 3 },
      { id: 'P2', at: 2, bt: 4, priority: 1 },
      { id: 'P3', at: 4, bt: 1, priority: 4 },
      { id: 'P4', at: 5, bt: 4, priority: 2 },
      { id: 'P5', at: 6, bt: 2, priority: 2 }
    ]
  };

  // Application State
  const state = {
    processes: [],
    algorithm: 'fcfs',
    timeQuantum: 2,
    speedMs: 500,
    lastResult: null,
    comparisonResults: [],
    anim: {
      active: false,
      paused: false,
      currentTime: 0,
      totalTime: 0,
      timerId: null
    },
    charts: {
      time: null,
      util: null,
      throughput: null
    }
  };

  // DOM Elements
  const el = {
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    menuToggleBtn: document.getElementById('menuToggleBtn'),
    closeSidebarBtn: document.getElementById('closeSidebarBtn'),
    navLinks: document.querySelectorAll('.nav-link'),

    datasetPreset: document.getElementById('datasetPreset'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    algorithmSelect: document.getElementById('algorithmSelect'),
    quantumGroup: document.getElementById('quantumGroup'),
    timeQuantumInput: document.getElementById('timeQuantumInput'),
    speedSelect: document.getElementById('speedSelect'),
    startSimBtn: document.getElementById('startSimBtn'),
    mobileRunBtn: document.getElementById('mobileRunBtn'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    playPauseLabel: document.getElementById('playPauseLabel'),
    resetSimBtn: document.getElementById('resetSimBtn'),

    simStatusBadge: document.getElementById('simStatusBadge'),
    kpiTotalProcesses: document.getElementById('kpiTotalProcesses'),
    kpiTotalBurst: document.getElementById('kpiTotalBurst'),
    kpiAlgorithm: document.getElementById('kpiAlgorithm'),
    kpiAlgorithmType: document.getElementById('kpiAlgorithmType'),
    kpiAvgWT: document.getElementById('kpiAvgWT'),
    kpiAvgTAT: document.getElementById('kpiAvgTAT'),
    kpiCpuUtil: document.getElementById('kpiCpuUtil'),
    kpiThroughput: document.getElementById('kpiThroughput'),
    summaryAlgoTitle: document.getElementById('summaryAlgoTitle'),
    summaryAlgoDesc: document.getElementById('summaryAlgoDesc'),

    loadSampleBtn: document.getElementById('loadSampleBtn'),
    clearProcessesBtn: document.getElementById('clearProcessesBtn'),
    processForm: document.getElementById('processForm'),
    formTitle: document.getElementById('formTitle'),
    editingIndex: document.getElementById('editingIndex'),
    procIdInput: document.getElementById('procIdInput'),
    procAtInput: document.getElementById('procAtInput'),
    procBtInput: document.getElementById('procBtInput'),
    procPrioInput: document.getElementById('procPrioInput'),
    formError: document.getElementById('formError'),
    submitProcLabel: document.getElementById('submitProcLabel'),
    cancelEditBtn: document.getElementById('cancelEditBtn'),
    procCountBadge: document.getElementById('procCountBadge'),
    processTableBody: document.getElementById('processTableBody'),

    simClockDisplay: document.getElementById('simClockDisplay'),
    simTotalTimeDisplay: document.getElementById('simTotalTimeDisplay'),
    simActiveProc: document.getElementById('simActiveProc'),
    simProgressBar: document.getElementById('simProgressBar'),
    ganttLegend: document.getElementById('ganttLegend'),
    ganttChartContainer: document.getElementById('ganttChartContainer'),
    executionSequence: document.getElementById('executionSequence'),

    metricsSummaryPills: document.getElementById('metricsSummaryPills'),
    metricsTableBody: document.getElementById('metricsTableBody'),
    metricsTableFoot: document.getElementById('metricsTableFoot'),

    bestPerformersGrid: document.getElementById('bestPerformersGrid'),
    comparisonTableBody: document.getElementById('comparisonTableBody'),

    toastContainer: document.getElementById('toastContainer')
  };

  function assignColors(list) {
    return list.map((p, idx) => ({
      ...p,
      color: p.color || PROCESS_COLORS[idx % PROCESS_COLORS.length]
    }));
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          processes: state.processes,
          algorithm: state.algorithm,
          timeQuantum: state.timeQuantum
        })
      );
    } catch (_) {
      // Ignore storage quota or privacy mode errors
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.processes)) {
          state.processes = assignColors(parsed.processes);
        }
        if (parsed.algorithm && CPUScheduler.ALGORITHM_META[parsed.algorithm]) {
          state.algorithm = parsed.algorithm;
        }
        if (parsed.timeQuantum && Number(parsed.timeQuantum) >= 1) {
          state.timeQuantum = Math.floor(Number(parsed.timeQuantum));
        }
        return;
      }
    } catch (_) {
      // Fall back to default preset
    }
    state.processes = assignColors(PRESETS.standard);
  }

  function suggestNextProcessId() {
    let n = state.processes.length + 1;
    const existing = new Set(state.processes.map((p) => p.id.toUpperCase()));
    while (existing.has(`P${n}`)) n++;
    return `P${n}`;
  }

  function syncQuantumVisibility() {
    const isRR = state.algorithm === 'rr';
    el.quantumGroup.classList.toggle('disabled', !isRR);
    el.timeQuantumInput.disabled = !isRR;
  }

  function setStatusBadge(mode, text) {
    el.simStatusBadge.className = `status-pill status-${mode}`;
    el.simStatusBadge.textContent = text;
  }

  // Stop any running animation timer
  function stopAnimation(resetToFull = true) {
    if (state.anim.timerId) {
      clearInterval(state.anim.timerId);
      state.anim.timerId = null;
    }
    state.anim.active = false;
    state.anim.paused = false;
    el.playPauseBtn.disabled = true;
    el.playPauseLabel.textContent = 'Pause';

    if (resetToFull && state.lastResult) {
      const total = state.lastResult.metrics.totalTime;
      state.anim.currentTime = total;
      state.anim.totalTime = total;
      setStatusBadge(state.processes.length ? 'done' : 'ready', state.processes.length ? 'Completed' : 'Simulation Ready');
      renderGantt(state.lastResult, total, false);
    }
  }

  function runAndRenderAll() {
    stopAnimation(false);

    state.lastResult = CPUScheduler.simulate(
      state.algorithm,
      state.processes,
      state.timeQuantum
    );
    state.comparisonResults = CPUScheduler.compareAll(
      state.processes,
      state.timeQuantum
    );

    const total = state.lastResult.metrics.totalTime;
    state.anim.currentTime = total;
    state.anim.totalTime = total;

    renderDashboard(state.lastResult);
    renderProcessTable();
    renderGantt(state.lastResult, total, false);
    renderPerformanceTable(state.lastResult);
    renderComparison(state.comparisonResults);
    setStatusBadge(state.processes.length ? 'done' : 'ready', state.processes.length ? 'Calculated' : 'No Processes');
    saveState();
  }

  function renderDashboard(result) {
    const { meta, metrics } = result;
    el.kpiTotalProcesses.textContent = String(state.processes.length);
    el.kpiTotalBurst.textContent = `Total Burst: ${metrics.totalBurst} units`;

    el.kpiAlgorithm.textContent =
      state.algorithm === 'rr' ? `Round Robin (Q=${state.timeQuantum})` : meta.shortName;
    el.kpiAlgorithmType.textContent = meta.preemptive ? 'Preemptive' : 'Non-Preemptive';

    el.kpiAvgWT.textContent = metrics.avgWT.toFixed(2);
    el.kpiAvgTAT.textContent = metrics.avgTAT.toFixed(2);
    el.kpiCpuUtil.textContent = `${metrics.cpuUtilization.toFixed(1)}%`;
    el.kpiThroughput.textContent = `Throughput: ${metrics.throughput.toFixed(3)} proc/unit`;

    el.summaryAlgoTitle.textContent = meta.name;
    el.summaryAlgoDesc.textContent = meta.summary;
  }

  function renderProcessTable() {
    el.procCountBadge.textContent = String(state.processes.length);

    if (state.processes.length === 0) {
      el.processTableBody.innerHTML =
        '<tr><td colspan="5" class="empty-state">No processes added. Add a process or click "Load Sample".</td></tr>';
      return;
    }

    el.processTableBody.innerHTML = state.processes
      .map(
        (p, idx) => `
      <tr>
        <td>
          <span class="proc-pill">
            <span class="proc-dot" style="background:${p.color}"></span>
            ${escapeHtml(p.id)}
          </span>
        </td>
        <td class="mono">${p.at}</td>
        <td class="mono">${p.bt}</td>
        <td class="mono">${p.priority}</td>
        <td class="text-right">
          <div class="row-actions">
            <button class="icon-btn" data-action="edit" data-index="${idx}" title="Edit ${escapeHtml(p.id)}">
              <i data-lucide="pencil"></i>
            </button>
            <button class="icon-btn" data-action="delete" data-index="${idx}" title="Delete ${escapeHtml(p.id)}">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>`
      )
      .join('');

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function renderGantt(result, currentTime, isAnimating) {
    const { timeline, metrics } = result;
    const totalTime = metrics.totalTime;

    el.simClockDisplay.textContent = String(currentTime);
    el.simTotalTimeDisplay.textContent = String(totalTime);

    const pct = totalTime > 0 ? Math.min(100, (currentTime / totalTime) * 100) : 0;
    el.simProgressBar.style.width = `${pct}%`;

    // Legend
    const legendHtml = state.processes
      .map(
        (p) =>
          `<span class="legend-item"><span class="proc-dot" style="background:${p.color}"></span>${escapeHtml(p.id)}</span>`
      )
      .join('');
    const hasIdle = timeline.some((seg) => seg.isIdle);
    el.ganttLegend.innerHTML =
      legendHtml +
      (hasIdle
        ? '<span class="legend-item"><span class="proc-dot" style="background:#64748b"></span>CPU Idle</span>'
        : '');

    if (timeline.length === 0 || totalTime === 0) {
      el.ganttChartContainer.innerHTML =
        '<div class="empty-state">Add processes to generate the Gantt chart.</div>';
      el.executionSequence.innerHTML = '<span class="hint-text">None</span>';
      el.simActiveProc.textContent = 'Idle';
      return;
    }

    // Active process at currentTime
    let activeLabel = 'Completed';
    if (isAnimating && currentTime < totalTime) {
      const seg = timeline.find((s) => currentTime >= s.start && currentTime < s.end);
      activeLabel = seg ? (seg.isIdle ? 'CPU Idle' : seg.pid) : 'Idle';
    } else if (!isAnimating) {
      activeLabel = 'All Completed';
    }
    el.simActiveProc.textContent = activeLabel;

    const blocksHtml = timeline
      .map((seg, idx) => {
        const widthPct = ((seg.end - seg.start) / totalTime) * 100;
        const isFuture = isAnimating && currentTime <= seg.start;
        const isActive =
          isAnimating && currentTime >= seg.start && currentTime < seg.end;

        const classes = ['gantt-block'];
        if (seg.isIdle) classes.push('is-idle');
        if (isFuture) classes.push('is-future');
        if (isActive) classes.push('is-active');

        const bgStyle = seg.isIdle
          ? ''
          : `background: linear-gradient(135deg, ${seg.color}, ${adjustHex(seg.color, -25)});`;

        const startTick =
          idx === 0 ? `<span class="gantt-tick gantt-tick-start">${seg.start}</span>` : '';
        const endTick = `<span class="gantt-tick gantt-tick-end">${seg.end}</span>`;

        return `
          <div class="${classes.join(' ')}"
               style="width: ${widthPct}%; ${bgStyle}"
               title="${escapeHtml(seg.pid)}: ${seg.start} → ${seg.end} (Duration: ${seg.duration})">
            <span>${escapeHtml(seg.pid)}</span>
            <span class="gantt-block-sub">${seg.duration}u</span>
            ${startTick}
            ${endTick}
          </div>`;
      })
      .join('');

    el.ganttChartContainer.innerHTML = `<div class="gantt-track">${blocksHtml}</div>`;

    // Execution sequence chips
    el.executionSequence.innerHTML = timeline
      .map((seg, i) => {
        const chip = `<span class="seq-chip" style="border-color:${
          seg.isIdle ? 'rgba(148,163,184,0.35)' : seg.color
        }">${escapeHtml(seg.pid)} (${seg.start}–${seg.end})</span>`;
        return i < timeline.length - 1 ? `${chip}<span class="seq-arrow">→</span>` : chip;
      })
      .join('');
  }

  function renderPerformanceTable(result) {
    const { processes, metrics } = result;

    el.metricsSummaryPills.innerHTML = `
      <span class="metric-pill">Avg RT: <strong>${metrics.avgRT.toFixed(2)}</strong></span>
      <span class="metric-pill">Idle Time: <strong>${metrics.idleTime}</strong></span>
      <span class="metric-pill">Total Time: <strong>${metrics.totalTime}</strong></span>
    `;

    if (processes.length === 0) {
      el.metricsTableBody.innerHTML =
        '<tr><td colspan="8" class="empty-state">No performance data available.</td></tr>';
      el.metricsTableFoot.innerHTML = '';
      return;
    }

    el.metricsTableBody.innerHTML = processes
      .map(
        (p) => `
      <tr>
        <td>
          <span class="proc-pill">
            <span class="proc-dot" style="background:${p.color}"></span>
            ${escapeHtml(p.id)}
          </span>
        </td>
        <td class="mono">${p.at}</td>
        <td class="mono">${p.bt}</td>
        <td class="mono">${p.priority}</td>
        <td class="mono">${p.ct}</td>
        <td class="mono">${p.tat}</td>
        <td class="mono">${p.wt}</td>
        <td class="mono">${p.rt}</td>
      </tr>`
      )
      .join('');

    el.metricsTableFoot.innerHTML = `
      <tr>
        <td colspan="4">Average / Aggregate</td>
        <td class="mono">Max: ${metrics.totalTime}</td>
        <td class="mono">${metrics.avgTAT.toFixed(2)}</td>
        <td class="mono">${metrics.avgWT.toFixed(2)}</td>
        <td class="mono">${metrics.avgRT.toFixed(2)}</td>
      </tr>
    `;
  }

  function renderComparison(results) {
    if (state.processes.length === 0) {
      el.bestPerformersGrid.innerHTML = '';
      el.comparisonTableBody.innerHTML =
        '<tr><td colspan="7" class="empty-state">Add processes to compare algorithms.</td></tr>';
      destroyCharts();
      return;
    }

    const bestWT = Math.min(...results.map((r) => r.metrics.avgWT));
    const bestTAT = Math.min(...results.map((r) => r.metrics.avgTAT));
    const bestRT = Math.min(...results.map((r) => r.metrics.avgRT));
    const bestUtil = Math.max(...results.map((r) => r.metrics.cpuUtilization));
    const bestTP = Math.max(...results.map((r) => r.metrics.throughput));

    const winnerNames = (pred) =>
      results
        .filter(pred)
        .map((r) => r.meta.shortName)
        .join(', ');

    const badges = [
      {
        label: 'Lowest Avg WT',
        winner: winnerNames((r) => Math.abs(r.metrics.avgWT - bestWT) < 1e-6),
        val: `${bestWT.toFixed(2)} units`
      },
      {
        label: 'Lowest Avg TAT',
        winner: winnerNames((r) => Math.abs(r.metrics.avgTAT - bestTAT) < 1e-6),
        val: `${bestTAT.toFixed(2)} units`
      },
      {
        label: 'Lowest Avg RT',
        winner: winnerNames((r) => Math.abs(r.metrics.avgRT - bestRT) < 1e-6),
        val: `${bestRT.toFixed(2)} units`
      },
      {
        label: 'Highest CPU Util',
        winner: winnerNames((r) => Math.abs(r.metrics.cpuUtilization - bestUtil) < 1e-6),
        val: `${bestUtil.toFixed(1)}%`
      },
      {
        label: 'Highest Throughput',
        winner: winnerNames((r) => Math.abs(r.metrics.throughput - bestTP) < 1e-6),
        val: `${bestTP.toFixed(3)} proc/u`
      }
    ];

    el.bestPerformersGrid.innerHTML = badges
      .map(
        (b) => `
      <div class="glass-card best-badge-card">
        <span class="best-badge-label">${b.label}</span>
        <span class="best-badge-winner">${escapeHtml(b.winner)}</span>
        <span class="best-badge-val">${b.val}</span>
      </div>`
      )
      .join('');

    el.comparisonTableBody.innerHTML = results
      .map((r) => {
        const m = r.metrics;
        const isBestWT = Math.abs(m.avgWT - bestWT) < 1e-6;
        const isBestTAT = Math.abs(m.avgTAT - bestTAT) < 1e-6;
        const isBestRT = Math.abs(m.avgRT - bestRT) < 1e-6;
        const isBestUtil = Math.abs(m.cpuUtilization - bestUtil) < 1e-6;
        const isBestTP = Math.abs(m.throughput - bestTP) < 1e-6;

        const label =
          r.algorithm === 'rr' ? `Round Robin (Q=${state.timeQuantum})` : r.meta.shortName;

        return `
        <tr>
          <td><strong>${escapeHtml(label)}</strong></td>
          <td class="mono ${isBestWT ? 'winner-cell' : ''}">${m.avgWT.toFixed(2)}${isBestWT ? '<span class="winner-tag">Best</span>' : ''}</td>
          <td class="mono ${isBestTAT ? 'winner-cell' : ''}">${m.avgTAT.toFixed(2)}${isBestTAT ? '<span class="winner-tag">Best</span>' : ''}</td>
          <td class="mono ${isBestRT ? 'winner-cell' : ''}">${m.avgRT.toFixed(2)}${isBestRT ? '<span class="winner-tag">Best</span>' : ''}</td>
          <td class="mono ${isBestUtil ? 'winner-cell' : ''}">${m.cpuUtilization.toFixed(1)}%</td>
          <td class="mono ${isBestTP ? 'winner-cell' : ''}">${m.throughput.toFixed(3)}</td>
          <td class="mono">${m.totalTime}</td>
        </tr>`;
      })
      .join('');

    renderComparisonCharts(results);
  }

  function destroyCharts() {
    ['time', 'util', 'throughput'].forEach((key) => {
      if (state.charts[key]) {
        state.charts[key].destroy();
        state.charts[key] = null;
      }
    });
  }

  function renderComparisonCharts(results) {
    if (typeof Chart === 'undefined') return;
    destroyCharts();

    const labels = results.map((r) =>
      r.algorithm === 'rr' ? `RR (Q=${state.timeQuantum})` : r.meta.shortName
    );

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#cbd5e1', font: { family: 'Inter', size: 11 } }
        }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(255,255,255,0.06)' }
        }
      }
    };

    const timeCtx = document.getElementById('timeComparisonChart').getContext('2d');
    state.charts.time = new Chart(timeCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Avg WT',
            data: results.map((r) => Number(r.metrics.avgWT.toFixed(2))),
            backgroundColor: 'rgba(6, 182, 212, 0.78)',
            borderRadius: 6
          },
          {
            label: 'Avg TAT',
            data: results.map((r) => Number(r.metrics.avgTAT.toFixed(2))),
            backgroundColor: 'rgba(139, 92, 246, 0.78)',
            borderRadius: 6
          },
          {
            label: 'Avg RT',
            data: results.map((r) => Number(r.metrics.avgRT.toFixed(2))),
            backgroundColor: 'rgba(59, 130, 246, 0.78)',
            borderRadius: 6
          }
        ]
      },
      options: commonOptions
    });

    const utilCtx = document.getElementById('utilComparisonChart').getContext('2d');
    state.charts.util = new Chart(utilCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'CPU Utilization (%)',
            data: results.map((r) => Number(r.metrics.cpuUtilization.toFixed(2))),
            backgroundColor: 'rgba(16, 185, 129, 0.78)',
            borderRadius: 6
          }
        ]
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: { ...commonOptions.scales.y, max: 105 }
        }
      }
    });

    const tpCtx = document.getElementById('throughputComparisonChart').getContext('2d');
    state.charts.throughput = new Chart(tpCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Throughput (proc/unit)',
            data: results.map((r) => Number(r.metrics.throughput.toFixed(4))),
            backgroundColor: 'rgba(245, 158, 11, 0.78)',
            borderRadius: 6
          }
        ]
      },
      options: commonOptions
    });
  }

  // Animated Simulation Playback
  function startAnimatedSimulation() {
    if (state.processes.length === 0) {
      showToast('Please add at least one process to simulate.');
      return;
    }

    stopAnimation(false);
    state.lastResult = CPUScheduler.simulate(
      state.algorithm,
      state.processes,
      state.timeQuantum
    );
    const total = state.lastResult.metrics.totalTime;
    state.anim.active = true;
    state.anim.paused = false;
    state.anim.currentTime = 0;
    state.anim.totalTime = total;

    el.playPauseBtn.disabled = false;
    el.playPauseLabel.textContent = 'Pause';
    setStatusBadge('running', 'Simulating...');
    renderGantt(state.lastResult, 0, true);

    const stepTick = () => {
      if (state.anim.paused) return;
      if (state.anim.currentTime >= state.anim.totalTime) {
        stopAnimation(true);
        showToast(`${state.lastResult.meta.shortName} simulation completed!`);
        return;
      }
      state.anim.currentTime += 1;
      renderGantt(state.lastResult, state.anim.currentTime, true);
    };

    state.anim.timerId = setInterval(stepTick, state.speedMs);
  }

  function togglePlayPause() {
    if (!state.anim.active) return;
    state.anim.paused = !state.anim.paused;
    el.playPauseLabel.textContent = state.anim.paused ? 'Resume' : 'Pause';
    setStatusBadge(
      state.anim.paused ? 'paused' : 'running',
      state.anim.paused ? 'Paused' : 'Simulating...'
    );
  }

  // Form Handling
  function showFormError(msg) {
    el.formError.textContent = msg;
    el.formError.hidden = false;
  }

  function clearFormError() {
    el.formError.textContent = '';
    el.formError.hidden = true;
  }

  function resetForm() {
    el.editingIndex.value = '-1';
    el.formTitle.textContent = 'Add New Process';
    el.submitProcLabel.textContent = 'Add Process';
    el.cancelEditBtn.hidden = true;
    el.procIdInput.value = suggestNextProcessId();
    el.procAtInput.value = '0';
    el.procBtInput.value = '4';
    el.procPrioInput.value = '1';
    clearFormError();
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    clearFormError();

    const id = el.procIdInput.value.trim();
    const at = Number(el.procAtInput.value);
    const bt = Number(el.procBtInput.value);
    const priority = Number(el.procPrioInput.value);
    const editIdx = Number(el.editingIndex.value);

    if (!id) {
      showFormError('Process ID is required.');
      return;
    }
    if (!Number.isInteger(at) || at < 0) {
      showFormError('Arrival Time must be an integer >= 0.');
      return;
    }
    if (!Number.isInteger(bt) || bt < 1) {
      showFormError('Burst Time must be an integer >= 1.');
      return;
    }
    if (!Number.isInteger(priority) || priority < 1) {
      showFormError('Priority must be an integer >= 1.');
      return;
    }

    const duplicateIdx = state.processes.findIndex(
      (p, idx) => p.id.toLowerCase() === id.toLowerCase() && idx !== editIdx
    );
    if (duplicateIdx !== -1) {
      showFormError(`Process ID "${id}" already exists.`);
      return;
    }

    if (editIdx >= 0 && editIdx < state.processes.length) {
      const existingColor = state.processes[editIdx].color;
      state.processes[editIdx] = { id, at, bt, priority, color: existingColor };
      showToast(`Updated process ${id}.`);
    } else {
      const color = PROCESS_COLORS[state.processes.length % PROCESS_COLORS.length];
      state.processes.push({ id, at, bt, priority, color });
      showToast(`Added process ${id}.`);
    }

    resetForm();
    runAndRenderAll();
  }

  function exportCsv() {
    if (!state.lastResult || state.lastResult.processes.length === 0) {
      showToast('Nothing to export. Add processes first.');
      return;
    }

    const { meta, processes, metrics } = state.lastResult;
    const lines = [
      `Algorithm,${meta.name}`,
      ...(state.algorithm === 'rr' ? [`Time Quantum,${state.timeQuantum}`] : []),
      '',
      'Process ID,Arrival Time,Burst Time,Priority,Completion Time,Turnaround Time,Waiting Time,Response Time',
      ...processes.map(
        (p) => `${p.id},${p.at},${p.bt},${p.priority},${p.ct},${p.tat},${p.wt},${p.rt}`
      ),
      '',
      `Average Waiting Time,${metrics.avgWT.toFixed(2)}`,
      `Average Turnaround Time,${metrics.avgTAT.toFixed(2)}`,
      `Average Response Time,${metrics.avgRT.toFixed(2)}`,
      `CPU Utilization (%),${metrics.cpuUtilization.toFixed(2)}`,
      `Throughput (proc/unit),${metrics.throughput.toFixed(4)}`
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cpu-scheduling-${state.algorithm}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Exported performance results as CSV.');
  }

  // Utilities
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function adjustHex(hex, amount) {
    if (!hex || !hex.startsWith('#') || hex.length !== 7) return '#1e293b';
    const num = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  function closeMobileSidebar() {
    el.sidebar.classList.remove('open');
    el.sidebarOverlay.classList.remove('show');
  }

  // Event Listeners
  function bindEvents() {
    el.menuToggleBtn.addEventListener('click', () => {
      el.sidebar.classList.add('open');
      el.sidebarOverlay.classList.add('show');
    });
    el.closeSidebarBtn.addEventListener('click', closeMobileSidebar);
    el.sidebarOverlay.addEventListener('click', closeMobileSidebar);

    el.navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        el.navLinks.forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
        closeMobileSidebar();
      });
    });

    el.algorithmSelect.addEventListener('change', (e) => {
      state.algorithm = e.target.value;
      syncQuantumVisibility();
      runAndRenderAll();
    });

    el.timeQuantumInput.addEventListener('change', () => {
      const val = Math.floor(Number(el.timeQuantumInput.value));
      if (!Number.isInteger(val) || val < 1) {
        el.timeQuantumInput.value = String(state.timeQuantum);
        showToast('Time Quantum must be at least 1.');
        return;
      }
      state.timeQuantum = val;
      runAndRenderAll();
    });

    el.speedSelect.addEventListener('change', (e) => {
      state.speedMs = Number(e.target.value);
      if (state.anim.active) {
        startAnimatedSimulation();
      }
    });

    el.startSimBtn.addEventListener('click', startAnimatedSimulation);
    el.mobileRunBtn.addEventListener('click', startAnimatedSimulation);
    el.playPauseBtn.addEventListener('click', togglePlayPause);
    el.resetSimBtn.addEventListener('click', () => {
      stopAnimation(true);
      showToast('Simulation reset.');
    });

    el.datasetPreset.addEventListener('change', (e) => {
      const key = e.target.value;
      if (PRESETS[key]) {
        state.processes = assignColors(PRESETS[key]);
        resetForm();
        runAndRenderAll();
        showToast(`Loaded "${key}" dataset.`);
      }
    });

    el.loadSampleBtn.addEventListener('click', () => {
      state.processes = assignColors(PRESETS.standard);
      el.datasetPreset.value = 'standard';
      resetForm();
      runAndRenderAll();
      showToast('Loaded standard COA sample processes.');
    });

    el.clearProcessesBtn.addEventListener('click', () => {
      state.processes = [];
      resetForm();
      runAndRenderAll();
      showToast('Cleared all processes.');
    });

    el.processForm.addEventListener('submit', handleFormSubmit);
    el.cancelEditBtn.addEventListener('click', resetForm);

    el.processTableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const idx = Number(btn.dataset.index);
      const action = btn.dataset.action;

      if (action === 'delete') {
        const removed = state.processes.splice(idx, 1)[0];
        resetForm();
        runAndRenderAll();
        showToast(`Deleted process ${removed.id}.`);
      } else if (action === 'edit') {
        const proc = state.processes[idx];
        el.editingIndex.value = String(idx);
        el.formTitle.textContent = `Edit Process (${proc.id})`;
        el.submitProcLabel.textContent = 'Save Changes';
        el.cancelEditBtn.hidden = false;
        el.procIdInput.value = proc.id;
        el.procAtInput.value = String(proc.at);
        el.procBtInput.value = String(proc.bt);
        el.procPrioInput.value = String(proc.priority);
        clearFormError();
        el.procIdInput.focus();
      }
    });

    el.exportCsvBtn.addEventListener('click', exportCsv);
  }

  function init() {
    loadState();
    el.algorithmSelect.value = state.algorithm;
    el.timeQuantumInput.value = String(state.timeQuantum);
    syncQuantumVisibility();
    resetForm();
    bindEvents();
    runAndRenderAll();
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
