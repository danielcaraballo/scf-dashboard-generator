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
      try {
        if (typeof XLSX === 'undefined') {
          throw new Error('La librería para leer archivos Excel (SheetJS) no está disponible.');
        }
        const data = new Uint8Array(e.target.result);
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
    };
    reader.onerror = (err) => onError(err || new Error('Error al leer el archivo de Excel.'));
    reader.readAsArrayBuffer(file);
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

    const explicitStatusCandidates = ['situacion (estatus)', 'estatus', 'estado_vehiculo', 'situacion', 'condicion'];
    let statusCol = this.detectColumn(headers, explicitStatusCandidates, used);

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

    const gerenciaCol = this.detectColumn(headers, FleetConfig.GERENCIA_COLUMN_CANDIDATES, used);
    if (gerenciaCol) used.push(gerenciaCol);

    const gpsCol = this.detectColumn(headers, FleetConfig.GPS_COLUMN_CANDIDATES, used);
    if (gpsCol) used.push(gpsCol);

    const verificadoCol = this.detectColumn(headers, FleetConfig.VERIFICADO_COLUMN_CANDIDATES, used);
    if (verificadoCol) used.push(verificadoCol);

    return {
      status: statusCol,
      geo: geoCol,
      fuel: fuelCol,
      gerencia: gerenciaCol,
      gps: gpsCol,
      verificado: verificadoCol
    };
  }
};
