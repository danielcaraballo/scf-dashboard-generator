window.FleetProcessing = {
  validateFleetData(rows, cols) {
    if (!rows || rows.length === 0) {
      return { isValid: false, reason: 'El archivo CSV no contiene registros de datos para analizar.' };
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
        reason: 'El archivo CSV no contiene la columna requerida de estatus del vehículo ("Estatus", "Estado", "Condición", etc.).'
      };
    }

    const statusCol = cols.status;
    let validFleetMatches = 0;
    let nonEmpCount = 0;

    for (const row of rows) {
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
      const colKey = cols[key] || (key === 'clase' ? cols.modelo : null);
      if (colKey) {
        detectedColumns.push({ key, label, colName: colKey });
      } else {
        missingColumns.push({ key, label });
      }
    }

    const geoData = this.distribution(rows, cols.geo, 10);
    const fuelData = this.distribution(rows, cols.fuel, null);
    const claseColTarget = cols.clase || cols.modelo;
    const claseData = this.distribution(rows, claseColTarget, 10);
    const gpsData = this.coverage(rows, cols.gps);
    const verificadoData = this.coverage(rows, cols.verificado);
    const porEstadoData = this.operatividadPorEstado(rows, cols);

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
      geo: geoData,
      fuel: fuelData,
      clase: claseData,
      gpsCoverage: gpsData,
      verificado: verificadoData,
      porEstado: porEstadoData,
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

  distribution(rows, column, topN) {
    if (!column) return null;
    const counts = {};
    for (const row of rows) {
      const value = FleetConfig.normalize(row[column]);
      if (!value) continue;
      counts[value] = (counts[value] || 0) + 1;
    }

    let items = Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    const total = items.reduce((sum, item) => sum + item.count, 0);

    if (topN && items.length > topN) {
      const rest = items.slice(topN);
      const restCount = rest.reduce((sum, item) => sum + item.count, 0);
      items = items.slice(0, topN).concat([{ label: 'Otros', count: restCount }]);
    }

    return items.map((item) => ({
      ...item,
      pct: total ? (item.count / total) * 100 : 0
    }));
  },

  coverage(rows, column) {
    if (!column) return null;
    let yes = 0;
    let no = 0;
    for (const row of rows) {
      const value = FleetConfig.normalize(row[column]);
      if (!value || value === 'N' || value === 'NO' || value === 'FALSE' || value === '0') no++;
      else yes++;
    }
    const total = yes + no;
    return { yes, no, pct: total ? (yes / total) * 100 : 0 };
  }
};
