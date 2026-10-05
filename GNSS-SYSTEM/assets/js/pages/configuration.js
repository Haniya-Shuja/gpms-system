/* configuration page logic (extracted from inline <script>) */

    /* =========================================================
       SOURCE SETTINGS
    ========================================================= */

    function showSettings(type) {

        const panels = [
            "serialSettings",
            "playbackSettings",
            "networkSettings"
        ];

        const options = [
            "serialOption",
            "playbackOption",
            "networkOption"
        ];


        panels.forEach(function(id) {

            document
                .getElementById(id)
                .classList.remove("active");

        });


        options.forEach(function(id) {

            document
                .getElementById(id)
                .classList.remove("selected");

        });


        document
            .getElementById(type + "Settings")
            .classList.add("active");


        document
            .getElementById(type + "Option")
            .classList.add("selected");


        setTimeout(function() {

            document
                .getElementById(type + "Settings")
                .scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

        }, 100);

    }


    /* =========================================================
       CLOSE SETTINGS
    ========================================================= */

    function closeSettings() {

        const panels = [
            "serialSettings",
            "playbackSettings",
            "networkSettings"
        ];

        const options = [
            "serialOption",
            "playbackOption",
            "networkOption"
        ];


        panels.forEach(function(id) {

            document
                .getElementById(id)
                .classList.remove("active");

        });


        options.forEach(function(id) {

            document
                .getElementById(id)
                .classList.remove("selected");

        });

    }


    /* =========================================================
       SERIAL / NETWORK
    ========================================================= */

    function startConfiguration(type) {

        if (type === "Network") {

            const host =
                document.getElementById("networkHost").value;

            const port =
                document.getElementById("networkPort").value;


            if (!host || !port) {

                window.RxLogger && RxLogger.error("Network configuration rejected: host / port missing");

                alert(
                    "Please enter Host / IP Address and Port."
                );

                return;

            }

            window.RxLogger && RxLogger.info("Network configuration saved: " + host + ":" + port);

            alert(
                "Network configuration saved."
            );

            return;
        }


        if (type === "Serial") {

            window.RxLogger && RxLogger.info("Serial configuration started");

            alert(
                "Serial configuration started."
            );

        }

    }


    // playback


    /* =========================================================
   PLAYBACK
========================================================= */

let currentMode = "single";
let chosenFolder = "Documents";


/* =========================================================
   PLAYBACK MODE SWITCH
========================================================= */

function handleModeSwitch(mode) {

    currentMode = mode;

    const input =
        document.getElementById("file-path-input");

    if (!input) return;


    if (mode === "multiple") {

        openFolderDialog();

    } else {

        input.value = "";

    }

}


/* =========================================================
   BROWSE BUTTON
========================================================= */

function triggerBrowse() {

    if (currentMode === "multiple") {

        /*
         * Multiple mode:
         * Open the custom folder/file selection dialog
         */

        openFolderDialog();

    } else {

        /*
         * Single mode:
         * Open browser file picker
         */

        const picker =
            document.getElementById(
                "single-file-picker"
            );

        if (picker) {

            picker.click();

        }

    }

}


/* =========================================================
   SINGLE GSV FILE PICKER
========================================================= */

async function handleSingleFilePick(input) {

    const file =
        input.files && input.files[0];

    if (!file) {
        return;
    }


    /* =====================================================
       SHOW SELECTED FILE NAME
    ===================================================== */

    const pathInput =
        document.getElementById(
            "file-path-input"
        );

    if (pathInput) {

        pathInput.value =
            file.name;

    }


    /* =====================================================
       READ SELECTED FILE
    ===================================================== */

    try {

        const text =
            await file.text();

        window.RxLogger && RxLogger.analyzeNMEA(text, file.name);


        /* =================================================
           PARSE GSV DATA
        ================================================= */

        const satellites =
            parsePlaybackGSV(text);


        /* =================================================
           CHECK GSV DATA
        ================================================= */

        if (!satellites.length) {

            window.RxLogger && RxLogger.error("No valid GSV satellite data found in " + file.name);

            alert(
                "No valid GSV satellite data was found in the selected file."
            );

            return;

        }


        /* =================================================
           PREPARE SKY VIEW DATA
        ================================================= */

        const skyViewData = {

            fileName:
                file.name,

            loadedAt:
                new Date().toISOString(),

            satellites:
                satellites

        };


        /* =================================================
           SAVE DATA FOR SKY VIEW
        ================================================= */

        localStorage.setItem(

            "gnssPlaybackSkyViewData",

            JSON.stringify(
                skyViewData
            )

        );


        /* =================================================
           INFORM OPEN SKY VIEW PAGE
        ================================================= */

        if (
            "BroadcastChannel"
            in window
        ) {

            const channel =
                new BroadcastChannel(
                    "gnss-playback-channel"
                );


            channel.postMessage({

                type:
                    "GSV_UPDATED",

                data:
                    skyViewData

            });


            channel.close();

        }


        /* =================================================
           CONSOLE INFORMATION
        ================================================= */

        console.log(
            "GSV successfully loaded:",
            skyViewData
        );

        console.log(
            `${satellites.length} satellites loaded from ${file.name}`
        );


    } catch (error) {

        console.error(
            "GSV file reading error:",
            error
        );


        alert(
            "Unable to read the selected GSV file."
        );

    }

}


