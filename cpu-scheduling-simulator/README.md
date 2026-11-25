# Interactive CPU Scheduling Simulator and Performance Analysis

A modern, interactive **Computer Organization and Architecture (COA)** web application for simulating CPU scheduling algorithms, visualizing execution timelines with animated Gantt charts, analyzing process performance metrics, and comparing algorithms side-by-side.

## Features

- **Overview Dashboard**: Real-time KPIs for total processes, selected algorithm, average waiting time, average turnaround time, CPU utilization, throughput, and algorithm summary.
- **Process Management**: Add, edit, delete, validate, load sample presets, and clear processes with `localStorage` persistence.
- **5 CPU Scheduling Algorithms**:
  - **FCFS** (First Come First Serve — Non-Preemptive)
  - **SJF** (Shortest Job First — Non-Preemptive)
  - **SRTF** (Shortest Remaining Time First — Preemptive)
  - **Priority Scheduling** (Non-Preemptive, `1 = Highest Priority`)
  - **Round Robin** (Preemptive with configurable Time Quantum)
- **Interactive Gantt Chart**: Color-coded execution blocks, idle CPU gap visualization, timeline ticks, execution sequence chips, and animated playback with Play/Pause, Reset, and speed controls.
- **Performance Analysis**: Per-process `CT`, `TAT`, `WT`, `RT` table with aggregate averages, CPU utilization, throughput, and CSV export.
- **Algorithm Comparison**: Chart.js bar charts comparing all 5 algorithms on the same dataset and highlighting the best-performing algorithm for each metric.
- **Algorithm Guide**: Built-in educational reference with COA formulas, pros, and cons.

## Project Structure

```text
cpu-scheduling-simulator/
├── index.html      # Application layout and semantic sections
├── style.css       # Dark glassmorphism theme & responsive layout
├── algorithms.js   # Pure CPU scheduling engine & metrics calculator
├── script.js       # UI state, simulation playback, Chart.js & CSV export
└── README.md       # Project documentation
```

## How to Run

1. Open `cpu-scheduling-simulator/index.html` directly in any modern browser, **or**
2. Serve locally using Python:
   ```bash
   cd cpu-scheduling-simulator
   python -m http.server 8080
   ```
   Then open `http://localhost:8080` in your browser.
