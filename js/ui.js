window.FleetUI = (function () {
  const fmt = new Intl.NumberFormat('es-MX');

  const byId = (id) => document.getElementById(id);

  const ICONS = {
    arrowUp: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 19.5v-15m0 0l-6.75 6.75M12 4.5l6.75 6.75" />',
    arrowDown: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m0 0l6.75-6.75M12 19.5l-6.75-6.75" />',
    mapPin: '<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />'
  };

  function iconSvg(name, cls) {
    return `<svg class="w-4 h-4 ${cls || ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">${ICONS[name]}</svg>`;
  }

  function setStatus(message) {
    const el = byId('loadStatus');
    el.querySelector('#loadStatusText').textContent = message;
    el.classList.remove('hidden');
    el.classList.add('inline-flex', 'items-center', 'gap-2');
  }

  function clearStatus() {
    const el = byId('loadStatus');
    el.classList.add('hidden');
    el.classList.remove('inline-flex', 'items-center', 'gap-2');
  }

  function statFor(stats, key) {
    return stats.find((s) => s.key === key);
  }

  function pctTone(pct) {
    if (pct >= 80) return { color: '#10B981', soft: 'bg-emerald-50', bar: 'bg-emerald-500', text: 'text-emerald-600' };
    if (pct >= 50) return { color: '#F59E0B', soft: 'bg-amber-50', bar: 'bg-amber-500', text: 'text-amber-600' };
    return { color: '#EF4444', soft: 'bg-red-50', bar: 'bg-red-500', text: 'text-red-600' };
  }

  function renderHero(analysis) {
    const tone = pctTone(analysis.rate);
    const operativos = statFor(analysis.stats, 'operativo');

    byId('heroTotal').textContent = fmt.format(analysis.total);
    byId('heroPct').textContent = `${analysis.rate.toFixed(1)}%`;
    byId('heroPct').style.color = tone.color;
    byId('heroBarBg').className = `h-2 rounded-full overflow-hidden ${tone.soft}`;
    byId('heroBar').style.width = `${Math.min(analysis.rate, 100)}%`;
    byId('heroBar').style.backgroundColor = tone.color;
    byId('heroOperativos').textContent = fmt.format(operativos ? operativos.count : 0);
    byId('heroInactivos').textContent = fmt.format(analysis.total - (operativos ? operativos.count : 0));

    const af = analysis.activeFleet || { total: 0, operativos: 0, rate: 0 };
    const afTone = pctTone(af.rate);
    byId('heroActivePct').textContent = `${af.rate.toFixed(1)}%`;
    byId('heroActivePct').style.color = afTone.color;
    byId('heroActiveBarBg').className = `h-2 rounded-full overflow-hidden ${afTone.soft}`;
    byId('heroActiveBar').style.width = `${Math.min(af.rate, 100)}%`;
    byId('heroActiveBar').style.backgroundColor = afTone.color;
  }

  function renderStatusList(stats) {
    byId('statusList').innerHTML = stats
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((s) => `
        <div class="flex items-center gap-2 sm:gap-3">
          <div class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${s.color}"></div>
          <span class="text-xs sm:text-sm text-slate-700 flex-1 min-w-0 truncate">${s.label}</span>
          <div class="flex items-center gap-2 flex-1 max-w-[120px] sm:max-w-[200px]">
            <div class="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200">
              <div class="h-full rounded-full transition-all duration-300" style="width:${s.pct}%; background:${s.color}"></div>
            </div>
          </div>
          <span class="font-mono text-xs sm:text-sm font-semibold text-slate-500 shrink-0 w-11 sm:w-14 text-right">${s.pct.toFixed(1)}%</span>
          <span class="font-mono text-xs sm:text-sm font-semibold text-slate-800 shrink-0 w-8 sm:w-10 text-right">${fmt.format(s.count)}</span>
        </div>`)
      .join('');
  }

  function kpiCardHtml({ title, value, sub, icon, chipClass }) {
    return `
      <div class="w-full sm:w-1/2 lg:w-1/3 p-2">
      <div class="rounded-md border border-slate-200 bg-white transition-all duration-150 hover:shadow-xs h-full">
        <div class="p-3 flex items-center justify-between gap-3">
          <div class="flex flex-col gap-1 min-w-0">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">${title}</span>
            <div class="flex items-baseline gap-1.5 min-w-0">
              <span class="text-lg sm:text-xl font-bold leading-none text-slate-900 truncate">${value}</span>
              ${sub}
            </div>
          </div>
          <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${chipClass}">${icon}</div>
        </div>
      </div>
      </div>`;
  }

  function renderKpiCards(analysis) {
    const cards = [];
    const estados = (analysis.porEstado || []).filter((e) => e.total > 0);

    if (estados.length >= 2) {
      const mejor = estados.reduce((best, e) => (e.pct > best.pct ? e : best), estados[0]);
      const peor = estados.reduce((worst, e) => (e.pct < worst.pct ? e : worst), estados[0]);

      if (mejor.pct > 0) {
        cards.push(kpiCardHtml({
          title: 'Operatividad más alta',
          value: mejor.label,
          sub: `<span class="inline-flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap text-emerald-600 font-mono">${iconSvg('arrowUp')}<span>${mejor.pct.toFixed(0)}%</span></span>`,
          icon: iconSvg('arrowUp'),
          chipClass: 'bg-emerald-50 text-emerald-600'
        }));
      }
      if (peor.pct < 100) {
        cards.push(kpiCardHtml({
          title: 'Operatividad más baja',
          value: peor.label,
          sub: `<span class="inline-flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap text-red-600 font-mono">${iconSvg('arrowDown')}<span>${peor.pct.toFixed(0)}%</span></span>`,
          icon: iconSvg('arrowDown'),
          chipClass: 'bg-red-50 text-red-600'
        }));
      }
    }

    if (analysis.gpsCoverage) {
      const gps = analysis.gpsCoverage;
      cards.push(kpiCardHtml({
        title: 'Cobertura GPS',
        value: fmt.format(gps.yes),
        sub: `<span class="text-xs text-slate-500 whitespace-nowrap font-mono">de ${fmt.format(gps.yes + gps.no)} vehículos · ${gps.pct.toFixed(1)}%</span>`,
        icon: iconSvg('mapPin'),
        chipClass: 'bg-sky-50 text-sky-600'
      }));
    }

    byId('kpiCardsContainer').innerHTML = cards.join('');
  }

  function renderEstadoComparison(porEstado) {
    const items = porEstado || [];
    const box = byId('estadoChartBox');
    const empty = byId('estadoEmpty');
    if (!items.length) {
      box.classList.add('hidden');
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    box.classList.remove('hidden');
    FleetCharts.renderVBarStacked('estadoChartCanvas', items);
  }

  function legendHtml(items) {
    return items
      .map((item) => `
        <div class="flex items-center justify-between gap-3">
          <span class="flex items-center gap-1.5 text-sm text-slate-600 truncate">
            <span class="w-2.5 h-2.5 rounded-full inline-block shrink-0" style="background:${item.color}"></span>
            ${item.label}
          </span>
          <span class="font-mono text-sm text-slate-900">${fmt.format(item.count)}</span>
        </div>`)
      .join('');
  }

  function renderCompleteness(analysis) {
    const verified = analysis.verificado;
    const cards = [
      ['Registros leídos', fmt.format(analysis.total)],
      ['Filas válidas', fmt.format(analysis.valid)],
      ['Verificados', verified ? `${fmt.format(verified.yes)} (${verified.pct.toFixed(0)}%)` : '—']
    ];

    byId('completenessContainer').innerHTML = cards
      .map(([label, value]) => `
        <div class="w-1/2 sm:w-1/3 p-2">
        <div class="rounded-md border border-slate-200 bg-white p-4 flex flex-col gap-1 min-w-0 h-full">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">${label}</span>
          <span class="font-mono text-base font-medium text-slate-900 truncate" title="${value}">${value}</span>
        </div>
        </div>`)
      .join('');
  }

  function render(result) {
    const { analysis, file } = result;

    renderHero(analysis);
    renderStatusList(analysis.stats);
    renderKpiCards(analysis);
    renderEstadoComparison(analysis.porEstado);
    renderCompleteness(analysis);

    if (analysis.fuel && analysis.fuel.length > 0) {
      FleetCharts.renderDonut('fuelCanvas', analysis.fuel, analysis.total);
      const colors = FleetCharts.palette(analysis.fuel.length);
      byId('fuelLegend').innerHTML = legendHtml(analysis.fuel.map((f, i) => ({ label: f.label, count: f.count, color: colors[i] })));
    }
    if (analysis.gerencia && analysis.gerencia.length > 0) {
      FleetCharts.renderHBar('gerenciaCanvas', analysis.gerencia, '#0EA5E9');
    }

    byId('emptyState').classList.add('hidden');
    byId('reportArea').classList.remove('hidden');
    const ab = byId('actionButtons');
    ab.classList.remove('hidden');
    ab.classList.add('flex');
    byId('exportBtn').disabled = false;
    byId('imageBtn').disabled = false;
    byId('dropZone').classList.add('hidden');
    byId('dragHint').classList.remove('hidden');
    byId('fileName').textContent = file ? file.name : '—';
    byId('fileSize').textContent = file ? `· ${(file.size / 1024).toFixed(0)} KB` : '';

    clearStatus();
  }

  function showError(message) {
    clearStatus();
    byId('errorBox').textContent = message;
    byId('errorBox').classList.remove('hidden');
  }

  function clearError() {
    byId('errorBox').classList.add('hidden');
  }

  function reset() {
    FleetCharts.destroyAll();
    const actions = byId('actionButtons');
    if (actions) {
      actions.classList.add('hidden');
      actions.classList.remove('flex');
    }
  }

  return { render, showError, clearError, setStatus, clearStatus, reset };
})();
