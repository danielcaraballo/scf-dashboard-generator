window.FleetParser = {
  parse(file, onComplete, onError) {
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (isExcel) {
      this.parseExcel(file, onComplete, onError);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: 'greedy',
        worker: true,
        complete: (result) => onComplete(result.data, result.meta),
        error: (err) => onError(err)
      });
    }
  },

  parseExcel(file, onComplete, onError) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target.result;
      if (typeof Worker !== 'undefined') {
        this.parseExcelWithWorker(buffer, onComplete, onError);
      } else {
        this.parseExcelSync(buffer, onComplete, onError);
      }
    };
    reader.onerror = (err) => onError(err || new Error('Error al leer el archivo de Excel.'));
    reader.readAsArrayBuffer(file);
  },

  parseExcelWithWorker(arrayBuffer, onComplete, onError) {
    let worker = null;
    let blobUrl = null;
    try {
      const workerCode = `
        self.onmessage = function(e) {
          try {
            importScripts('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
            const data = new Uint8Array(e.data);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
              throw new Error('El archivo Excel no contiene hojas de trabajo.');
            }
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
            const fields = rows.length > 0 ? Object.keys(rows[0]) : [];
            self.postMessage({ success: true, rows: rows, meta: { fields: fields, sheetName: firstSheetName } });
          } catch (err) {
            self.postMessage({ success: false, error: (err && err.message) || String(err) });
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      blobUrl = URL.createObjectURL(blob);
      worker = new Worker(blobUrl);

      worker.onmessage = (e) => {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        if (worker) worker.terminate();
        if (e.data && e.data.success) {
          onComplete(e.data.rows, e.data.meta);
        } else {
          this.parseExcelSync(arrayBuffer, onComplete, onError);
        }
      };

      worker.onerror = () => {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        if (worker) worker.terminate();
        this.parseExcelSync(arrayBuffer, onComplete, onError);
      };

      const transferable = arrayBuffer.slice(0);
      worker.postMessage(transferable, [transferable]);
    } catch (err) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      if (worker) worker.terminate();
      this.parseExcelSync(arrayBuffer, onComplete, onError);
    }
  },

  parseExcelSync(arrayBuffer, onComplete, onError) {
    try {
      if (typeof XLSX === 'undefined') {
        throw new Error('La librería para leer archivos Excel (SheetJS) no está disponible.');
      }
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('El archivo Excel no contiene hojas de trabajo.');
      }
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
      const fields = rows.length > 0 ? Object.keys(rows[0]) : [];
      onComplete(rows, { fields, sheetName: firstSheetName });
    } catch (err) {
      onError(err);
    }
  },

  detectColumn(headers, candidates, usedColumns = []) {
    const available = headers.filter((h) => !usedColumns.includes(h));
    const normalized = available.map((h) => FleetConfig.normalize(h));

    for (const candidate of candidates) {
      const norm = FleetConfig.normalize(candidate);
      const exact = normalized.indexOf(norm);
      if (exact !== -1) return available[exact];
    }
    for (const candidate of candidates) {
      const norm = FleetConfig.normalize(candidate);
      const found = normalized.findIndex((h) => h.includes(norm));
      if (found !== -1) return available[found];
    }
    return null;
  },

  detectColumns(headers, rows = []) {
    const used = [];

    let statusCol = this.detectColumn(headers, FleetConfig.ESTATUS_COLUMN_CANDIDATES, used);

    let geoCol = null;
    if (statusCol) {
      used.push(statusCol);
      geoCol = this.detectColumn(headers, FleetConfig.GEO_COLUMN_CANDIDATES, used);
      if (geoCol) used.push(geoCol);
    } else {
      const fallbackStatusCol = this.detectColumn(headers, ['estado'], used);
      if (fallbackStatusCol && rows && rows.length > 0) {
        let fleetStatusMatches = 0;
        const sample = rows.slice(0, 30);
        for (const row of sample) {
          const val = row[fallbackStatusCol];
          const semantic = FleetConfig.toSemantic(val);
          if (semantic && semantic !== 'sin_clasificar') fleetStatusMatches++;
        }
        if (fleetStatusMatches > 0) {
          statusCol = fallbackStatusCol;
          used.push(statusCol);
        } else {
          geoCol = fallbackStatusCol;
          used.push(geoCol);
        }
      } else if (fallbackStatusCol) {
        statusCol = fallbackStatusCol;
        used.push(statusCol);
      }
    }

    const fuelCol = this.detectColumn(headers, FleetConfig.FUEL_COLUMN_CANDIDATES, used);
    if (fuelCol) used.push(fuelCol);

    const denominacionCol = this.detectColumn(headers, FleetConfig.DENOMINACION_COLUMN_CANDIDATES, used);
    if (denominacionCol) used.push(denominacionCol);

    const claseCol = this.detectColumn(headers, FleetConfig.CLASS_COLUMN_CANDIDATES, used) || denominacionCol;
    if (claseCol && !used.includes(claseCol)) used.push(claseCol);

    const marcaCol = this.detectColumn(headers, FleetConfig.BRAND_COLUMN_CANDIDATES, used);
    if (marcaCol) used.push(marcaCol);

    const modeloCol = this.detectColumn(headers, FleetConfig.MODEL_COLUMN_CANDIDATES, used);
    if (modeloCol) used.push(modeloCol);

    const gpsCol = this.detectColumn(headers, FleetConfig.GPS_COLUMN_CANDIDATES, used);
    if (gpsCol) used.push(gpsCol);

    const verificadoCol = this.detectColumn(headers, FleetConfig.VERIFICADO_COLUMN_CANDIDATES, used);
    if (verificadoCol) used.push(verificadoCol);

    return {
      status: statusCol,
      geo: geoCol,
      fuel: fuelCol,
      denominacion: denominacionCol,
      clase: claseCol,
      marca: marcaCol,
      modelo: modeloCol,
      gps: gpsCol,
      verificado: verificadoCol
    };
  }
};
