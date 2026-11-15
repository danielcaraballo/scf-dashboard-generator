(function () {
  const fileInput = document.getElementById("fileInput");
  const loadBtn = document.getElementById("loadBtn");
  const exportBtn = document.getElementById("exportBtn");
  const dropZone = document.getElementById("dropZone");
  const emptyState = document.getElementById("emptyState");
  const stateFilterSelect = document.getElementById("stateFilterSelect");
  const clearFilterBtn = document.getElementById("clearFilterBtn");
  const activeFleetBtn = document.getElementById("activeFleetBtn");
  const stateTabTipoBtn = document.getElementById("stateTabTipoBtn");
  const stateTabModeloBtn = document.getElementById("stateTabModeloBtn");

  let currentRows = null;
  let currentCols = null;
  let currentFile = null;
  let currentStateFilter = "";
  let activeFleetOnly = false;
  let isSingleStateFile = false;
  let singleStateRawName = "";

  function applyFilters() {
    if (!currentRows || !currentCols) return;

    let baseRows = currentRows;
    if (activeFleetOnly && currentCols.status) {
      baseRows = currentRows.filter((row) =>
        FleetConfig.isActiveFleet(row[currentCols.status])
      );
    }

    const currentFullPorEstado = FleetProcessing.operatividadPorEstado(baseRows, currentCols);

    const isStateMode = Boolean(isSingleStateFile || currentStateFilter);

    let targetStateName = "";
    if (currentStateFilter) {
      targetStateName = FleetConfig.resolveStateName(currentStateFilter) || currentStateFilter;
    } else if (isSingleStateFile && singleStateRawName) {
      targetStateName = FleetConfig.resolveStateName(singleStateRawName) || singleStateRawName;
    }

    let filteredRows = baseRows;
    if (currentStateFilter && currentCols.geo) {
      const targetNorm = FleetConfig.normalize(currentStateFilter);
      filteredRows = baseRows.filter(
        (row) => FleetConfig.normalize(row[currentCols.geo]) === targetNorm
      );
    }

    let analysis;
    let currentNationalRate = 0;
    const currentNationalTotal = baseRows.length;

    if (!currentStateFilter) {
      analysis = FleetProcessing.analyze(baseRows, currentCols);
      currentNationalRate = analysis ? analysis.rate : 0;
    } else {
      let baseOperative = 0;
      if (currentCols.status) {
        for (const r of baseRows) {
          if (FleetConfig.toSemantic(r[currentCols.status]) === "operativo") {
            baseOperative++;
          }
        }
      }
      currentNationalRate = currentNationalTotal ? (baseOperative / currentNationalTotal) * 100 : 0;
      analysis = FleetProcessing.analyze(filteredRows, currentCols);
    }

    FleetUI.render({
      analysis,
      file: currentFile,
      activeStateFilter: currentStateFilter,
      activeFleetOnly,
      rawRows: currentRows,
      baseRows: baseRows,
      cols: currentCols,
      fullPorEstado: currentFullPorEstado,
      nationalRate: currentNationalRate,
      nationalTotal: currentNationalTotal,
      isSingleStateFile,
      isStateMode,
      targetStateName
    });
  }

  function handleFile(file) {
    if (!file) return;
    FleetUI.reset();
    currentRows = null;
    currentCols = null;
    currentFile = null;
    currentStateFilter = "";
    activeFleetOnly = false;
    isSingleStateFile = false;
    singleStateRawName = "";
    if (file.size === 0) {
      FleetUI.showError("El archivo está vacío (0 bytes).");
      return;
    }
    const limits = FleetConfig.LIMITS || { MAX_FILE_SIZE_BYTES: 30 * 1024 * 1024, MAX_FILE_SIZE_MB: 30 };
    if (file.size > limits.MAX_FILE_SIZE_BYTES) {
      FleetUI.showError(`El archivo supera el tamaño máximo permitido de ${limits.MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    const isCsv = /\.csv$/i.test(file.name);
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (!isCsv && !isExcel) {
      FleetUI.showError(
        "Formato de archivo no soportado. Selecciona un archivo válido con extensión .csv, .xlsx o .xls."
      );
      return;
    }
    FleetUI.clearError();
    FleetUI.setStatus("Procesando…");

    FleetParser.parse(
      file,
      (rows, meta) => {
        const cols = FleetParser.detectColumns(meta.fields || [], rows);
        const validation = FleetProcessing.validateFleetData(rows, cols);

        if (!validation.isValid) {
          FleetUI.showError(validation.reason);
          return;
        }

        currentRows = rows;
        currentCols = cols;
        currentFile = file;

        let initialFilterState = "";
        let uniqueStatesCount = 0;
        singleStateRawName = "";
        if (cols && cols.geo && rows && rows.length > 0) {
          const uniqueStates = new Set();
          for (const r of rows) {
            const norm = FleetConfig.normalize(r[cols.geo]);
            if (norm) {
              uniqueStates.add(norm);
              if (!singleStateRawName) singleStateRawName = norm;
            }
          }
          uniqueStatesCount = uniqueStates.size;
          if (uniqueStatesCount === 1) {
            initialFilterState = Array.from(uniqueStates)[0];
          }
        }
        isSingleStateFile = uniqueStatesCount === 1;

        if (stateFilterSelect) {
          stateFilterSelect.value = initialFilterState;
        }

        currentStateFilter = initialFilterState;
        activeFleetOnly = false;
        applyFilters();
      },
      (err) => {
        const msg =
          err && err.message
            ? err.message
            : "No se pudo leer el archivo. Verifica que no esté dañado o protegido con contraseña.";
        FleetUI.showError(msg);
      }
    );
  }

  if (stateFilterSelect) {
    stateFilterSelect.addEventListener("change", (e) => {
      currentStateFilter = e.target.value;
      applyFilters();
    });
  }

  if (activeFleetBtn) {
    activeFleetBtn.addEventListener("click", () => {
      activeFleetOnly = !activeFleetOnly;
      applyFilters();
    });
  }

  if (stateTabTipoBtn) {
    stateTabTipoBtn.addEventListener("click", () => {
      FleetUI.setStateTab("tipo");
    });
  }

  if (stateTabModeloBtn) {
    stateTabModeloBtn.addEventListener("click", () => {
      FleetUI.setStateTab("modelo");
    });
  }

  if (clearFilterBtn) {
    clearFilterBtn.addEventListener("click", () => {
      currentStateFilter = "";
      activeFleetOnly = false;
      if (stateFilterSelect) stateFilterSelect.value = "";
      applyFilters();
    });
  }

  if (loadBtn) loadBtn.addEventListener("click", () => fileInput && fileInput.click());
  if (dropZone) {
    dropZone.addEventListener("click", () => fileInput && fileInput.click());
    dropZone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (fileInput) fileInput.click();
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      handleFile(fileInput.files[0]);
      fileInput.value = "";
    });
  }

  ["dragenter", "dragover"].forEach((evt) => {
    document.addEventListener(evt, (e) => {
      e.preventDefault();
      if (dropZone && emptyState && !emptyState.classList.contains("hidden"))
        dropZone.classList.add("ring-2", "ring-sky-400", "bg-sky-50", "dark:bg-sky-950/40");
    });
  });

  ["dragleave", "drop"].forEach((evt) => {
    document.addEventListener(evt, (e) => {
      e.preventDefault();
      if (dropZone) dropZone.classList.remove("ring-2", "ring-sky-400", "bg-sky-50", "dark:bg-sky-950/40");
    });
  });

  document.addEventListener("drop", (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  if (exportBtn) exportBtn.addEventListener("click", () => FleetExport.exportPDF());
})();
