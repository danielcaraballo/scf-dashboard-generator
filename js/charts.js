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

    charts[key] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: items.map((i) => i.label),
        datasets: [{
          data: items.map((i) => i.count),
          backgroundColor: palette(items.length),
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

  function pctTopPlugin(items, theme) {
    return {
      id: 'pctTop',
      afterDatasetsDraw(chart) {
        const { ctx, scales } = chart;
        ctx.save();
        ctx.font = '600 10px Poppins, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = themeColors(theme).countText;
        items.forEach((item, i) => {
          const px = scales.x.getPixelForValue(i);
          const py = scales.y.getPixelForValue(item.total);
          ctx.fillText(`${item.pct.toFixed(0)}%`, px, py - 3);
        });
        ctx.restore();
      }
    };
  }

  function renderVBarStacked(idOrEl, items, opts) {
    opts = opts || {};
    const ctx = canvasOf(idOrEl);
    if (!ctx) return;
    const key = chartKey(idOrEl);
    destroy(key);
    const colors = themeColors(opts.theme);

    charts[key] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: items.map((i) => i.shortLabel || i.label),
        datasets: [
          { label: 'Operativos', data: items.map((i) => i.operativos), backgroundColor: '#10B981', borderRadius: 0 },
          { label: 'No operativos', data: items.map((i) => i.inactivos), backgroundColor: '#EF4444', borderRadius: 4 }
        ]
      },
      plugins: [pctTopPlugin(items, opts.theme)],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (t) => {
                const item = items[t[0].dataIndex];
                return item ? item.label : t[0].label;
              },
              label: (c) => {
                const item = items[c.dataIndex];
                if (!item || !item.total) return `${c.dataset.label}: ${c.raw.toLocaleString('es-MX')}`;
                const pct = (c.raw / item.total) * 100;
                return `${c.dataset.label}: ${c.raw.toLocaleString('es-MX')} (${pct.toFixed(1)}%)`;
              },
              footer: (t) => {
                const item = items[t[0].dataIndex];
                if (!item) return '';
                return `Total: ${item.total.toLocaleString('es-MX')} · ${item.pct.toFixed(1)}% operativos`;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              autoSkip: false,
              maxRotation: 45,
              minRotation: 0,
              font: { size: 8 },
              color: colors.vbarTick,
              padding: 2,
              callback(val) {
                const label = this.getLabelForValue(val);
                if (label.length <= 10) return label;
                const words = label.split(' ');
                const lines = [];
                let line = words[0];
                for (let i = 1; i < words.length; i++) {
                  if ((line + ' ' + words[i]).length <= 10) line += ' ' + words[i];
                  else { lines.push(line); line = words[i]; }
                }
                lines.push(line);
                return lines.join('\n');
              }
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            display: false,
            grace: '10%'
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

    if (analysis.porEstado && analysis.porEstado.length) {
      const section = q('#estadoSectionContainer');
      if (!section || !section.classList.contains('hidden')) {
        const canvas = q('#estadoChartCanvas');
        if (canvas) {
          renderVBarStacked(canvas, analysis.porEstado, { theme: 'light' });
        }
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

  return { renderDonut, renderHBar, renderVBarStacked, palette, destroyAll, renderLightChartsIn, destroyExportCharts };
})();