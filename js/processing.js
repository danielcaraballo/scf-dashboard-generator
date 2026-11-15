window.FleetProcessing = {
  validateFleetData(rows, cols) {
    if (!rows || rows.length === 0) {
      return { isValid: false, reason: 'El archivo cargado no contiene registros de datos para analizar.' };
    }

    const maxRecords = (FleetConfig.LIMITS && FleetConfig.LIMITS.MAX_RECORDS) || 50000;
    if (rows.length > maxRecords) {
      return {
        isValid: false,
        reason: `El archivo contiene ${rows.length.toLocaleString('es-MX')} registros, superando el límite máximo de ${maxRecords.toLocaleString('es-MX')} registros soportados.`
      };
    }

    if (!cols || !cols.status) {
      return {
        isValid: false,
        reason: 'El archivo cargado no contiene la columna requerida de estatus del vehículo ("Estatus", "Estado", "Condición", etc.).'
      };
    }

    const statusCol = cols.status;
    let validFleetMatches = 0;
    let nonEmpCount = 0;

    for (const row of rows) {
      if (!row) continue;
      const val = row[statusCol];
      if (val === undefined || val === null || String(val).trim() === '') continue;
      nonEmpCount++;
      const semantic = FleetConfig.toSemantic(val);
      if (semantic && semantic !== 'sin_clasificar') {
        validFleetMatches++;
      }
    }

    if (nonEmpCount === 0) {
      return { isValid: false, reason: `La columna de estatus ("${statusCol}") está vacía en todos los registros.` };
    }

    const matchRatio = validFleetMatches / nonEmpCount;
    if (validFleetMatches === 0 || (nonEmpCount >= 10 && matchRatio < 0.15)) {
      return {
        isValid: false,
        reason: `El archivo cargado no parece contener datos de flota vehicular. La columna "${statusCol}" no contiene estatus de vehículos reconocidos (ej. Operativo, En Reparación, Inoperativo, Desincorporado, Hurtado, etc.).`
      };
    }

    return { isValid: true };
  },

  analyze(rows, cols) {
    const statusCol = cols.status;
    const counts = {};
    let valid = 0;
    let invalid = 0;

    for (const row of rows) {
      if (!row) {
        invalid++;
        continue;
      }
      const semantic = statusCol ? FleetConfig.toSemantic(row[statusCol]) : null;
      if (semantic === null) {
        invalid++;
        continue;
      }
      valid++;
      counts[semantic] = (counts[semantic] || 0) + 1;
    }

    const total = rows.length;
    const operative = counts.operativo || 0;
    const activeTotal = operative + (counts.en_reparacion || 0) + (counts.inactivo || 0);

    const stats = FleetConfig.STATUS_ORDER.map((s) => {
      const count = counts[s.key] || 0;
      return {
        ...s,
        count,
        pct: total ? (count / total) * 100 : 0
      };
    });

    const unclassifiedCount = counts.sin_clasificar || 0;
    const unclassifiedPct = total ? (unclassifiedCount / total) * 100 : 0;

    const dimensionLabels = {
      status: 'Estatus del vehículo',
      geo: 'Ubicación geográfica (Estado)',
      fuel: 'Tipo de combustible',
      clase: 'Clase de vehículo',
      gps: 'Cobertura GPS',
      verificado: 'Verificación de datos'
    };

    const detectedColumns = [];
    const missingColumns = [];
    for (const [key, label] of Object.entries(dimensionLabels)) {
      const colKey = cols[key] || (key === 'clase' ? (cols.denominacion || cols.modelo) : null);
      if (colKey) {
        detectedColumns.push({ key, label, colName: colKey });
      } else {
        missingColumns.push({ key, label });
      }
    }

    let modeloExtractor = null;
    if (cols.marca || cols.modelo) {
      modeloExtractor = (row) => {
        if (!row) return '';
        const brand = cols.marca ? FleetConfig.normalize(row[cols.marca]) : '';
        const model = cols.modelo ? FleetConfig.normalize(row[cols.modelo]) : '';
        if (brand && model) {
          if (model.startsWith(brand)) return model;
          return `${brand} ${model}`;
        }
        return model || brand || '';
      };
    }

    const fuelData = this.fuelDistribution(rows, cols, total);
    const modeloData = modeloExtractor ? this.distribution(rows, modeloExtractor, 9, 'OTROS MODELOS') : null;
    const tipoColTarget = cols.denominacion || cols.clase || cols.modelo;
    const tipoData = this.distribution(rows, tipoColTarget, 9, 'OTRAS DENOMINACIONES');
    const claseColTarget = cols.clase || cols.denominacion || cols.modelo;
    const claseData = this.distribution(rows, claseColTarget, 10);
    const gpsData = this.coverage(rows, cols.gps);
    const verificadoData = this.coverage(rows, cols.verificado);
    const porEstadoData = this.operatividadPorEstado(rows, cols);

    const enReparacion = counts.en_reparacion || 0;
    const totalInactivos = total - operative;
    const pctRecuperable = totalInactivos > 0 ? (enReparacion / totalInactivos) * 100 : 0;

    const stateDiagnostic = {
      enReparacion,
      pctRecuperable,
      topTipos: tipoData || [],
      topModelos: modeloData || []
    };

    return {
      total,
      valid,
      invalid,
      rate: total ? (operative / total) * 100 : 0,
      activeFleet: {
        total: activeTotal,
        operativos: operative,
        rate: activeTotal ? (operative / activeTotal) * 100 : 0
      },
      stats,
      counts,
      fuel: fuelData,
      modelo: modeloData,
      clase: claseData,
      gpsCoverage: gpsData,
      verificado: verificadoData,
      porEstado: porEstadoData,
      stateDiagnostic,
      coverage: {
        detectedCount: detectedColumns.length,
        totalDimensions: 6,
        detectedColumns,
        missingColumns,
        unclassifiedCount,
        unclassifiedPct,
        hasGeo: !!(porEstadoData && porEstadoData.length > 0),
        hasFuel: !!(fuelData && fuelData.length > 0),
        hasClase: !!(claseData && claseData.length > 0),
        hasGps: !!gpsData,
        hasVerificado: !!verificadoData
      }
    };
  },

  operatividadPorEstado(rows, cols) {
    if (!cols.geo) return null;
    const byEstado = {};
    for (const row of rows) {
      if (!row) continue;
      const estado = FleetConfig.normalize(row[cols.geo]);
      if (!estado) continue;
      if (!byEstado[estado]) byEstado[estado] = { total: 0, operativos: 0 };
      byEstado[estado].total++;
      const semantic = cols.status ? FleetConfig.toSemantic(row[cols.status]) : null;
      if (semantic === 'operativo') byEstado[estado].operativos++;
    }
    return Object.entries(byEstado)
      .map(([label, d]) => ({
        label,
        shortLabel: FleetConfig.formatStateLabel(label),
        total: d.total,
        operativos: d.operativos,
        inactivos: d.total - d.operativos,
        pct: d.total ? (d.operativos / d.total) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
  },

  distribution(rows, columnOrExtractor, topN, othersLabel = 'OTROS') {
    if (!columnOrExtractor) return null;
    const isFn = typeof columnOrExtractor === 'function';
    const counts = {};
    for (const row of rows) {
      if (!row) continue;
      const rawVal = isFn ? columnOrExtractor(row) : row[columnOrExtractor];
      const value = FleetConfig.normalize(rawVal);
      if (!value) continue;
      counts[value] = (counts[value] || 0) + 1;
    }

    let items = Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    const total = items.reduce((sum, item) => sum + item.count, 0);

    if (topN && items.length > topN) {
      if (othersLabel) {
        const labelText = typeof othersLabel === 'string' ? othersLabel : 'OTROS';
        const rest = items.slice(topN);
        const restCount = rest.reduce((sum, item) => sum + item.count, 0);
        items = items.slice(0, topN).concat([{ label: labelText, count: restCount }]);
      } else {
        items = items.slice(0, topN);
      }
    }

    return items.map((item) => ({
      ...item,
      pct: total ? (item.count / total) * 100 : 0
    }));
  },

  fuelDistribution(rows, cols, total) {
    if (!cols || !cols.fuel) return null;
    const counts = {};
    let identifiedCount = 0;
    const statusCol = cols.status;
    const UNKNOWN_FUEL = new Set([
      'POR IDENTIFICAR',
      'SIN IDENTIFICAR',
      'SIN INFORMACION',
      'NO APLICA',
      'N/A',
      'DESCONOCIDO',
      'NO REGISTRA',
      'NINGUNO',
      '-'
    ]);

    for (const row of rows) {
      if (!row) continue;
      if (statusCol) {
        const semantic = FleetConfig.toSemantic(row[statusCol]);
        if (semantic === null) continue;
      }

      const val = FleetConfig.normalize(row[cols.fuel]);
      if (!val || UNKNOWN_FUEL.has(val)) {
        continue;
      }
      counts[val] = (counts[val] || 0) + 1;
      identifiedCount++;
    }

    let items = Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    const remaining = Math.max(0, total - identifiedCount);
    if (remaining > 0) {
      items.push({ label: 'POR IDENTIFICAR', count: remaining });
    }

    return items.map((item) => ({
      ...item,
      pct: total ? (item.count / total) * 100 : 0
    }));
  },

  coverage(rows, column) {
    if (!column) return null;
    const AFFIRMATIVE = new Set(['Y', 'SI', 'S', 'YES', '1', 'TRUE']);
    let yes = 0;
    let no = 0;
    for (const row of rows) {
      if (!row) continue;
      const value = FleetConfig.normalize(row[column]);
      if (AFFIRMATIVE.has(value) || value.startsWith('HTTP')) {
        yes++;
      } else {
        no++;
      }
    }
    const total = yes + no;
    return { yes, no, pct: total ? (yes / total) * 100 : 0 };
  }
};
