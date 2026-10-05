/* dop page logic (extracted from inline <script>) */

/* =========================================================
   DOP VS UTC TIME - CANVAS LINE GRAPH (LIGHT THEME)
   ========================================================= */
(function () {
  const canvas = document.getElementById("dopLineChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  const data = {
    labels: ["01:00", "01:10", "01:20", "01:30", "01:40", "01:50", "02:00"],
    gdop: [1.70, 1.62, 1.58, 1.74, 1.66, 1.72, 1.70],
    pdop: [1.46, 1.39, 1.42, 1.51, 1.45, 1.48, 1.46],
    hdop: [0.82, 0.78, 0.84, 0.88, 0.81, 0.85, 0.82],
    vdop: [1.21, 1.16, 1.25, 1.29, 1.20, 1.24, 1.21],
    tdop: [0.91, 0.86, 0.94, 0.97, 0.89, 0.93, 0.91]
  };

  const series = [
    { name: "GDOP", values: data.gdop, color: "#0284c7" },
    { name: "PDOP", values: data.pdop, color: "#ea580c" },
    { name: "HDOP", values: data.hdop, color: "#2563eb" },
    { name: "VDOP", values: data.vdop, color: "#d97706" },
    { name: "TDOP", values: data.tdop, color: "#16a34a" }
  ];

  function drawChart() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const left = width < 400 ? 32 : 40;
    const right = width < 400 ? 10 : 16;
    const top = 22;
    const bottom = width < 400 ? 32 : 38;

    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const maxValue = 2.0;

    // White Canvas Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Horizontal Grid Lines
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.font = width < 400 ? "7px Arial" : "8.5px Arial";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= 10; i++) {
      const value = i * 0.2;
      const y = top + chartHeight - (value / maxValue) * chartHeight;

      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(width - right, y);
      ctx.stroke();

      ctx.fillText(value.toFixed(1), left - 6, y);
    }

    // Vertical Grid Lines
    ctx.strokeStyle = "#f1f5f9";
    data.labels.forEach((label, index) => {
      const x = left + (index / (data.labels.length - 1)) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + chartHeight);
      ctx.stroke();
    });

    // X-Axis Labels
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = width < 400 ? "6.5px Arial" : "8px Arial";

    data.labels.forEach((label, index) => {
      const x = left + (index / (data.labels.length - 1)) * chartWidth;
      ctx.fillText(label, x, top + chartHeight + 7);
    });

    // Draw Line Series & Data Points
    series.forEach((item) => {
      ctx.beginPath();
      item.values.forEach((value, index) => {
        const x = left + (index / (item.values.length - 1)) * chartWidth;
        const y = top + chartHeight - (value / maxValue) * chartHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.strokeStyle = item.color;
      ctx.lineWidth = width < 400 ? 1.5 : 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      // Markers
      item.values.forEach((value, index) => {
        const x = left + (index / (item.values.length - 1)) * chartWidth;
        const y = top + chartHeight - (value / maxValue) * chartHeight;

        ctx.beginPath();
        ctx.arc(x, y, width < 400 ? 2 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = item.color;
        ctx.fill();
      });
    });

    // Axis Title
    ctx.fillStyle = "#475569";
    ctx.font = width < 400 ? "7px Arial" : "8px Arial";
    ctx.textAlign = "center";
    ctx.fillText("UTC Time", left + chartWidth / 2, height - 7);
  }

  drawChart();
  window.addEventListener("resize", drawChart);
})();
