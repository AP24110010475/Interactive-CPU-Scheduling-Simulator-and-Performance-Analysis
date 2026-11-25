(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CPUScheduler = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ALGORITHM_META = {
    fcfs: {
      id: 'fcfs',
      name: 'First Come First Serve (FCFS)',
      shortName: 'FCFS',
      preemptive: false,
      summary: 'Executes processes strictly in the order of their arrival time. Simple and starvation-free, but can suffer from the convoy effect.'
    },
    sjf: {
      id: 'sjf',
      name: 'Shortest Job First (SJF)',
      shortName: 'SJF',
      preemptive: false,
      summary: 'Non-preemptively selects the arrived process with the smallest CPU burst time, minimizing average waiting time for a given set of jobs.'
    },
    srtf: {
      id: 'srtf',
      name: 'Shortest Remaining Time First (SRTF)',
      shortName: 'SRTF',
      preemptive: true,
      summary: 'Preemptive version of SJF. Always runs the arrived process with the smallest remaining burst time, preempting when a shorter job arrives.'
    },
    priority: {
      id: 'priority',
      name: 'Priority Scheduling (Non-Preemptive)',
      shortName: 'Priority',
      preemptive: false,
      summary: 'Assigns CPU to the arrived process with the highest priority (lowest priority number). Ties are broken by arrival time.'
    },
    rr: {
      id: 'rr',
      name: 'Round Robin (RR)',
      shortName: 'Round Robin',
      preemptive: true,
      summary: 'Preemptive time-sliced scheduling using a fixed Time Quantum. Provides fair CPU sharing and low response time for interactive workloads.'
    }
  };

  /**
   * Normalizes and clones input processes, preserving original input order.
   */
  function cloneProcesses(processes) {
    return processes.map((p, idx) => ({
      id: String(p.id).trim(),
      at: Number(p.at),
      bt: Number(p.bt),
      priority: Number(p.priority),
      color: p.color || null,
      order: idx,
      remaining: Number(p.bt),
      firstStart: null,
      ct: 0
    }));
  }

  /**
   * Merges adjacent Gantt segments belonging to the same process (or IDLE).
   */
  function pushSegment(timeline, pid, start, end, color) {
    if (end <= start) return;
    const last = timeline[timeline.length - 1];
    if (last && last.pid === pid && last.end === start) {
      last.end = end;
    } else {
      timeline.push({
        pid,
        start,
        end,
        duration: end - start,
        isIdle: pid === 'IDLE',
        color: color || null
      });
    }
    if (timeline.length > 0) {
      const top = timeline[timeline.length - 1];
      top.duration = top.end - top.start;
    }
  }

  /**
   * Computes per-process and aggregate metrics from completed processes & timeline.
   */
  function computeMetrics(algoId, procs, timeline) {
    const n = procs.length;
    if (n === 0) {
      return {
        algorithm: algoId,
        meta: ALGORITHM_META[algoId],
        timeline: [],
        processes: [],
        metrics: {
          avgWT: 0,
          avgTAT: 0,
          avgRT: 0,
          cpuUtilization: 0,
          throughput: 0,
          totalTime: 0,
          totalBurst: 0,
          idleTime: 0
        }
      };
    }

    const totalTime = timeline.length > 0 ? timeline[timeline.length - 1].end : 0;
    let totalBurst = 0;
    let totalWT = 0;
    let totalTAT = 0;
    let totalRT = 0;

    const results = procs
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((p) => {
        const tat = p.ct - p.at;
        const wt = tat - p.bt;
        const rt = p.firstStart - p.at;
        totalBurst += p.bt;
        totalTAT += tat;
        totalWT += wt;
        totalRT += rt;
        return {
          id: p.id,
          at: p.at,
          bt: p.bt,
          priority: p.priority,
          color: p.color,
          firstStart: p.firstStart,
          ct: p.ct,
          tat,
          wt,
          rt
        };
      });

    const idleTime = timeline
      .filter((seg) => seg.isIdle)
      .reduce((acc, seg) => acc + (seg.end - seg.start), 0);

    const cpuUtilization = totalTime > 0 ? (totalBurst / totalTime) * 100 : 0;
    const throughput = totalTime > 0 ? n / totalTime : 0;

    return {
      algorithm: algoId,
      meta: ALGORITHM_META[algoId],
      timeline,
      processes: results,
      metrics: {
        avgWT: totalWT / n,
        avgTAT: totalTAT / n,
        avgRT: totalRT / n,
        cpuUtilization,
        throughput,
        totalTime,
        totalBurst,
        idleTime
      }
    };
  }

  function runFCFS(processes) {
    const procs = cloneProcesses(processes).sort((a, b) => a.at - b.at || a.order - b.order);
    const timeline = [];
    let time = 0;

    for (const p of procs) {
      if (time < p.at) {
        pushSegment(timeline, 'IDLE', time, p.at, null);
        time = p.at;
      }
      p.firstStart = time;
      const end = time + p.bt;
      pushSegment(timeline, p.id, time, end, p.color);
      time = end;
      p.ct = time;
      p.remaining = 0;
    }

    return computeMetrics('fcfs', procs, timeline);
  }

  function runSJF(processes) {
    const procs = cloneProcesses(processes);
    const n = procs.length;
    const timeline = [];
    let time = 0;
    let completed = 0;

    while (completed < n) {
      const ready = procs.filter((p) => p.remaining > 0 && p.at <= time);
      if (ready.length === 0) {
        const nextArrival = Math.min(...procs.filter((p) => p.remaining > 0).map((p) => p.at));
        pushSegment(timeline, 'IDLE', time, nextArrival, null);
        time = nextArrival;
        continue;
      }

      ready.sort((a, b) => a.bt - b.bt || a.at - b.at || a.order - b.order);
      const p = ready[0];
      p.firstStart = time;
      const end = time + p.bt;
      pushSegment(timeline, p.id, time, end, p.color);
      time = end;
      p.ct = time;
      p.remaining = 0;
      completed++;
    }

    return computeMetrics('sjf', procs, timeline);
  }

  function runSRTF(processes) {
    const procs = cloneProcesses(processes);
    const n = procs.length;
    const timeline = [];
    let time = 0;
    let completed = 0;
    let current = null;

    while (completed < n) {
      const ready = procs.filter((p) => p.remaining > 0 && p.at <= time);
      if (ready.length === 0) {
        const nextArrival = Math.min(...procs.filter((p) => p.remaining > 0).map((p) => p.at));
        pushSegment(timeline, 'IDLE', time, nextArrival, null);
        time = nextArrival;
        current = null;
        continue;
      }

      ready.sort((a, b) => {
        if (a.remaining !== b.remaining) return a.remaining - b.remaining;
        if (current && a.id === current.id) return -1;
        if (current && b.id === current.id) return 1;
        return a.at - b.at || a.order - b.order;
      });

      const chosen = ready[0];
      current = chosen;
      if (chosen.firstStart === null) {
        chosen.firstStart = time;
      }

      const futureArrivals = procs
        .filter((p) => p.remaining > 0 && p.at > time)
        .map((p) => p.at);
      const nextArrival = futureArrivals.length > 0 ? Math.min(...futureArrivals) : Infinity;
      const finishTime = time + chosen.remaining;
      const nextEvent = Math.min(finishTime, nextArrival);

      pushSegment(timeline, chosen.id, time, nextEvent, chosen.color);
      chosen.remaining -= nextEvent - time;
      time = nextEvent;

      if (chosen.remaining === 0) {
        chosen.ct = time;
        completed++;
        current = null;
      }
    }

    return computeMetrics('srtf', procs, timeline);
  }

  function runPriority(processes) {
    const procs = cloneProcesses(processes);
    const n = procs.length;
    const timeline = [];
    let time = 0;
    let completed = 0;

    while (completed < n) {
      const ready = procs.filter((p) => p.remaining > 0 && p.at <= time);
      if (ready.length === 0) {
        const nextArrival = Math.min(...procs.filter((p) => p.remaining > 0).map((p) => p.at));
        pushSegment(timeline, 'IDLE', time, nextArrival, null);
        time = nextArrival;
        continue;
      }

      ready.sort((a, b) => a.priority - b.priority || a.at - b.at || a.order - b.order);
      const p = ready[0];
      p.firstStart = time;
      const end = time + p.bt;
      pushSegment(timeline, p.id, time, end, p.color);
      time = end;
      p.ct = time;
      p.remaining = 0;
      completed++;
    }

    return computeMetrics('priority', procs, timeline);
  }

  function runRoundRobin(processes, timeQuantum) {
    const tq = Math.max(1, Math.floor(Number(timeQuantum) || 2));
    const procs = cloneProcesses(processes).sort((a, b) => a.at - b.at || a.order - b.order);
    const n = procs.length;
    const timeline = [];
    if (n === 0) return computeMetrics('rr', procs, timeline);

    const queue = [];
    let nextIdx = 0;
    let time = 0;
    let completed = 0;

    function enqueueArrived(upToTime) {
      while (nextIdx < n && procs[nextIdx].at <= upToTime) {
        queue.push(procs[nextIdx]);
        nextIdx++;
      }
    }

    if (procs[0].at > 0) {
      pushSegment(timeline, 'IDLE', 0, procs[0].at, null);
      time = procs[0].at;
    }
    enqueueArrived(time);

    while (completed < n) {
      if (queue.length === 0) {
        const nextArrival = procs[nextIdx].at;
        pushSegment(timeline, 'IDLE', time, nextArrival, null);
        time = nextArrival;
        enqueueArrived(time);
        continue;
      }

      const p = queue.shift();
      if (p.firstStart === null) {
        p.firstStart = time;
      }

      const exec = Math.min(tq, p.remaining);
      const end = time + exec;
      pushSegment(timeline, p.id, time, end, p.color);
      p.remaining -= exec;
      time = end;

      enqueueArrived(time);

      if (p.remaining > 0) {
        queue.push(p);
      } else {
        p.ct = time;
        completed++;
      }
    }

    return computeMetrics('rr', procs, timeline);
  }

  function simulate(algoId, processes, timeQuantum = 2) {
    switch (algoId) {
      case 'fcfs':
        return runFCFS(processes);
      case 'sjf':
        return runSJF(processes);
      case 'srtf':
        return runSRTF(processes);
      case 'priority':
        return runPriority(processes);
      case 'rr':
        return runRoundRobin(processes, timeQuantum);
      default:
        throw new Error(`Unsupported scheduling algorithm: ${algoId}`);
    }
  }

  function compareAll(processes, timeQuantum = 2) {
    const order = ['fcfs', 'sjf', 'srtf', 'priority', 'rr'];
    return order.map((id) => simulate(id, processes, timeQuantum));
  }

  return {
    ALGORITHM_META,
    simulate,
    compareAll,
    runFCFS,
    runSJF,
    runSRTF,
    runPriority,
    runRoundRobin
  };
}));
