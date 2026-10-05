/* sky-view page logic (extracted from inline <script>) */

    /* =========================================================
       CONSTELLATION COLORS
    ========================================================= */

    const COLORS = {

      GPS: "#f97316",

      GLONASS: "#16a34a",

      Galileo: "#06b6d4",

      BeiDou: "#9333ea",

      NavIC: "#2563eb",

      QZSS: "#e11d48",

      SBAS: "#ca8a04"

    };


    /* =========================================================
       STORAGE KEY
    ========================================================= */

    const SKY_VIEW_STORAGE_KEY =
      "gnssPlaybackSkyViewData";


    /* =========================================================
       CONSTELLATION NAME
    ========================================================= */

    function constellationFromHeader(header) {

      const id = header.slice(1, 3);

      return {

        GP: "GPS",

        BD: "BeiDou",

        GB: "BeiDou",

        GL: "GLONASS",

        GA: "Galileo",

        GI: "NavIC",

        GQ: "QZSS",

        QZ: "QZSS",

        SB: "SBAS"

      }[id] || id;

    }


    /* =========================================================
       POLAR POSITION
    ========================================================= */

    function polarPosition(azimuth, elevation) {

      const cx = 300;

      const cy = 300;

      const outer = 250;

      const radius =
        outer * (90 - elevation) / 90;

      const rad =
        azimuth * Math.PI / 180;

      return {

        x:
          cx +
          radius *
          Math.sin(rad),

        y:
          cy -
          radius *
          Math.cos(rad)

      };

    }


    /* =========================================================
       SVG ELEMENT
    ========================================================= */

    function svgEl(name, attrs = {}) {

      const el =
        document.createElementNS(
          "http://www.w3.org/2000/svg",
          name
        );

      Object.entries(attrs).forEach(
        ([key, value]) => {

          el.setAttribute(
            key,
            value
          );

        }
      );

      return el;

    }


    /* =========================================================
       DRAW POLAR GRID
    ========================================================= */

    function drawSkyPlot(satellites) {

      const svg =
        document.getElementById(
          "skyPlot"
        );

      svg.innerHTML = "";


      /* =====================================================
         RADIAL LINES
      ====================================================== */

      for (
        let degree = 0;
        degree < 360;
        degree += 30
      ) {

        const point =
          polarPosition(
            degree,
            0
          );

        svg.appendChild(

          svgEl(
            "line",
            {

              x1: 300,

              y1: 300,

              x2: point.x,

              y2: point.y,

              class: "radial-line"

            }
          )

        );

      }


      /* =====================================================
         ELEVATION CIRCLES
      ====================================================== */

      [
        0,
        15,
        30,
        45,
        60,
        75,
        90

      ].forEach(
        (elevation, index) => {

          const radius =
            250 *
            (90 - elevation) /
            90;

          if (radius > 0) {

            svg.appendChild(

              svgEl(
                "circle",
                {

                  cx: 300,

                  cy: 300,

                  r: radius,

                  class:
                    index % 2 === 0
                      ? "grid-circle"
                      : "grid-subcircle"

                }
              )

            );

          }

        }
      );


      /* =====================================================
         CENTER
      ====================================================== */

      svg.appendChild(

        svgEl(
          "circle",
          {

            cx: 300,

            cy: 300,

            r: 3,

            fill: "#64748b"

          }
        )

      );


      /* =====================================================
         AZIMUTH NUMBERS
      ====================================================== */

      const azimuthLabels = [

        [0, 300, 32],

        [30, 430, 66],

        [60, 525, 164],

        [90, 568, 300],

        [120, 525, 436],

        [150, 430, 534],

        [180, 300, 568],

        [210, 170, 534],

        [240, 75, 436],

        [270, 32, 300],

        [300, 75, 164],

        [330, 170, 66]

      ];


      azimuthLabels.forEach(
        ([degree, x, y]) => {

          const text =
            svgEl(
              "text",
              {

                x,

                y,

                class: "azimuth-text"

              }
            );

          text.textContent =
            degree + "°";

          svg.appendChild(text);

        }
      );


      /* =====================================================
         DIRECTIONS
      ====================================================== */

      const directions = [

        ["N", 300, 18],

        ["E", 582, 300],

        ["S", 300, 582],

        ["W", 18, 300]

      ];


      directions.forEach(
        ([direction, x, y]) => {

          const text =
            svgEl(
              "text",
              {

                x,

                y,

                class: "direction-label"

              }
            );

          text.textContent =
            direction;

          svg.appendChild(text);

        }
      );


      /* =====================================================
         ELEVATION LABELS
      ====================================================== */

      [
        15,
        30,
        45,
        60,
        75

      ].forEach(
        elevation => {

          const radius =
            250 *
            (90 - elevation) /
            90;

          const text =
            svgEl(
              "text",
              {

                x: 306,

                y:
                  300 -
                  radius,

                class: "elevation-text"

              }
            );

          text.textContent =
            elevation + "°";

          svg.appendChild(text);

        }
      );


      /* =====================================================
         EMPTY STATE
      ====================================================== */

      if (!satellites.length) {

        const text =
          svgEl(
            "text",
            {

              x: 300,

              y: 300,

              class: "empty-message"

            }
          );

        text.textContent =
          "No Playback GSV data available";

        svg.appendChild(text);

        return;

      }


      /* =====================================================
         SATELLITES
      ====================================================== */

      satellites.forEach(
        satellite => {

          const point =
            polarPosition(
              satellite.azimuth,
              satellite.elevation
            );


          const group =
            svgEl(
              "g",
              {

                class: "satellite"

              }
            );


          const radius =
            satellite.snr != null

              ? Math.max(
                  7,
                  Math.min(
                    13,
                    6 +
                    satellite.snr /
                    12
                  )
                )

              : 8;


          const circle =
            svgEl(
              "circle",
              {

                cx: point.x,

                cy: point.y,

                r: radius,

                fill:
                  COLORS[
                    satellite.constellation
                  ] ||
                  "#64748b"

              }
            );


          const title =
            svgEl("title");


          title.textContent =

            `${satellite.constellation} ` +

            `PRN ${satellite.prn} | ` +

            `Azimuth ${satellite.azimuth}° | ` +

            `Elevation ${satellite.elevation}° | ` +

            `SNR ${satellite.snr ?? "N/A"} dB-Hz`;


          circle.appendChild(title);


          const label =
            svgEl(
              "text",
              {

                x: point.x,

                y: point.y,

                class: "sat-label"

              }
            );


          const prefix = {

            GPS: "G",

            GLONASS: "R",

            Galileo: "E",

            BeiDou: "B",

            NavIC: "I",

            QZSS: "Q",

            SBAS: "S"

          }[
            satellite.constellation
          ] || "";


          label.textContent =
            prefix +
            satellite.prn;


          group.appendChild(circle);

          group.appendChild(label);

          svg.appendChild(group);

        }
      );

    }


    /* =========================================================
       UPDATE TABLE
    ========================================================= */

    function updateTable(satellites) {

      const tbody =
        document.getElementById(
          "satelliteTable"
        );

      tbody.innerHTML = "";


      if (!satellites.length) {

        tbody.innerHTML =

          "<tr>" +

          "<td colspan='5'>" +

          "No valid GSV satellite records found." +

          "</td>" +

          "</tr>";

        return;

      }


      satellites

        .slice()

        .sort(
          (a, b) =>
            (b.snr ?? -1) -
            (a.snr ?? -1)
        )

        .forEach(
          satellite => {

            const row =
              document.createElement("tr");


            row.innerHTML = `

              <td>
                <span class="constellation-chip">
                  ${satellite.constellation}
                </span>
              </td>

              <td>
                ${satellite.prn}
              </td>

              <td>
                ${satellite.elevation}°
              </td>

              <td>
                ${String(
                  satellite.azimuth
                ).padStart(3, "0")}°
              </td>

              <td>
                ${
                  satellite.snr ?? "—"
                }
                ${
                  satellite.snr != null
                    ? " dB-Hz"
                    : ""
                }
              </td>

            `;


            tbody.appendChild(row);

          }
        );

    }


    /* =========================================================
       UPDATE STATISTICS
    ========================================================= */

    function updateStats(satellites) {

      const gps =
        satellites.filter(
          satellite =>
            satellite.constellation ===
            "GPS"
        ).length;


      const snrs =
        satellites

          .filter(
            satellite =>
              Number.isFinite(
                satellite.snr
              )
          )

          .map(
            satellite =>
              satellite.snr
          );


      const average =
        snrs.length

          ? snrs.reduce(
              (sum, value) =>
                sum + value,
              0
            ) / snrs.length

          : null;


      document.getElementById(
        "totalSat"
      ).textContent =
        satellites.length;


      document.getElementById(
        "gpsCount"
      ).textContent =
        gps;


      document.getElementById(
        "multiCount"
      ).textContent =
        satellites.length -
        gps;


      document.getElementById(
        "avgSnr"
      ).textContent =

        average == null

          ? "—"

          : average.toFixed(1) +
            " dB";

    }


    /* =========================================================
       SHOW PLAYBACK DATA
    ========================================================= */

    function showSkyViewData(data) {

      if (!data) {

        drawSkyPlot([]);

        updateTable([]);

        updateStats([]);


        document.getElementById(
          "fileName"
        ).textContent =
          "No GSV file selected";


        document.getElementById(
          "connectionStatus"
        ).textContent =
          "Waiting for Playback";


        document.getElementById(
          "statusBox"
        ).textContent =
          "Select a GSV file from Playback Configuration to display the satellite sky view.";

        return;

      }


      const satellites =
        Array.isArray(
          data.satellites
        )

          ? data.satellites

          : [];


      document.getElementById(
        "fileName"
      ).textContent =
        data.fileName ||
        "Playback GSV file";


      document.getElementById(
        "connectionStatus"
      ).textContent =
        "Playback Data Loaded";


      document.getElementById(
        "statusBox"
      ).textContent =

        `${satellites.length} satellites loaded from Playback Configuration.`;


      drawSkyPlot(satellites);

      updateTable(satellites);

      updateStats(satellites);

    }


    /* =========================================================
       LOAD PLAYBACK DATA
    ========================================================= */

    function loadPlaybackData() {

      try {

        const stored =
          localStorage.getItem(
            SKY_VIEW_STORAGE_KEY
          );


        if (!stored) {

          showSkyViewData(null);

          return;

        }


        const data =
          JSON.parse(stored);


        showSkyViewData(data);


      } catch (error) {

        console.error(
          "Unable to load Playback GSV data:",
          error
        );

        showSkyViewData(null);

      }

    }


    /* =========================================================
       STORAGE EVENT
    ========================================================= */

    window.addEventListener(
      "storage",
      event => {

        if (
          event.key ===
          SKY_VIEW_STORAGE_KEY
        ) {

          loadPlaybackData();

        }

      }
    );


    /* =========================================================
       BROADCAST CHANNEL
    ========================================================= */

    let skyViewChannel = null;


    if ("BroadcastChannel" in window) {

      skyViewChannel =
        new BroadcastChannel(
          "gnss-playback-channel"
        );


      skyViewChannel.onmessage =
        event => {

          if (
            event.data &&
            event.data.type ===
            "GSV_UPDATED"
          ) {

            loadPlaybackData();

          }

        };

    }


    /* =========================================================
       INITIAL LOAD
    ========================================================= */

    document.addEventListener(
      "DOMContentLoaded",
      () => {

        loadPlaybackData();

      }
    );

  
