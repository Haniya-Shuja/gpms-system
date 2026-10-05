/* signal-tracking page logic (extracted from inline <script>) */

const trackingData = {

    cnr: {
        name: "Carrier/Noise Ratio",
        value: "42.6",
        unit: "dB-Hz"
    },

    pseudo: {
        name: "Pseudo Range",
        value: "24,581.42",
        unit: "m"
    },

    carrier: {
        name: "Carrier Phase",
        value: "128,542.73",
        unit: "cycles"
    },

    doppler: {
        name: "Doppler",
        value: "-1,245.37",
        unit: "Hz"
    },

    lock: {
        name: "Lock Time",
        value: "184.6",
        unit: "s"
    }

};



/* =========================================================
   CHANGE SELECTED PARAMETER
   ========================================================= */

function changeTrackingParameter(parameter) {

    const data =
        trackingData[parameter];

    if (!data) {
        return;
    }


    document.getElementById(
        "parameterName"
    ).textContent = data.name;


    document.getElementById(
        "parameterValue"
    ).textContent = data.value;


    document.getElementById(
        "parameterUnit"
    ).textContent = data.unit;


    /* NEW: redraw the graph for the chosen parameter */
    sgSetParameter(parameter);

}

/* ---------------------------------------------------------
   PARAMETER SETTINGS (axis range, labels)
   --------------------------------------------------------- */

const SG_PARAMS = {

    cnr: {
        title: "Carrier/Noise Ratio",
        yLabel: "Noise Ratio (dB-Hz)",
        min: 0, max: 60, step: 10,
        lo: 38, hi: 51
    },

    pseudo: {
        title: "Pseudorange Graph",
        yLabel: "Pseudorange (Million m)",
        min: 0, max: 30, step: 5,
        lo: 19, hi: 26
    },

    carrier: {
        title: "Carrier Phase Graph",
        yLabel: "Carrier Phase (Thousand cycles)",
        min: 0, max: 150, step: 25,
        lo: 100, hi: 135
    },

    doppler: {
        title: "Doppler Graph",
        yLabel: "Doppler (kHz)",
        min: -4, max: 4, step: 1,
        lo: -3.5, hi: 3.5
    },

    lock: {
        title: "Lock Time Graph",
        yLabel: "Lock Time (s)",
        min: 0, max: 300, step: 50,
        lo: 120, hi: 260
    }

};


/* ---------------------------------------------------------
   CONSTELLATIONS: PRNs and signal series.
   A series with  empty: true  shows in the legend only
   (no data tracked), exactly like the reference screens.
   --------------------------------------------------------- */

const SG_CONSTELLATIONS = {

    "GPS": {
        prns: [2, 5, 12, 13, 15, 18, 20, 21, 25, 26, 29],
        series: [
            { name: "L1 C/A",         color: "#f28c00" },
            { name: "L2 P codeless",  color: "#0b6b1d" },
            { name: "L5 Q",           color: "#7b1fa2", empty: true },
            { name: "L2 P",           color: "#2ecc71", empty: true },
            { name: "L2 C",           color: "#1d4ed8", empty: true }
        ]
    },

    "GLONASS": {
        prns: [2, 3, 4, 15, 16, 17, 18, 24],
        series: [
            { name: "L1 C/A", color: "#f28c00" },
            { name: "L2 P",   color: "#0b6b1d" },
            { name: "L2 C/A", color: "#7b1fa2", empty: true }
        ]
    },

    "BeiDou": {
        prns: [2, 3, 5, 6, 8, 13],
        series: [
            { name: "B1 with D1 data", color: "#f28c00" },
            { name: "B2 with D1 data", color: "#0b6b1d" },
            { name: "B1 with D2 data", color: "#7b1fa2" },
            { name: "B2 with D2 data", color: "#2ecc71" }
        ]
    },

    "SBAS": {
        prns: [],
        series: [
            { name: "L1 C/A", color: "#f28c00", empty: true },
            { name: "L5",     color: "#0b6b1d", empty: true }
        ]
    },

    "Galileo": {
        prns: [],
        series: [
            { name: "E1",   color: "#f28c00", empty: true },
            { name: "E5a",  color: "#0b6b1d", empty: true },
            { name: "E5b",  color: "#7b1fa2", empty: true },
            { name: "E6",   color: "#2ecc71", empty: true }
        ]
    },

    "QZSS": {
        prns: [],
        series: [
            { name: "L1 C/A", color: "#f28c00", empty: true },
            { name: "L2C",    color: "#0b6b1d", empty: true },
            { name: "L5",     color: "#7b1fa2", empty: true }
        ]
    }

};


/* ---------------------------------------------------------
   SAMPLE DATA
   Replace this function with your live receiver data.
   It must return a number for the given parameter,
   constellation, PRN index and series index.
   --------------------------------------------------------- */

function sgSeeded(n) {
    const x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
}

function sgHash(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
        h += text.charCodeAt(i) * (i + 1);
    }
    return h;
}

function sgGetValue(param, constName, prnIndex, seriesIndex) {

    const p = SG_PARAMS[param];

    const seed =
        sgHash(constName) * 31 +
        sgHash(param) * 17 +
        prnIndex * 7 + 1;

    let v = p.lo + (p.hi - p.lo) * sgSeeded(seed);

    /* second, third... signals sit a little lower / smaller */
    if (seriesIndex > 0) {
        v = v * (0.8 + 0.12 * sgSeeded(seed + seriesIndex * 13));
    }

    return Math.round(v * 100) / 100;
}


/* ---------------------------------------------------------
   STATE
   --------------------------------------------------------- */

let sgParam = "cnr";
let sgConst = "GPS";

const SG_LOW_CNR = 36; /* bars below this are drawn red */


