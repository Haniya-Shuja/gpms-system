/* integrity page logic (extracted from inline <script>) */

  function renderDopplerChart(canvasId, options) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Dark grid background
    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(0, 0, width, height);

    const padLeft = 38;
    const padRight = 14;
    const padTop = 22;
    const padBottom = 26;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Sub-title
    ctx.fillStyle = '#9e9ea4';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(options.title || 'Doppler Graph', width / 2, 14);

    // Y Axis limits (-4 to 4 kHz)
    const yMin = -4;
    const yMax = 4;
    const yRange = yMax - yMin;
    const getY = (val) => padTop + plotH - ((val - yMin) / yRange) * plotH;

    // Alternating horizontal bands
    for (let y = -4; y < 4; y++) {
      if (Math.abs(y) % 2 === 1) {
        ctx.fillStyle = '#25252c';
        const topY = getY(y + 1);
        const botY = getY(y);
        ctx.fillRect(padLeft, topY, plotW, botY - topY);
      }
    }

    // Grid lines & Y Ticks
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let y = -4; y <= 4; y++) {
      const py = getY(y);
      ctx.strokeStyle = '#32323b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, py);
      ctx.lineTo(width - padRight, py);
      ctx.stroke();

      ctx.fillStyle = '#8e8e94';
      ctx.fillText(y.toString(), padLeft - 6, py);
    }

    // Zero-line highlight
    const zeroY = getY(0);
    ctx.strokeStyle = '#555562';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padLeft, zeroY);
    ctx.lineTo(width - padRight, zeroY);
    ctx.stroke();

    // Y Axis label
    ctx.save();
    ctx.translate(11, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#9a9aa2';
    ctx.fillText(options.yLabel || 'Dopp-KHz', 0, 0);
    ctx.restore();

    // PRN points on X axis
    const categories = options.categories || [];
    const n = categories.length;
    if (n === 0) return;

    const colW = plotW / n;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    categories.forEach((cat, i) => {
      const cx = padLeft + i * colW + colW / 2;

      // PRN label
      ctx.fillStyle = '#a0a0a8';
      ctx.font = '10px sans-serif';
      ctx.fillText(cat.prn, cx, height - padBottom + 6);

      // Bars
      const bW = Math.min(6, colW * 0.24);
      if (cat.v1 !== undefined && cat.v1 !== null) {
        const barH = (cat.v1 / yRange) * plotH;
        ctx.fillStyle = '#e07b10'; // Orange
        ctx.fillRect(cx - bW - 1, zeroY - (cat.v1 >= 0 ? barH : 0), bW, Math.abs(barH));
      }
      if (cat.v2 !== undefined && cat.v2 !== null) {
        const barH = (cat.v2 / yRange) * plotH;
        ctx.fillStyle = '#289c19'; // Green
        ctx.fillRect(cx + 1, zeroY - (cat.v2 >= 0 ? barH : 0), bW, Math.abs(barH));
      }
    });

    // X Axis Label
    ctx.fillStyle = '#9a9aa2';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRN', padLeft + plotW / 2, height - 10);
  }

  function drawAllCharts() {
    // 1. APV Chart (Matching graph 1)
    renderDopplerChart('apvCanvas', {
      title: 'Doppler Graph',
      categories: [
        { prn: '2',  v1: -1.6, v2: -1.8 },
        { prn: '5',  v1: -3.0, v2: -2.8 },
        { prn: '12', v1: -3.4, v2: -3.1 },
        { prn: '13', v1: 1.5,  v2: 1.5 },
        { prn: '15', v1: 2.5,  v2: 2.5 },
        { prn: '18', v1: 2.7,  v2: 2.8 },
        { prn: '20', v1: 0.0,  v2: 0.0 },
        { prn: '21', v1: 1.1,  v2: 1.0 },
        { prn: '25', v1: -2.0, v2: -1.8 },
        { prn: '26', v1: 2.6,  v2: 2.6 },
        { prn: '29', v1: 1.5,  v2: 1.5 }
      ]
    });

    // 2. Availability Chart (Matching graph 2)
    renderDopplerChart('availCanvas', {
      title: 'Doppler Graph',
      categories: [
        { prn: '2',  v1: -2.1, v2: -1.9 },
        { prn: '3',  v1: 2.1,  v2: 0.0 },
        { prn: '4',  v1: 3.9,  v2: 3.6 },
        { prn: '15', v1: -3.2, v2: -2.8 },
        { prn: '16', v1: -1.3, v2: -1.0 },
        { prn: '17', v1: 0.3,  v2: 0.3 },
        { prn: '18', v1: 2.1,  v2: 1.6 },
        { prn: '24', v1: -1.7, v2: 0.0 }
      ]
    });

    // 3. BeiDou Chart (Matching graph 3)
    renderDopplerChart('beidouCanvas', {
      title: 'Doppler Graph',
      categories: [
        { prn: '2',  v1: 0.0,  v2: 0.0 },
        { prn: '3',  v1: 0.0,  v2: 0.0 },
        { prn: '5',  v1: 0.0,  v2: 0.0 },
        { prn: '6',  v1: 0.1,  v2: 0.1 },
        { prn: '8',  v1: 0.2,  v2: 0.2 },
        { prn: '13', v1: 0.3,  v2: 0.3 }
      ]
    });

    // 4. Galileo Chart (Empty/Waiting state as in picture)
    renderDopplerChart('galileoCanvas', {
      title: 'Carrier/Noise Ratio',
      yLabel: 'Noise-Ratio-dB-Hz',
      categories: [{ prn: '', v1: null }]
    });

    // 5. QZSS Chart (Empty/Waiting state as in picture)
    renderDopplerChart('qzssCanvas', {
      title: 'Carrier/Noise Ratio',
      yLabel: 'Noise-Ratio-dB-Hz',
      categories: [{ prn: '', v1: null }]
    });

    // 6. SBAS Chart (Empty/Waiting state as in picture)
    renderDopplerChart('sbasCanvas', {
      title: 'Carrier/Noise Ratio',
      yLabel: 'Noise-Ratio-dB-Hz',
      categories: [{ prn: '', v1: null }]
    });
  }

  window.addEventListener('load', drawAllCharts);
  window.addEventListener('resize', drawAllCharts);
