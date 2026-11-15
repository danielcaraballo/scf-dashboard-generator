window.FleetCharts = (function () {
  const charts = {};
  const PALETTE = ['#0EA5E9', '#10B981', '#EAB308', '#F97316', '#8B5CF6', '#EF4444', '#06B6D4', '#64748B', '#84CC16', '#A855F7', '#14B8A6', '#EC4899'];

  function isDark() {
    return document.documentElement.classList.contains('dark');
  }

  function themeColors(theme) {
    const dark = theme === 'dark' ? true : theme === 'light' ? false : isDark();
    return dark
      ? { donutBorder: '#1E293B', countText: '#CBD5E1', hbarTick: '#94A3B8', vbarTick: '#94A3B8' }
      : { donutBorder: '#FFFFFF', countText: '#334155', hbarTick: '#475569', vbarTick: '#64748B' };
  }

  function canvasOf(idOrEl) {
    return typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  }

  function chartKey(idOrEl) {
    if (typeof idOrEl === 'string') return idOrEl;
    return '__export:' + (idOrEl.id || '');
  }

  function destroy(key) {
    if (charts[key]) {
      charts[key].destroy();
      delete charts[key];
    }
  }

  function palette(count) {
    return Array.from({ length: count }, (_, i) => PALETTE[i % PALETTE.length]);
  }

  function fuelColors(items) {
    let colorIdx = 0;
    return (items || []).map((item) => {
      const label = String(item.label || '').toUpperCase();
      if (label === 'POR IDENTIFICAR' || label === 'SIN CLASIFICAR') {
        return '#94A3B8';
      }
      const c = PALETTE[colorIdx % PALETTE.length];
      colorIdx++;
      return c;
    });
  }

  function pctLabel(item, total) {
    const pct = total ? ((item.count / total) * 100).toFixed(1) : '0.0';
    return `${item.label}: ${item.count.toLocaleString('es-MX')} (${pct}%)`;
  }

  function renderDonut(idOrEl, items, total, opts) {
    opts = opts || {};
    const ctx = canvasOf(idOrEl);
    if (!ctx) return;
    const key = chartKey(idOrEl);
    destroy(key);
    const colors = themeColors(opts.theme);
    const bgColors = opts.colors || fuelColors(items);

    charts[key] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: items.map((i) => i.label),
        datasets: [{
          data: items.map((i) => i.count),
          backgroundColor: bgColors,
          borderColor: colors.donutBorder,
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => pctLabel({ label: c.label, count: c.raw }, total) } }
        }
      }
    });
  }

  function countRightPlugin(items, theme) {
    return {
      id: 'countRight',
      afterDatasetsDraw(chart) {
        const { ctx, scales } = chart;
        ctx.save();
        ctx.font = '600 11px Poppins, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = themeColors(theme).countText;
        items.forEach((item, i) => {
          const px = scales.x.getPixelForValue(item.count);
          const py = scales.y.getPixelForValue(i);
          ctx.fillText(item.count.toLocaleString('es-MX'), px + 6, py);
        });
        ctx.restore();
      }
    };
  }

  function renderHBar(idOrEl, items, color, opts) {
    opts = opts || {};
    const ctx = canvasOf(idOrEl);
    if (!ctx) return;
    const key = chartKey(idOrEl);
    destroy(key);
    const colors = themeColors(opts.theme);

    charts[key] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: items.map((i) => i.label),
        datasets: [{
          data: items.map((i) => i.count),
          backgroundColor: color,
          borderRadius: 4,
          barPercentage: 0.7
        }]
      },
      plugins: [countRightPlugin(items, opts.theme)],
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => {
                const item = items.find((i) => i.label === c.label);
                return `${c.raw.toLocaleString('es-MX')} (${item ? item.pct.toFixed(1) : '0.0'}%)`;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            display: false,
            grace: '12%'
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { size: 11 },
              color: colors.hbarTick,
              callback(val) {
                const label = this.getLabelForValue(val);
                return label.length > 20 ? label.slice(0, 18) + '…' : label;
              }
            }
          }
        }
      }
    });
  }

  function renderLightChartsIn(root, analysis) {
    if (!root || !analysis) return;
    const q = (sel) => root.querySelector(sel);

    if (analysis.fuel && analysis.fuel.length) {
      const canvas = q('#fuelCanvas');
      if (canvas) {
        const totalFuel = analysis.fuel.reduce((s, i) => s + i.count, 0);
        renderDonut(canvas, analysis.fuel, totalFuel, { theme: 'light' });
      }
    }

    if (analysis.clase && analysis.clase.length) {
      const canvas = q('#claseCanvas');
      if (canvas) {
        renderHBar(canvas, analysis.clase, '#0EA5E9', { theme: 'light' });
      }
    }
  }

  function destroyAll() {
    Object.keys(charts).forEach(destroy);
  }

  function destroyExportCharts() {
    Object.keys(charts)
      .filter((k) => k.indexOf('__export:') === 0)
      .forEach(destroy);
  }

  return { renderDonut, renderHBar, palette, fuelColors, destroyAll, renderLightChartsIn, destroyExportCharts };
})();