/* ---------------------------------------------------------
   TABS
   --------------------------------------------------------- */

function sgBuildTabs() {

    const box = document.getElementById("sgTabs");
    box.innerHTML = "";

    Object.keys(SG_CONSTELLATIONS).forEach(function (name) {

        const btn = document.createElement("button");

        btn.type = "button";
        btn.className = "sg-tab" + (name === sgConst ? " active" : "");
        btn.textContent = name;
        btn.setAttribute("role", "tab");
        btn.setAttribute("aria-selected", name === sgConst);

        btn.addEventListener("click", function () {
            sgConst = name;
            sgBuildTabs();
            sgRender();
        });

        box.appendChild(btn);

    });

}


/* ---------------------------------------------------------
   DRAW CHART
   --------------------------------------------------------- */

function sgRender() {

    const p = SG_PARAMS[sgParam];
    const c = SG_CONSTELLATIONS[sgConst];

    const W = 900, H = 380;
    const ml = 66, mr = 20, mt = 16, mb = 44;
    const pw = W - ml - mr;
    const ph = H - mt - mb;

    const yPos = function (v) {
        return mt + (p.max - v) / (p.max - p.min) * ph;
    };

    const baseY = yPos(Math.max(p.min, 0));

    let svg =
        '<svg viewBox="0 0 ' + W + ' ' + H + '" ' +
        'xmlns="http://www.w3.org/2000/svg" role="img" ' +
        'aria-label="' + sgConst + ' ' + p.title + '">';

    svg += '<rect width="' + W + '" height="' + H + '" fill="#ffffff"/>';

    /* horizontal grid + y labels */
    for (let v = p.min; v <= p.max + 0.0001; v += p.step) {

        const y = yPos(v);

        svg += '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + y +
               '" y2="' + y + '" stroke="' + (v === 0 ? '#6b7280' : '#e5e7eb') +
               '" stroke-width="' + (v === 0 ? 1.4 : 1) + '"/>';

        svg += '<text x="' + (ml - 8) + '" y="' + (y + 4) +
               '" text-anchor="end" font-size="12" fill="#374151">' + v + '</text>';
    }

    /* axes */
    svg += '<line x1="' + ml + '" x2="' + ml + '" y1="' + mt +
           '" y2="' + (mt + ph) + '" stroke="#9ca3af"/>';

    /* y axis title */
    svg += '<text transform="translate(16,' + (mt + ph / 2) +
           ') rotate(-90)" text-anchor="middle" font-size="13" ' +
           'font-weight="600" fill="#111827">' + p.yLabel + '</text>';

    /* x axis title */
    svg += '<text x="' + (ml + pw / 2) + '" y="' + (H - 6) +
           '" text-anchor="middle" font-size="13" font-weight="600" ' +
           'fill="#111827">PRN</text>';


    const n = c.prns.length;
    let trackedCount = 0;

    if (n === 0) {

        svg += '<text x="' + (ml + pw / 2) + '" y="' + (mt + ph / 2) +
               '" text-anchor="middle" font-size="15" fill="#6b7280">' +
               'No ' + sgConst + ' satellites tracked</text>';

    } else {

        const active = [];

        c.series.forEach(function (s, i) {
            if (!s.empty) { active.push(i); }
        });

        const groupW = pw / n;
        const barW = Math.min(16, groupW * 0.75 / active.length);
        const groupBars = barW * active.length;

        c.prns.forEach(function (prn, pi) {

            const gx = ml + groupW * pi + (groupW - groupBars) / 2;

            active.forEach(function (si, k) {

                const v = sgGetValue(sgParam, sgConst, pi, si);
                const s = c.series[si];

                let color = s.color;

                if (sgParam === "cnr" && v < SG_LOW_CNR) {
                    color = "#e11d1d";
                }

                const y = yPos(v);
                const top = Math.min(y, baseY);
                const h = Math.max(Math.abs(baseY - y), 1);

                svg += '<rect x="' + (gx + k * barW) + '" y="' + top +
                       '" width="' + (barW - 1) + '" height="' + h +
                       '" fill="' + color + '">' +
                       '<title>PRN ' + prn + ' · ' + s.name + ': ' + v +
                       '</title></rect>';

            });

            svg += '<text x="' + (ml + groupW * pi + groupW / 2) +
                   '" y="' + (mt + ph + 18) +
                   '" text-anchor="middle" font-size="12" fill="#374151">' +
                   prn + '</text>';

        });

        trackedCount = n;
    }

    svg += '</svg>';

    document.getElementById("sgChart").innerHTML = svg;


    /* legend */
    const legend = document.getElementById("sgLegend");
    legend.innerHTML = "";

    c.series.forEach(function (s) {

        const item = document.createElement("span");
        item.className = "sg-legend-item";

        item.innerHTML =
            '<span class="sg-legend-swatch" style="background:' +
            s.color + '"></span>' + s.name;

        legend.appendChild(item);

    });


    /* titles */
    document.getElementById("sgChartTitle").textContent =
        sgConst + " – " + p.title;

    document.getElementById("sgSummary").textContent =
        trackedCount + " satellite" + (trackedCount === 1 ? "" : "s") +
        " tracked";
}


/* ---------------------------------------------------------
   CALLED WHEN A RADIO BUTTON IS CLICKED
   --------------------------------------------------------- */

function sgSetParameter(parameter) {

    if (!SG_PARAMS[parameter]) {
        return;
    }

    sgParam = parameter;

    document.getElementById("sgHeading").textContent =
        trackingData[parameter].name + " Graph";

    sgRender();
}


/* ---------------------------------------------------------
   INITIAL DRAW
   --------------------------------------------------------- */

sgBuildTabs();
sgRender();
