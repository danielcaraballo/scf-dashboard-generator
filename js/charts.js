window.FleetCharts = (function () {
  const charts = {};
  const PALETTE = ['#0EA5E9', '#10B981', '#EAB308', '#F97316', '#8B5CF6', '#EF4444', '#06B6D4', '#64748B', '#84CC16', '#A855F7', '#14B8A6', '#EC4899'];

  function destroy(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  function palette(count) {
    return Array.from({ length: count }, (_, i) => PALETTE[i % PALETTE.length]);
  }

  function pctLabel(item, total) {
    const pct = total ? ((item.count / total) * 100).toFixed(1) : '0.0';
    return `${item.label}: ${item.count.toLocaleString('es-MX')} (${pct}%)`;
  }

  function renderDonut(id, items, total) {
    destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;

    charts[id] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: items.map((i) => i.label),
        datasets: [{
          data: items.map((i) => i.count),
          backgroundColor: palette(items.length),
          borderColor: '#ffffff',
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

  function renderHBar(id, items, color) {
    destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;

    charts[id] = new Chart(ctx, {
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
            ticks: { precision: 0, font: { size: 10 }, color: '#64748B' },
            grid: { color: 'rgba(148,163,184,0.15)' }
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#475569' }
          }
        }
      }
    });
  }

  function pctTopPlugin(items) {
    return {
      id: 'pctTop',
      afterDatasetsDraw(chart) {
        const { ctx, scales } = chart;
        ctx.save();
        ctx.font = '600 10px Poppins, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#334155';
        items.forEach((item, i) => {
          const px = scales.x.getPixelForValue(i);
          const py = scales.y.getPixelForValue(item.total);
          ctx.fillText(`${item.pct.toFixed(0)}%`, px, py - 3);
        });
        ctx.restore();
      }
    };
  }

  function renderVBarStacked(id, items) {
    destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;

    charts[id] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: items.map((i) => i.label),
        datasets: [
          { label: 'Operativos', data: items.map((i) => i.operativos), backgroundColor: '#10B981', borderRadius: 0 },
          { label: 'No operativos', data: items.map((i) => i.inactivos), backgroundColor: '#EF4444', borderRadius: 4 }
        ]
      },
      plugins: [pctTopPlugin(items)],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => {
                const item = items.find((i) => i.label === c.label);
                return `${c.dataset.label}: ${c.raw.toLocaleString('es-MX')}`;
              },
              footer: (t) => {
                const item = items.find((i) => i.label === t[0].label);
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
              maxRotation: 0,
              font: { size: 7.5 },
              color: '#64748B',
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

  function destroyAll() {
    Object.keys(charts).forEach(destroy);
  }

  return { renderDonut, renderHBar, renderVBarStacked, palette, destroyAll };
})();
