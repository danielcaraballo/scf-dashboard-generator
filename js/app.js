(function () {
  const fileInput = document.getElementById("fileInput");
  const loadBtn = document.getElementById("loadBtn");
  const exportBtn = document.getElementById("exportBtn");
  const imageBtn = document.getElementById("imageBtn");
  const dropZone = document.getElementById("dropZone");
  const emptyState = document.getElementById("emptyState");
  const stateFilterSelect = document.getElementById("stateFilterSelect");
  const clearFilterBtn = document.getElementById("clearFilterBtn");

  let currentRows = null;
  let currentCols = null;
  let currentFile = null;

  function applyFilter(selectedStateNorm) {
    if (!currentRows || !currentCols) return;

    let filteredRows = currentRows;
    if (selectedStateNorm && currentCols.geo) {
      filteredRows = currentRows.filter(
        (row) => FleetConfig.normalize(row[currentCols.geo]) === selectedStateNorm
      );
    }

    const analysis = FleetProcessing.analyze(filteredRows, currentCols);
    FleetUI.render({
      analysis,
      file: currentFile,
      activeStateFilter: selectedStateNorm,
      rawRows: currentRows,
      cols: currentCols
    });
  }

  function handleFile(file) {
    if (!file) return;
    FleetUI.reset();
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
        if (cols && cols.geo && rows && rows.length > 0) {
          const uniqueStates = new Set();
          for (const r of rows) {
            const norm = FleetConfig.normalize(r[cols.geo]);
            if (norm) uniqueStates.add(norm);
          }
          if (uniqueStates.size === 1) {
            initialFilterState = Array.from(uniqueStates)[0];
          }
        }

        if (stateFilterSelect) {
          stateFilterSelect.value = initialFilterState;
        }

        applyFilter(initialFilterState);
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
      applyFilter(e.target.value);
    });
  }

  if (clearFilterBtn) {
    clearFilterBtn.addEventListener("click", () => {
      if (stateFilterSelect) stateFilterSelect.value = "";
      applyFilter("");
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
        dropZone.classList.add("ring-2", "ring-sky-400", "bg-sky-50");
    });
  });

  ["dragleave", "drop"].forEach((evt) => {
    document.addEventListener(evt, (e) => {
      e.preventDefault();
      if (dropZone) dropZone.classList.remove("ring-2", "ring-sky-400", "bg-sky-50");
    });
  });

  document.addEventListener("drop", (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  if (exportBtn) exportBtn.addEventListener("click", () => FleetExport.exportPDF());
  if (imageBtn) imageBtn.addEventListener("click", () => FleetExport.exportPNG());
})();
