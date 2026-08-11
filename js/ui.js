window.FleetUI = (function () {
  const fmt = new Intl.NumberFormat('es-MX');

  const byId = (id) => document.getElementById(id);

  const ICONS = {
    arrowUp: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 19.5v-15m0 0l-6.75 6.75M12 4.5l6.75 6.75" />',
    arrowDown: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m0 0l6.75-6.75M12 19.5l-6.75-6.75" />',
    mapPin: '<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />',
    checkCircle: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
    fire: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />',
    truck: '<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.25v11.25m0-11.25h-9.75A1.125 1.125 0 003.375 8.625v5.625" />'
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

  function extractStates(rows, geoCol) {
    if (!geoCol || !rows || !rows.length) return [];
    const counts = {};
    for (const row of rows) {
      const val = row[geoCol];
      const norm = FleetConfig.normalize(val);
      if (!norm) continue;
      if (!counts[norm]) {
        counts[norm] = { norm, label: norm, count: 0 };
      }
      counts[norm].count++;
    }
    return Object.values(counts).sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  }

  function renderStateFilter(rawRows, cols, activeStateFilter) {
    const filterBox = byId('filterBarBox');
    const select = byId('stateFilterSelect');
    const badge = byId('activeFilterBadge');
    const badgeText = byId('activeFilterText');

    if (!filterBox || !select) return;

    if (!cols || !cols.geo || !rawRows || rawRows.length === 0) {
      filterBox.classList.add('hidden');
      return;
    }

    const states = extractStates(rawRows, cols.geo);
    if (states.length === 0) {
      filterBox.classList.add('hidden');
      return;
    }

    filterBox.classList.remove('hidden');

    const expectedOptionCount = states.length + 1;
    if (select.options.length !== expectedOptionCount) {
      select.innerHTML = `<option value="">Todos los Estados</option>` +
        states.map((s) => `<option value="${s.norm}">${s.label}</option>`).join('');
    }

    select.value = activeStateFilter || '';

    if (activeStateFilter) {
      const activeState = states.find((s) => s.norm === activeStateFilter);
      const label = activeState ? activeState.label : activeStateFilter;
      const count = activeState ? activeState.count : 0;
      badgeText.textContent = `Filtro: Estado ${label}`;
      badge.classList.remove('hidden');
      badge.classList.add('inline-flex');
    } else {
      badge.classList.add('hidden');
      badge.classList.remove('inline-flex');
    }
  }

  function renderHero(analysis, activeStateFilter) {
    const tone = pctTone(analysis.rate);
    const operativos = statFor(analysis.stats, 'operativo');

    byId('heroTotal').textContent = fmt.format(analysis.total);
    const heroLabel = byId('heroTotalLabel');
    if (heroLabel) {
      heroLabel.textContent = activeStateFilter ? `Vehículos en Estado ${activeStateFilter}` : 'Vehículos registrados';
    }
    byId('heroPct').textContent = `${analysis.rate.toFixed(1)}%`;
    byId('heroPct').style.color = '#0EA5E9';
    byId('heroBarBg').className = 'h-2 rounded-full overflow-hidden bg-sky-50';
    byId('heroBar').style.width = `${Math.min(analysis.rate, 100)}%`;
    byId('heroBar').style.backgroundColor = '#0EA5E9';
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
          <span class="text-xs sm:text-sm font-semibold text-slate-500 shrink-0 w-11 sm:w-14 text-right">${s.pct.toFixed(1)}%</span>
          <span class="text-xs sm:text-sm font-bold text-slate-800 shrink-0 w-8 sm:w-10 text-right">${fmt.format(s.count)}</span>
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

  function renderKpiCards(analysis, activeStateFilter) {
    const cards = [];
    const estados = (analysis.porEstado || []).filter((e) => e.total > 0);

    if (!activeStateFilter && estados.length >= 2) {
      const mejor = estados.reduce((best, e) => (e.pct > best.pct ? e : best), estados[0]);
      const peor = estados.reduce((worst, e) => (e.pct < worst.pct ? e : worst), estados[0]);

      if (mejor.pct > 0) {
        cards.push(kpiCardHtml({
          title: 'Mayor operatividad',
          value: mejor.label,
          sub: `<span class="inline-flex items-center gap-0.5 text-xs font-bold whitespace-nowrap text-emerald-600">${iconSvg('arrowUp')}<span>${mejor.pct.toFixed(0)}%</span></span>`,
          icon: iconSvg('arrowUp'),
          chipClass: 'bg-emerald-50 text-emerald-600'
        }));
      }
      if (peor.pct < 100) {
        cards.push(kpiCardHtml({
          title: 'Menor operatividad',
          value: peor.label,
          sub: `<span class="inline-flex items-center gap-0.5 text-xs font-bold whitespace-nowrap text-red-600">${iconSvg('arrowDown')}<span>${peor.pct.toFixed(0)}%</span></span>`,
          icon: iconSvg('arrowDown'),
          chipClass: 'bg-red-50 text-red-600'
        }));
      }
    } else if (activeStateFilter) {
      if (analysis.fuel && analysis.fuel.length > 0) {
        const topFuel = analysis.fuel[0];
        cards.push(kpiCardHtml({
          title: 'Combustible principal',
          value: topFuel.label,
          sub: `<span class="text-xs text-slate-500 whitespace-nowrap font-medium">${fmt.format(topFuel.count)} de ${fmt.format(analysis.total)} vhs · ${topFuel.pct.toFixed(1)}%</span>`,
          icon: iconSvg('fire'),
          chipClass: 'bg-amber-50 text-amber-600'
        }));
      }

      if (analysis.clase && analysis.clase.length > 0) {
        const topClase = analysis.clase[0];
        cards.push(kpiCardHtml({
          title: 'Clase principal',
          value: topClase.label,
          sub: `<span class="text-xs text-slate-500 whitespace-nowrap font-medium">${fmt.format(topClase.count)} de ${fmt.format(analysis.total)} vhs · ${topClase.pct.toFixed(1)}%</span>`,
          icon: iconSvg('truck'),
          chipClass: 'bg-indigo-50 text-indigo-600'
        }));
      } else if (analysis.verificado) {
        const v = analysis.verificado;
        cards.push(kpiCardHtml({
          title: 'Datos verificados',
          value: fmt.format(v.yes),
          sub: `<span class="text-xs text-slate-500 whitespace-nowrap font-medium">de ${fmt.format(v.yes + v.no)} vehículos · ${v.pct.toFixed(1)}%</span>`,
          icon: iconSvg('checkCircle'),
          chipClass: 'bg-emerald-50 text-emerald-600'
        }));
      }
    }

    if (analysis.gpsCoverage) {
      const gps = analysis.gpsCoverage;
      cards.push(kpiCardHtml({
        title: 'Cobertura GPS',
        value: fmt.format(gps.yes),
        sub: `<span class="text-xs text-slate-500 whitespace-nowrap font-medium">de ${fmt.format(gps.yes + gps.no)} vehículos · ${gps.pct.toFixed(1)}%</span>`,
        icon: iconSvg('mapPin'),
        chipClass: 'bg-sky-50 text-sky-600'
      }));
    }

    byId('kpiCardsContainer').innerHTML = cards.join('');
  }

  function renderEstadoComparison(porEstado, activeStateFilter) {
    const sectionContainer = byId('estadoSectionContainer');
    if (activeStateFilter) {
      if (sectionContainer) sectionContainer.classList.add('hidden');
      return;
    }
    if (sectionContainer) sectionContainer.classList.remove('hidden');

    const items = porEstado || [];
    const box = byId('estadoChartBox');
    const empty = byId('estadoEmpty');
    const legend = byId('estadoLegend');

    if (!items.length) {
      if (box) box.classList.add('hidden');
      if (legend) legend.classList.add('hidden');
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');
    if (box) box.classList.remove('hidden');
    if (legend) legend.classList.remove('hidden');

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
          <span class="text-sm font-semibold text-slate-900">${fmt.format(item.count)}</span>
        </div>`)
      .join('');
  }

  function renderQualityBanner(coverage) {
    const box = byId('qualityBannerBox');
    if (!box) return;
    if (!coverage) {
      box.classList.add('hidden');
      return;
    }
    const messages = [];

    if (coverage.missingColumns && coverage.missingColumns.length > 0) {
      const names = coverage.missingColumns.map((c) => c.label).join(', ');
      messages.push(`<div class="flex items-start gap-2">
        <svg class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 zm-9-3.75h.008v.008H12v-.008z" /></svg>
        <span><strong>Análisis parcial (${coverage.detectedCount}/6 dimensiones):</strong> No se detectaron datos para <em>${names}</em>. El tablero se adaptó para mostrar los indicadores disponibles.</span>
      </div>`);
    }

    if (coverage.unclassifiedPct > 5) {
      messages.push(`<div class="flex items-start gap-2 ${messages.length ? 'mt-2 pt-2 border-t border-amber-200' : ''}">
        <svg class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" /></svg>
        <span><strong>Datos sin clasificar:</strong> ${fmt.format(coverage.unclassifiedCount)} registros (${coverage.unclassifiedPct.toFixed(1)}%) contienen un estatus no reconocido por el sistema.</span>
      </div>`);
    }

    if (messages.length > 0) {
      box.innerHTML = messages.join('');
      box.classList.remove('hidden');
    } else {
      box.classList.add('hidden');
      box.innerHTML = '';
    }
  }

  function renderFuelSection(fuel) {
    const box = byId('fuelBox');
    const empty = byId('fuelEmpty');
    if (fuel && fuel.length > 0) {
      box.classList.remove('hidden');
      empty.classList.add('hidden');
      const totalFuel = fuel.reduce((s, i) => s + i.count, 0);
      FleetCharts.renderDonut('fuelCanvas', fuel, totalFuel);
      const colors = FleetCharts.palette(fuel.length);
      byId('fuelLegend').innerHTML = legendHtml(fuel.map((f, i) => ({ label: f.label, count: f.count, color: colors[i] })));
    } else {
      box.classList.add('hidden');
      empty.classList.remove('hidden');
    }
  }

  function renderClaseSection(clase) {
    const box = byId('claseBox');
    const empty = byId('claseEmpty');
    if (clase && clase.length > 0) {
      box.classList.remove('hidden');
      empty.classList.add('hidden');
      FleetCharts.renderHBar('claseCanvas', clase, '#0EA5E9');
    } else {
      box.classList.add('hidden');
      empty.classList.remove('hidden');
    }
  }

  function renderCompleteness(analysis) {
    const verified = analysis.verificado;
    const geoCount = analysis.porEstado ? analysis.porEstado.length : 0;

    const cards = [
      ['Total registros', fmt.format(analysis.total)],
      ['Vehículos verificados', verified ? `${fmt.format(verified.yes)} (${verified.pct.toFixed(0)}%)` : 'Sin datos'],
      ['Estados cubiertos', geoCount ? fmt.format(geoCount) : 'Sin datos']
    ];

    byId('completenessContainer').innerHTML = cards
      .map(([label, value]) => `
        <div class="w-full sm:w-1/3 p-2">
        <div class="rounded-md border border-slate-200 bg-white p-3 flex flex-col gap-1 min-w-0 h-full">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate" title="${label}">${label}</span>
          <span class="text-sm sm:text-base font-bold text-slate-900 truncate" title="${value}">${value}</span>
        </div>
        </div>`)
      .join('');
  }

  function render(result) {
    const { analysis, file, activeStateFilter, rawRows, cols } = result;

    renderStateFilter(rawRows, cols, activeStateFilter);
    renderQualityBanner(analysis.coverage);
    renderHero(analysis, activeStateFilter);
    renderStatusList(analysis.stats);
    renderKpiCards(analysis, activeStateFilter);
    renderEstadoComparison(analysis.porEstado, activeStateFilter);
    renderFuelSection(analysis.fuel);
    renderClaseSection(analysis.clase);
    renderCompleteness(analysis);

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
