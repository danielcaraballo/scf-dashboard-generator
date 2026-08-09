window.FleetParser = {
  parse(file, onComplete, onError) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (result) => onComplete(result.data, result.meta),
      error: (err) => onError(err)
    });
  },

  detectColumn(headers, candidates) {
    const normalized = headers.map((h) => FleetConfig.normalize(h));
    for (const candidate of candidates) {
      const norm = FleetConfig.normalize(candidate);
      const exact = normalized.indexOf(norm);
      if (exact !== -1) return headers[exact];
    }
    for (const candidate of candidates) {
      const norm = FleetConfig.normalize(candidate);
      const found = normalized.findIndex((h) => h.includes(norm));
      if (found !== -1) return headers[found];
    }
    return null;
  },

  detectColumns(headers) {
    return {
      status: this.detectColumn(headers, FleetConfig.STATUS_COLUMN_CANDIDATES),
      geo: this.detectColumn(headers, FleetConfig.GEO_COLUMN_CANDIDATES),
      fuel: this.detectColumn(headers, FleetConfig.FUEL_COLUMN_CANDIDATES),
      gerencia: this.detectColumn(headers, FleetConfig.GERENCIA_COLUMN_CANDIDATES),
      gps: this.detectColumn(headers, FleetConfig.GPS_COLUMN_CANDIDATES),
      verificado: this.detectColumn(headers, FleetConfig.VERIFICADO_COLUMN_CANDIDATES)
    };
  }
};