/* =========================================================
   MULTIPLE FILE PICKER
========================================================= */

async function handleMultipleFilePick(input) {

    if (
        !input.files ||
        input.files.length === 0
    ) {

        return;

    }


    /* =====================================================
       SHOW SELECTED FILE NAMES
    ===================================================== */

    const fileNames = [];

    for (
        let i = 0;
        i < input.files.length;
        i++
    ) {

        fileNames.push(
            input.files[i].name
        );

    }


    const pathInput =
        document.getElementById(
            "file-path-input"
        );

    if (pathInput) {

        pathInput.value =
            fileNames.join(", ");

    }


    /* =====================================================
       PARSE ALL SELECTED FILES
    ===================================================== */

    let allSatellites = [];

    try {

        for (
            let i = 0;
            i < input.files.length;
            i++
        ) {

            const file =
                input.files[i];


            const text =
                await file.text();

            window.RxLogger && RxLogger.analyzeNMEA(text, file.name);


            const satellites =
                parsePlaybackGSV(text);


            allSatellites =
                allSatellites.concat(
                    satellites
                );

        }


        /* =================================================
           REMOVE DUPLICATES
        ================================================= */

        const uniqueSatellites =
            [];

        const seen =
            new Set();


        allSatellites.forEach(
            satellite => {

                const key =
                    `${satellite.constellation}-${satellite.prn}`;

                if (
                    !seen.has(key)
                ) {

                    seen.add(key);

                    uniqueSatellites.push(
                        satellite
                    );

                }

            }
        );


        /* =================================================
           CHECK DATA
        ================================================= */

        if (
            !uniqueSatellites.length
        ) {

            alert(
                "No valid GSV satellite data was found in the selected files."
            );

            return;

        }


        /* =================================================
           PREPARE SKY VIEW DATA
        ================================================= */

        const skyViewData = {

            fileName:
                fileNames.join(", "),

            loadedAt:
                new Date().toISOString(),

            satellites:
                uniqueSatellites

        };


        /* =================================================
           SAVE FOR SKY VIEW
        ================================================= */

        localStorage.setItem(

            "gnssPlaybackSkyViewData",

            JSON.stringify(
                skyViewData
            )

        );


        /* =================================================
           UPDATE SKY VIEW
        ================================================= */

        if (
            "BroadcastChannel"
            in window
        ) {

            const channel =
                new BroadcastChannel(
                    "gnss-playback-channel"
                );


            channel.postMessage({

                type:
                    "GSV_UPDATED",

                data:
                    skyViewData

            });


            channel.close();

        }


        console.log(
            "Multiple GSV files loaded:",
            skyViewData
        );


    } catch (error) {

        console.error(
            "Multiple GSV file reading error:",
            error
        );


        alert(
            "Unable to read one or more selected GSV files."
        );

    }

}


/* =========================================================
   GSV PARSER
========================================================= */

