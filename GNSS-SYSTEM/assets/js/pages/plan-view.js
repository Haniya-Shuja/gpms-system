/* =========================================================
   PLAN VIEW PAGE  -  position scatter + North/East/Height graphs
   ========================================================= */

/* =========================================================
   CANVAS RENDERING ENGINE (WHITE THEME FOR ALL 4 GRAPHS)
   ========================================================= */

const planCanvas = document.getElementById("planCanvas");
const northCanvas = document.getElementById("northCanvas");
const eastCanvas = document.getElementById("eastCanvas");
const heightCanvas = document.getElementById("heightCanvas");

const planCtx = planCanvas.getContext("2d");
const northCtx = northCanvas.getContext("2d");
const eastCtx = eastCanvas.getContext("2d");
const heightCtx = heightCanvas.getContext("2d");

let liveMode = true;
let currentIndex = 0;
const totalPoints = 300;

// Synthetic Data Generation Matching Real GNSS Telemetry
const timeLabels = ["01:00:00", "01:10:00", "01:20:00", "01:30:00", "01:40:00", "01:50:00"];
const northData = [];
const eastData = [];
const heightData = [];

// Seed baseline offsets
const northBase = 2760266.0;
const eastBase = 3118146.0;
const heightBase = 51.5;

for (let i = 0; i < totalPoints; i++) {
  const t = i / 14;
  
  // High-frequency spikes typical in satellite telemetry
  const spikeN = (i > 180 && i < 225 && i % 4 === 0) ? (Math.random() * 1.4) : 0;
  const spikeE = (i > 175 && i < 220 && i % 3 === 0) ? (Math.random() * 1.8) : 0;
  const spikeH = (i > 185 && i < 230 && i % 4 === 0) ? (Math.random() * 2.2) : 0;

  const n = northBase + Math.sin(t * 0.45) * 0.75 + Math.cos(t * 1.2) * 0.35 + spikeN + (Math.random() - 0.5) * 0.08;
  const e = eastBase + Math.cos(t * 0.42) * 1.85 + Math.sin(t * 1.1) * 0.95 + spikeE + (Math.random() - 0.5) * 0.12;
  const h = heightBase + Math.sin(t * 0.38) * 1.20 + Math.cos(t * 0.85) * 0.65 + spikeH + (Math.random() - 0.5) * 0.15;

  northData.push(n);
  eastData.push(e);
  heightData.push(h);
}

