window.FleetProcessing = {
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
      geo: this.distribution(rows, cols.geo, 10),
      fuel: this.distribution(rows, cols.fuel, null),
      gerencia: this.distribution(rows, cols.gerencia, null),
      gpsCoverage: this.coverage(rows, cols.gps),
      verificado: this.coverage(rows, cols.verificado),
      porEstado: this.operatividadPorEstado(rows, cols)
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