function parsePlaybackGSV(text) {

    const satellites = [];

    const seen = new Set();


    /* =====================================================
       CONSTELLATION DETECTION
    ===================================================== */

    const constellationFromHeader =
        header => {

            const id =
                header.slice(1, 3);


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

        };


    /* =====================================================
       SPLIT FILE INTO LINES
    ===================================================== */

    const lines =
        text.split(/\r?\n/);


    /* =====================================================
       PROCESS EACH LINE
    ===================================================== */

    lines.forEach(
        line => {

            line =
                line.trim();


            if (
                !line ||
                line[0] !== "$"
            ) {

                return;

            }


            /* =============================================
               REMOVE CHECKSUM
            ============================================= */

            const clean =
                line.split("*")[0];


            const fields =
                clean.split(",");


            const header =
                fields[0];


            /* =============================================
               ACCEPT GSV SENTENCES
               
               Examples:
               GPGSV
               BDGSV
               GLGSV
               GAGSV
               GIGSV
               GQGSV
               ============================================= */

            if (
                !/^[A-Z]{2}GSV$/.test(
                    header.slice(1)
                )
            ) {

                return;

            }


            const constellation =
                constellationFromHeader(
                    header
                );


            /* =============================================
               EACH SATELLITE HAS:
               
               PRN
               Elevation
               Azimuth
               SNR
               ============================================= */

            for (
                let i = 4;
                i + 3 < fields.length;
                i += 4
            ) {

                const prn =
                    Number(
                        fields[i]
                    );


                const elevation =
                    Number(
                        fields[i + 1]
                    );


                const azimuth =
                    Number(
                        fields[i + 2]
                    );


                const snr =
                    Number(
                        fields[i + 3]
                    );


                /* =========================================
                   VALIDATION
                ========================================= */

                if (
                    !Number.isFinite(prn) ||
                    !Number.isFinite(elevation) ||
                    !Number.isFinite(azimuth)
                ) {

                    continue;

                }


                /* =========================================
                   UNIQUE SATELLITE KEY
                ========================================= */

                const key =
                    `${constellation}-${prn}`;


                if (
                    seen.has(key)
                ) {

                    continue;

                }


                seen.add(key);


                /* =========================================
                   STORE SATELLITE
                ========================================= */

                satellites.push({

                    constellation:
                        constellation,

                    prn:
                        prn,

                    elevation:
                        Math.max(
                            0,
                            Math.min(
                                90,
                                elevation
                            )
                        ),

                    azimuth:
                        (
                            (
                                azimuth % 360
                            ) + 360
                        ) % 360,

                    snr:
                        Number.isFinite(snr)
                            ? snr
                            : null

                });

            }

        }
    );


    return satellites;

}


/* =========================================================
   FOLDER DIALOG
========================================================= */

function openFolderDialog() {

    const modal =
        document.getElementById(
            "folder-dialog-modal"
        );

    if (modal) {

        modal.style.display =
            "flex";

    }

}


function closeFolderDialog() {

    const modal =
        document.getElementById(
            "folder-dialog-modal"
        );

    if (modal) {

        modal.style.display =
            "none";

    }

}


/* =========================================================
   FOLDER TREE
========================================================= */

function toggleTreeNode(
    event,
    containerId
) {

    event.stopPropagation();


    const container =
        document.getElementById(
            containerId
        );


    const expander =
        event.target;


    if (!container) {

        return;

    }


    if (
        container.classList.contains(
            "expanded"
        )
    ) {

        container.classList.remove(
            "expanded"
        );

        expander.textContent =
            "▶";

    } else {

        container.classList.add(
            "expanded"
        );

        expander.textContent =
            "▼";

    }

}


/* =========================================================
   SELECT FOLDER
========================================================= */

function selectFolder(
    element,
    folderPath
) {

    document
        .querySelectorAll(
            ".tree-row"
        )
        .forEach(
            function(row) {

                row.classList.remove(
                    "selected"
                );

            }
        );


    element.classList.add(
        "selected"
    );


    chosenFolder =
        folderPath;

}


/* =========================================================
   CONFIRM FOLDER SELECTION
========================================================= */

function confirmFolderSelection() {

    const input =
        document.getElementById(
            "file-path-input"
        );


    if (input) {

        input.value =
            "C:\\" +
            chosenFolder;

    }


    closeFolderDialog();

}


/* =========================================================
   PLAYBACK STATUS
========================================================= */

function setPlaybackRunning(
    isRunning
) {

    const playLed =
        document.getElementById(
            "led-play"
        );


    const errorLed =
        document.getElementById(
            "led-error"
        );


    const pathInput =
        document.getElementById(
            "file-path-input"
        );


    const path =
        pathInput
            ? pathInput.value.trim()
            : "";


    /* =====================================================
       START PLAYBACK
    ===================================================== */

    if (isRunning) {

        if (!path) {

            if (errorLed) {

                errorLed.className =
                    "status-bulb active-red";

            }


            if (playLed) {

                playLed.className =
                    "status-bulb";

            }


            window.RxLogger && RxLogger.error("Playback cannot start: no file or folder source selected");

            alert(
                "Please select a file or folder source first."
            );


            return;

        }


        if (playLed) {

            playLed.className =
                "status-bulb active-green";

        }

        window.RxLogger && RxLogger.rx("Playback started: " + path);


        if (errorLed) {

            errorLed.className =
                "status-bulb";

        }


    } else {

        /* ===============================================
           STOP PLAYBACK
        =============================================== */

        window.RxLogger && RxLogger.rx("Playback stopped");

        if (playLed) {

            playLed.className =
                "status-bulb";

        }


        if (errorLed) {

            errorLed.className =
                "status-bulb";

        }

    }

}
