/* aviation page logic (extracted from inline <script>) */

  // Navigation sidebar toggle fallback if app.js doesn't provide it
  if (typeof toggleSidebar !== 'function') {
    window.toggleSidebar = function() {
      const s = document.getElementById('sidebar');
      if (s) s.classList.toggle('collapsed');
    };
  }
  if (typeof handleExit !== 'function') {
    window.handleExit = function() {
      window.location.href = '../index.html';
    };
  }

  // Profile configuration parameters
  const PROFILES = {
    EN_ROUTE: { name: 'En Route', hal: 3704, val: null },
    TERMINAL: { name: 'Terminal', hal: 1852, val: null },
    NPA:      { name: 'NPA', hal: 556, val: null },
    APV_I:    { name: 'APV-I', hal: 40.0, val: 50.0 },
    LPV_200:  { name: 'LPV-200', hal: 35.0, val: 35.0 }
  };

  let currentProfile = 'APV_I';
  let zoomLevel = 1.0;
  let isDarkMode = false;

  const timeStamps = ['10:50:45', '12:36:13', '14:21:42', '16:07:11', '17:52:40'];

  function selectProfile(key, btn) {
    currentProfile = key;
    document.querySelectorAll('.profile-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    drawAllAviationGraphs();
  }

  function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('analyzer-dark', isDarkMode);
    document.getElementById('themeToggleText').innerText = isDarkMode ? 'Light Mode' : 'Dark Mode';
    drawAllAviationGraphs();
  }

  function zoomGraphs() {
    zoomLevel = (zoomLevel === 1.0) ? 1.5 : 1.0;
    drawAllAviationGraphs();
  }

  function resetGraphs() {
    zoomLevel = 1.0;
    drawAllAviationGraphs();
  }

  function triggerBrowse() {
    document.getElementById('filePickerInput').click();
  }

  function handleFileSelected(event) {
    const file = event.target.files[0];
    if (file) {
      document.getElementById('activeLogFileName').innerText = file.name;
      runAnalysis();
    }
  }

  function runAnalysis() {
    const runBtn = document.querySelector('.btn-run');
    runBtn.innerHTML = '<span>⏳</span> Processing...';
    setTimeout(() => {
      runBtn.innerHTML = '<span>▶</span> Run Analysis';
      drawAllAviationGraphs();
    }, 450);
  }

  function getThemeColors() {
    const dark = document.body.classList.contains('analyzer-dark');
    return {
      bg: dark ? '#141720' : '#ffffff',
      grid: dark ? '#222736' : '#edf0f5',
      axis: dark ? '#374151' : '#cbd5e1',
      text: dark ? '#cbd5e1' : '#64748b',
      textBold: dark ? '#f1f5f9' : '#1f2430'
    };
  }

  function initCanvas(canvasId) {
    const cvs = document.getElementById(canvasId);
    if (!cvs) return null;
    const parent = cvs.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    
    cvs.width = rect.width * dpr;
    cvs.height = rect.height * dpr;

    const ctx = cvs.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, width: rect.width, height: rect.height };
  }

  // --- Graph 1: GNSS Fix Quality ---
  function drawFixQuality() {
    const c = initCanvas('cvsFixQuality');
    if (!c) return;
    const { ctx, width, height } = c;
    const colors = getThemeColors();

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    const padLeft = 36, padRight = 18, padTop = 18, padBottom = 26;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Y Axis: 0 to 6
    for (let q = 0; q <= 6; q++) {
      const y = padTop + plotH - (q / 6) * plotH;
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillStyle = colors.text;
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(q.toString(), padLeft - 6, y);
    }

    // X Axis Timestamps
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    timeStamps.forEach((t, i) => {
      const x = padLeft + (i / (timeStamps.length - 1)) * plotW;
      ctx.fillText(t, x, height - padBottom + 6);
    });

    // Q=4: RTK Fixed Line (Solid Purple)
    const yQ4 = padTop + plotH - (4 / 6) * plotH;
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(padLeft, yQ4);
    ctx.lineTo(width - padRight, yQ4);
    ctx.stroke();

    // Callout Label: Q=4: RTK Fixed (Centimeter level)
    const labelX = padLeft + 16;
    const labelY = yQ4 - 16;
    ctx.fillStyle = isDarkMode ? '#2e1065' : '#f3e8ff';
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, 142, 14, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#7e22ce';
    ctx.font = 'bold 8.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Q=4: RTK Fixed (Centimeter level)', labelX + 4, labelY + 7);
  }

  // --- Graph 2: Stanford Integrity Diagram ---
  function drawStanfordDiagram() {
    const c = initCanvas('cvsStanford');
    if (!c) return;
    const { ctx, width, height } = c;
    const colors = getThemeColors();

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    const padLeft = 40, padRight = 20, padTop = 16, padBottom = 30;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const maxLimit = 63;
    const prof = PROFILES[currentProfile];
    const hal = prof.hal ? Math.min(prof.hal, 60) : 40;

    const getX = (val) => padLeft + (val / maxLimit) * plotW;
    const getY = (val) => padTop + plotH - (val / maxLimit) * plotH;

    // Safe Zone (Green Triangle between HPL=HPE and HPL axis)
    ctx.fillStyle = isDarkMode ? 'rgba(16, 185, 129, 0.12)' : 'rgba(220, 252, 231, 0.7)';
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(0));
    ctx.lineTo(getX(0), getY(maxLimit));
    ctx.lineTo(getX(maxLimit), getY(maxLimit));
    ctx.closePath();
    ctx.fill();

    // Grid lines & labels (0, 13, 25, 38, 50, 63)
    const ticks = [0, 13, 25, 38, 50, 63];
    ctx.font = '8.5px sans-serif';
    ticks.forEach(t => {
      const x = getX(t);
      const y = getY(t);

      // Y Grid
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      // X Grid
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, height - padBottom);
      ctx.stroke();

      // Y Labels
      ctx.fillStyle = colors.text;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.toString(), padLeft - 5, y);

      // X Labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(t.toString(), x, height - padBottom + 4);
    });

    // Hazard Line (Diagonal HPL = HPE)
    ctx.strokeStyle = '#ef4444';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(0));
    ctx.lineTo(getX(maxLimit), getY(maxLimit));
    ctx.stroke();

    // HAL Line (Vertical and Horizontal Alert Limit dashed cyan/blue)
    ctx.strokeStyle = '#0284c7';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.3;
    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(padLeft, getY(hal));
    ctx.lineTo(width - padRight, getY(hal));
    ctx.stroke();
    // Vertical line
    ctx.beginPath();
    ctx.moveTo(getX(hal), padTop);
    ctx.lineTo(getX(hal), height - padBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Data points density cluster (Small orange/yellow block near (3, 0.2))
    ctx.fillStyle = '#f97316';
    const clusterX = getX(3.5);
    const clusterY = getY(0.2);
    ctx.fillRect(clusterX - 4, clusterY - 3, 9, 6);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(clusterX - 2, clusterY - 1, 5, 3);

    // Axis Titles
    ctx.fillStyle = colors.text;
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Horizontal Position Error (m)', padLeft + plotW / 2, height - 8);

    ctx.save();
    ctx.translate(12, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Horizontal Protection Level (m)', 0, 0);
    ctx.restore();
  }

  // --- Graph 3: Spatial Error Distribution ---
  function drawSpatialDistribution() {
    const c = initCanvas('cvsSpatial');
    if (!c) return;
    const { ctx, width, height } = c;
    const colors = getThemeColors();

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    const padLeft = 42, padRight = 20, padTop = 16, padBottom = 28;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const span = 14.35;
    const getX = (val) => padLeft + ((val + span) / (span * 2)) * plotW;
    const getY = (val) => padTop + plotH - ((val + span) / (span * 2)) * plotH;

    const yTicks = [-14.35, -7.18, 0.00, 7.18, 14.35];
    const xTicks = [-14.35, -7.18, 0.00, 7.18, 14.35];

    // Grid
    yTicks.forEach(val => {
      const y = getY(val);
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillStyle = colors.text;
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2), padLeft - 5, y);
    });

    xTicks.forEach(val => {
      const x = getX(val);
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, height - padBottom);
      ctx.stroke();

      ctx.fillStyle = colors.text;
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2), x, height - padBottom + 4);
    });

    // Zero crosshairs
    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, getY(0));
    ctx.lineTo(width - padRight, getY(0));
    ctx.moveTo(getX(0), padTop);
    ctx.lineTo(getX(0), height - padBottom);
    ctx.stroke();

    // 95% Confidence Ellipse (centered slightly offset as in picture)
    const cx = getX(0.0);
    const cy = getY(2.0);
    const rx = (5.741 / span) * (plotW / 2) * 0.95;
    const ry = (4.8 / span) * (plotH / 2) * 0.95;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    ctx.fillStyle = isDarkMode ? 'rgba(239, 68, 68, 0.12)' : 'rgba(254, 226, 226, 0.55)';
    ctx.fill();
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    // Minor reference point on left boundary
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(cx - rx * 0.92, cy - ry * 0.6, 2.5, 0, 2 * Math.PI);
    ctx.fill();

    // Axis labels
    ctx.fillStyle = colors.text;
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('East Position Error (m)', padLeft + plotW / 2, height - 7);

    ctx.save();
    ctx.translate(11, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('North Position Error (m)', 0, 0);
    ctx.restore();
  }

  // --- Graph 4: Protection Levels vs Limits ---
  function drawProtectionLevels() {
    const c = initCanvas('cvsProtLevels');
    if (!c) return;
    const { ctx, width, height } = c;
    const colors = getThemeColors();

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    const padLeft = 36, padRight = 18, padTop = 18, padBottom = 26;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const maxVal = 55;
    const yTicks = [0.0, 11, 22, 33, 44, 55];
    const getY = (val) => padTop + plotH - (val / maxVal) * plotH;

    // Grid & Y Ticks
    yTicks.forEach(val => {
      const y = getY(val);
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillStyle = colors.text;
      ctx.font = '8.5px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(val.toFixed(1), padLeft - 5, y);
    });

    // X Axis Ticks
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    timeStamps.forEach((t, i) => {
      const x = padLeft + (i / (timeStamps.length - 1)) * plotW;
      ctx.fillText(t, x, height - padBottom + 6);
    });

    // Active Profile Limits
    const prof = PROFILES[currentProfile];
    const hal = prof.hal !== null ? Math.min(prof.hal, 55) : 40.0;
    const val = prof.val !== null ? Math.min(prof.val, 55) : 50.0;

    // VAL Dashed Line (Green)
    if (prof.val !== null) {
      const yVAL = getY(val);
      ctx.strokeStyle = '#10b981';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padLeft, yVAL);
      ctx.lineTo(width - padRight, yVAL);
      ctx.stroke();

      ctx.fillStyle = '#059669';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`VAL (${val.toFixed(1)}m)`, width - padRight - 4, yVAL - 2);
    }

    // HAL Dashed Line (Blue)
    const yHAL = getY(hal);
    ctx.strokeStyle = '#3b82f6';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padLeft, yHAL);
    ctx.lineTo(width - padRight, yHAL);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#2563eb';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`HAL (${hal.toFixed(1)}m)`, width - padRight - 4, yHAL - 2);

    // HPL (0.143m) & VPL (0.229m) flat near zero
    const yHPL = getY(0.143);
    const yVPL = getY(0.229);

    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(padLeft, yVPL);
    ctx.lineTo(width - padRight, yVPL);
    ctx.stroke();

    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(padLeft, yHPL);
    ctx.lineTo(width - padRight, yHPL);
    ctx.stroke();
  }

  // --- Graph 5: Availability Timeline ---
  function drawAvailabilityTimeline() {
    const c = initCanvas('cvsAvailability');
    if (!c) return;
    const { ctx, width, height } = c;
    const colors = getThemeColors();

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    const padLeft = 20, padRight = 18, padTop = 26, padBottom = 26;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Solid Green Availability Area (100% full coverage)
    ctx.fillStyle = '#237839';
    ctx.fillRect(padLeft, padTop, plotW, plotH);

    // X Axis Ticks
    ctx.fillStyle = colors.text;
    ctx.font = '8.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    timeStamps.forEach((t, i) => {
      const x = padLeft + (i / (timeStamps.length - 1)) * plotW;
      ctx.fillText(t, x, height - padBottom + 6);
    });
  }

  // --- Graph 6: Continuity Timeline ---
  function drawContinuityTimeline() {
    const c = initCanvas('cvsContinuity');
    if (!c) return;
    const { ctx, width, height } = c;
    const colors = getThemeColors();

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    const padLeft = 48, padRight = 18, padTop = 24, padBottom = 26;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Y Axis labels
    const yContinuous = padTop + plotH * 0.15;
    const yInterrupted = padTop + plotH * 0.85;

    ctx.fillStyle = colors.text;
    ctx.font = '8.5px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#16a34a';
    ctx.fillText('Continuous', padLeft - 6, yContinuous);

    ctx.fillStyle = '#dc2626';
    ctx.fillText('Interrupted', padLeft - 6, yInterrupted);

    // Grid baseline
    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, height - padBottom);
    ctx.lineTo(width - padRight, height - padBottom);
    ctx.stroke();

    // Continuous Line (Burgundy / Red line at top for the whole duration)
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(padLeft, yContinuous);
    ctx.lineTo(width - padRight, yContinuous);
    ctx.stroke();

    // X Axis Ticks
    ctx.fillStyle = colors.text;
    ctx.font = '8.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    timeStamps.forEach((t, i) => {
      const x = padLeft + (i / (timeStamps.length - 1)) * plotW;
      ctx.fillText(t, x, height - padBottom + 6);
    });
  }

  function drawAllAviationGraphs() {
    drawFixQuality();
    drawStanfordDiagram();
    drawSpatialDistribution();
    drawProtectionLevels();
    drawAvailabilityTimeline();
    drawContinuityTimeline();
  }

  window.addEventListener('load', drawAllAviationGraphs);
  window.addEventListener('resize', drawAllAviationGraphs);