function resizeCanvas(canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeAll() {
  resizeCanvas(planCanvas, planCtx);
  resizeCanvas(northCanvas, northCtx);
  resizeCanvas(eastCanvas, eastCtx);
  resizeCanvas(heightCanvas, heightCtx);
  drawAll();
}

window.addEventListener("resize", resizeAll);

/* Common Grid for White Theme */
function drawLightGrid(ctx, width, height, padding, vTicks, hTicks) {
  // Pure White Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;

  // Vertical Lines
  for (let i = 0; i <= vTicks; i++) {
    const x = padding.left + ((width - padding.left - padding.right) / vTicks) * i;
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
    ctx.stroke();
  }

  // Horizontal Lines
  for (let i = 0; i <= hTicks; i++) {
    const y = padding.top + ((height - padding.top - padding.bottom) / hTicks) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // Boundary Frame
  ctx.strokeStyle = "#cbd5e1";
  ctx.strokeRect(padding.left, padding.top, width - padding.left - padding.right, height - padding.top - padding.bottom);
}

/* 1. Plan View 2D Scatter / Trajectory */
function drawPlanGraph() {
  const width = planCanvas.clientWidth;
  const height = planCanvas.clientHeight;
  if (width <= 0 || height <= 0) return;

  const padding = { left: 45, right: 18, top: 18, bottom: 32 };
  drawLightGrid(planCtx, width, height, padding, 8, 6);

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const cx = padding.left + plotW / 2;
  const cy = padding.top + plotH / 2;

  // Center axes
  planCtx.strokeStyle = "#cbd5e1";
  planCtx.lineWidth = 1;
  planCtx.beginPath();
  planCtx.moveTo(padding.left, cy);
  planCtx.lineTo(width - padding.right, cy);
  planCtx.moveTo(cx, padding.top);
  planCtx.lineTo(cx, height - padding.bottom);
  planCtx.stroke();

  // Axis Labels
  planCtx.fillStyle = "#64748b";
  planCtx.font = "8.5px Arial";
  planCtx.textAlign = "center";
  planCtx.fillText("East (m)", cx, height - 8);

  planCtx.save();
  planCtx.translate(14, cy);
  planCtx.rotate(-Math.PI / 2);
  planCtx.fillText("North (m)", 0, 0);
  planCtx.restore();

  // Scatter Trajectory Points
  const count = liveMode ? Math.max(5, currentIndex) : totalPoints;

  // Trace line
  planCtx.beginPath();
  for (let i = 0; i < count; i++) {
    const normE = (eastData[i] - eastBase) / 4.0;
    const normN = (northData[i] - northBase) / 2.5;

    const x = cx + normE * (plotW * 0.42);
    const y = cy - normN * (plotH * 0.42);

    if (i === 0) planCtx.moveTo(x, y);
    else planCtx.lineTo(x, y);
  }
  planCtx.strokeStyle = "rgba(234, 88, 12, 0.45)";
  planCtx.lineWidth = 1.2;
  planCtx.stroke();

  // Fine Scatter Points (SciChart style cluster)
  for (let i = 0; i < count; i++) {
    const normE = (eastData[i] - eastBase) / 4.0;
    const normN = (northData[i] - northBase) / 2.5;

    const x = cx + normE * (plotW * 0.42);
    const y = cy - normN * (plotH * 0.42);

    planCtx.fillStyle = "#d97706";
    planCtx.fillRect(x - 1, y - 1, 2, 2);
  }

  // Active Live Head Marker
  if (count > 0) {
    const last = count - 1;
    const normE = (eastData[last] - eastBase) / 4.0;
    const normN = (northData[last] - northBase) / 2.5;
    const lx = cx + normE * (plotW * 0.42);
    const ly = cy - normN * (plotH * 0.42);

    planCtx.beginPath();
    planCtx.arc(lx, ly, 3.5, 0, Math.PI * 2);
    planCtx.fillStyle = "#2563eb";
    planCtx.fill();
    planCtx.lineWidth = 1.5;
    planCtx.strokeStyle = "#ffffff";
    planCtx.stroke();
  }
}

/* Generic Time-Series Graph for White Theme */
function drawTimeSeriesGraph(canvas, ctx, data, yLabel, unit) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width <= 0 || height <= 0) return;

  const padding = { left: 58, right: 18, top: 18, bottom: 32 };
  drawLightGrid(ctx, width, height, padding, 5, 5);

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  let min = Math.min(...data);
  let max = Math.max(...data);
  const diff = max - min || 1;
  min -= diff * 0.12;
  max += diff * 0.15;

  // Y-axis tick values
  ctx.fillStyle = "#64748b";
  ctx.font = "8px Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= 5; i++) {
    const val = min + ((max - min) / 5) * i;
    const y = height - padding.bottom - (i / 5) * plotH;
    ctx.fillText(val.toFixed(1), padding.left - 6, y);
  }

  // Y-axis title
  ctx.save();
  ctx.translate(14, padding.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText(`${yLabel} (${unit})`, 0, 0);
  ctx.restore();

  // X-axis Time Labels
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i < timeLabels.length; i++) {
    const x = padding.left + (i / (timeLabels.length - 1)) * plotW;
    ctx.fillText(timeLabels[i], x, height - padding.bottom + 6);
  }

  // Telemetry Curve & Spikes
  const count = liveMode ? Math.max(2, currentIndex) : totalPoints;

  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const x = padding.left + (i / (totalPoints - 1)) * plotW;
    const y = height - padding.bottom - ((data[i] - min) / (max - min)) * plotH;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 1.8;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Spikes and points marker
  for (let i = 0; i < count; i += 2) {
    const x = padding.left + (i / (totalPoints - 1)) * plotW;
    const y = height - padding.bottom - ((data[i] - min) / (max - min)) * plotH;

    ctx.beginPath();
    ctx.arc(x, y, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = "#b45309";
    ctx.fill();
  }

  // Current lead point
  if (count > 1) {
    const last = count - 1;
    const lx = padding.left + (last / (totalPoints - 1)) * plotW;
    const ly = height - padding.bottom - ((data[last] - min) / (max - min)) * plotH;

    ctx.beginPath();
    ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#2563eb";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawAll() {
  drawPlanGraph();
  drawTimeSeriesGraph(northCanvas, northCtx, northData, "North", "m");
  drawTimeSeriesGraph(eastCanvas, eastCtx, eastData, "East", "m");
  drawTimeSeriesGraph(heightCanvas, heightCtx, heightData, "Height", "m");
}

function animate() {
  if (liveMode) {
    currentIndex++;
    if (currentIndex >= totalPoints) {
      currentIndex = 1;
    }
    drawAll();
  }
  requestAnimationFrame(animate);
}

// Initial Kickoff
setTimeout(() => {
  resizeAll();
  animate();
}, 200);
