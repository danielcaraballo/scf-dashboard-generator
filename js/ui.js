window.FleetUI = (function () {
  const fmt = new Intl.NumberFormat('es-MX');

  const escapeHtml = (FleetConfig && FleetConfig.escapeHtml) || function (str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const byId = (id) => document.getElementById(id);
  let lastResult = null;

  const ICONS = {
    arrowUp: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 19.5v-15m0 0l-6.75 6.75M12 4.5l6.75 6.75" />',
    arrowDown: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m0 0l6.75-6.75M12 19.5l-6.75-6.75" />',
    mapPin: '<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />',
    checkCircle: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
    wrench: '<path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.398-3.044 1.178l-7.34 7.34a2.25 2.25 0 01-3.182-3.182l7.34-7.34c.78-.78 1.269-1.968 1.178-3.044A4.5 4.5 0 0116.5 2.25h.75v3.75h3.75v.75z" />',
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

  function extractStates(rows, geoCol) {
    if (!geoCol || !rows || !rows.length) return [];
    const counts = {};
    for (const row of rows) {
      const val = row[geoCol];
      const norm = FleetConfig.normalize(val);
      if (!norm) continue;
      if (!counts[norm]) {
        const canon = FleetConfig.resolveStateName(norm);
        counts[norm] = { norm, label: canon || norm, count: 0 };
      }
      counts[norm].count++;
    }
    return Object.values(counts).sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  }

  function renderFilters(rawRows, cols, activeStateFilter, activeFleetOnly, analysis, baseRows, isSingleStateFile, targetStateName) {
    const filterBox = byId('filterBarBox');
    const select = byId('stateFilterSelect');
    const badge = byId('activeFilterBadge');
    const badgeText = byId('activeFilterText');
    const activeFleetBtn = byId('activeFleetBtn');
    const stateFilterGroup = byId('stateFilterGroup');
    const clearBtn = byId('clearFilterBtn');
    const singleStatePill = byId('singleStatePill');
    const singleStatePillText = byId('singleStatePillText');

    if (!filterBox) return;

    if (!rawRows || rawRows.length === 0) {
      filterBox.classList.add('hidden');
      return;
    }

    filterBox.classList.remove('hidden');

    const hasGeo = Boolean(cols && cols.geo);

    if (hasGeo) {
      if (isSingleStateFile) {
        if (stateFilterGroup) {
          stateFilterGroup.classList.add('hidden');
          stateFilterGroup.classList.remove('inline-flex');
        }
        if (singleStatePill) {
          singleStatePill.classList.remove('hidden');
          singleStatePill.classList.add('inline-flex');
          if (singleStatePillText) {
            singleStatePillText.textContent = `Entidad: ${targetStateName || 'Estadal'} (${fmt.format(rawRows.length)} veh.)`;
          }
        }
      } else {
        if (singleStatePill) {
          singleStatePill.classList.add('hidden');
          singleStatePill.classList.remove('inline-flex');
        }
        if (stateFilterGroup) {
          stateFilterGroup.classList.remove('hidden');
          stateFilterGroup.classList.add('inline-flex');
        }
        if (select) {
          const stateRows = (activeFleetOnly && baseRows) ? baseRows : rawRows;
          const states = extractStates(stateRows, cols.geo);
          const totalForSelect = stateRows.length;
          select.innerHTML = `<option value="">Todos los Estados (${fmt.format(totalForSelect)})</option>` +
            states.map((s) => `<option value="${escapeHtml(s.norm)}">${escapeHtml(s.label)} (${fmt.format(s.count)})</option>`).join('');
          select.value = activeStateFilter || '';
        }
      }
    } else {
      if (stateFilterGroup) {
        stateFilterGroup.classList.add('hidden');
        stateFilterGroup.classList.remove('inline-flex');
      }
      if (singleStatePill) {
        singleStatePill.classList.add('hidden');
        singleStatePill.classList.remove('inline-flex');
      }
    }

    if (activeFleetBtn) {
      activeFleetBtn.setAttribute('aria-pressed', activeFleetOnly ? 'true' : 'false');
      const svg = activeFleetBtn.querySelector('svg');
      const dot = byId('activeFleetDot');
      if (activeFleetOnly) {
        activeFleetBtn.className = 'inline-flex items-center justify-center gap-1.5 rounded-md border border-sky-500 bg-sky-500 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500/30 shadow-xs cursor-pointer transition-all dark:border-sky-500 dark:bg-sky-600 dark:hover:bg-sky-500 shrink-0';
        if (svg) svg.className = 'w-3.5 h-3.5 shrink-0 text-white transition-colors';
        if (dot) dot.classList.remove('hidden');
      } else {
        activeFleetBtn.className = 'inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 shadow-xs cursor-pointer transition-all dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shrink-0';
        if (svg) svg.className = 'w-3.5 h-3.5 shrink-0 text-slate-500 dark:text-slate-400 transition-colors';
        if (dot) dot.classList.add('hidden');
      }
    }

    const hasActiveFilter = isSingleStateFile ? activeFleetOnly : Boolean(activeStateFilter || activeFleetOnly);

    if (clearBtn) {
      if (hasActiveFilter) {
        clearBtn.classList.remove('hidden');
        clearBtn.classList.add('inline-flex');
      } else {
        clearBtn.classList.add('hidden');
        clearBtn.classList.remove('inline-flex');
      }
    }

    if (badge && badgeText) {
      const parts = [];
      if (!isSingleStateFile && activeStateFilter && hasGeo) {
        const label = FleetConfig.resolveStateName(activeStateFilter) || activeStateFilter;
        parts.push(`Estado ${label}`);
      }
      if (activeFleetOnly) {
        parts.push('Flota Activa');
      }

      if (parts.length > 0) {
        const prefix = parts.length > 1 ? 'Filtros: ' : 'Filtro: ';
        badgeText.textContent = prefix + parts.join(' · ');
        badge.classList.remove('hidden');
        badge.classList.add('inline-flex');
      } else {
        badge.classList.add('hidden');
        badge.classList.remove('inline-flex');
        badgeText.textContent = '';
      }
    }
  }

  function renderHero(analysis, activeStateFilter, activeFleetOnly, isSingleStateFile, targetStateName) {
    const operativos = statFor(analysis.stats, 'operativo');

    byId('heroTotal').textContent = fmt.format(analysis.total);
    const heroLabel = byId('heroTotalLabel');
    if (heroLabel) {
      const stateLabel = targetStateName || (activeStateFilter ? (FleetConfig.resolveStateName(activeStateFilter) || activeStateFilter) : '');
      if (activeFleetOnly && stateLabel) {
        heroLabel.textContent = `Flota activa en Estado ${stateLabel}`;
      } else if (activeFleetOnly) {
        heroLabel.textContent = 'Vehículos en flota activa';
      } else if (stateLabel) {
        heroLabel.textContent = `Vehículos en Estado ${stateLabel}`;
      } else {
        heroLabel.textContent = 'Vehículos registrados';
      }
    }

    const heroPctLabel = byId('heroPctLabel');
    if (heroPctLabel) {
      heroPctLabel.textContent = activeFleetOnly ? 'Operatividad flota activa' : 'Operatividad general';
    }

    byId('heroPct').textContent = `${analysis.rate.toFixed(1)}%`;
    byId('heroPct').style.color = '#0EA5E9';
    byId('heroBarBg').className = 'h-2 rounded-full overflow-hidden bg-sky-50 dark:bg-sky-500/15';
    byId('heroBar').style.width = `${Math.min(analysis.rate, 100)}%`;
    byId('heroBar').style.backgroundColor = '#0EA5E9';
    byId('heroOperativos').textContent = fmt.format(operativos ? operativos.count : 0);
    byId('heroInactivos').textContent = fmt.format(analysis.total - (operativos ? operativos.count : 0));
  }

  function renderStatusList(stats) {
    const validStats = stats
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);

    const isMultiCol = validStats.length >= 5;
    const statusList = byId('statusList');
    const countBadge = byId('statusCountBadge');

    if (countBadge) {
      countBadge.textContent = validStats.length > 0 ? `${validStats.length} estatus` : '';
    }

    if (isMultiCol) {
      statusList.className = 'flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 min-h-0 content-start';
    } else {
      statusList.className = 'flex-1 flex flex-col justify-start gap-2.5 sm:gap-3 min-h-0 pt-0.5';
    }

    statusList.innerHTML = validStats
      .map((s) => {
        const labelCls = isMultiCol
          ? 'flex-1 min-w-0 truncate'
          : 'w-28 sm:w-36 shrink-0 truncate';
        const barContainerCls = isMultiCol
          ? 'w-8 sm:w-10 shrink-0'
          : 'flex-1 min-w-[60px]';
        const barHeightCls = isMultiCol
          ? 'h-1.5'
          : 'h-2';

        return `
        <div class="flex items-center gap-2 sm:gap-2.5 text-xs sm:text-sm min-w-0">
          <div class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${s.color}"></div>
          <span class="text-slate-700 ${labelCls} font-medium dark:text-slate-200" title="${escapeHtml(s.label)}">${escapeHtml(s.label)}</span>
          <div class="flex items-center ${barContainerCls}">
            <div class="w-full ${barHeightCls} rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
              <div class="h-full rounded-full transition-all duration-300" style="width:${s.pct}%; background:${s.color}"></div>
            </div>
          </div>
          <span class="font-semibold text-slate-500 shrink-0 w-11 sm:w-12 text-right text-xs dark:text-slate-400">${s.pct.toFixed(1)}%</span>
          <span class="font-bold text-slate-800 shrink-0 w-10 sm:w-12 text-right min-w-[32px] text-xs sm:text-sm dark:text-slate-100">${fmt.format(s.count)}</span>
        </div>`;
      })
      .join('');

    const statusBar = byId('statusBar');
    const statusBarContainer = byId('statusBarContainer');
    if (statusBarContainer && statusBar) {
      if (validStats.length === 0) {
        statusBarContainer.classList.add('hidden');
        statusBar.style.background = '';
        statusBar.innerHTML = '';
      } else {
        statusBarContainer.classList.remove('hidden');
        const totalCount = validStats.reduce((acc, s) => acc + s.count, 0);
        let currentPct = 0;
        const stops = [];
        const hitboxes = validStats.map((s, idx) => {
          const widthPct = totalCount > 0 ? (s.count / totalCount) * 100 : 0;
          const start = currentPct;
          currentPct += widthPct;
          const end = idx === validStats.length - 1 ? 100 : currentPct;
          stops.push(`${s.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
          return `<div style="width:${widthPct}%;" class="h-full" title="${escapeHtml(s.label)}: ${s.pct.toFixed(1)}% (${fmt.format(s.count)})"></div>`;
        });

        statusBar.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
        statusBar.innerHTML = `<div class="flex w-full h-full">${hitboxes.join('')}</div>`;
      }
    }
  }

  function kpiCardHtml({ title, value, sub, icon, chipClass }) {
    const safeTitle = escapeHtml(title);
    const safeValue = escapeHtml(value);
    return `
      <div class="rounded-md border border-slate-300/80 bg-white p-4 sm:p-5 shadow-xs transition-all duration-150 hover:shadow-sm flex items-center justify-between gap-3 dark:border-slate-700 dark:bg-slate-800">
        <div class="flex flex-col gap-1 min-w-0 flex-1">
          <span class="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate dark:text-slate-400" title="${safeTitle}">${safeTitle}</span>
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
            <span class="text-base sm:text-xl font-bold leading-tight text-slate-900 break-words dark:text-slate-100" title="${safeValue}">${safeValue}</span>
            ${sub}
          </div>
        </div>
        <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${chipClass}">${icon}</div>
      </div>`;
  }

  function renderKpiCards(analysis, activeStateFilter, fullPorEstado, nationalRate, isSingleStateFile, targetStateName) {
    const cards = [];
    const isStateMode = Boolean(isSingleStateFile || activeStateFilter);

    if (!isStateMode) {
      const estados = (analysis.porEstado || []).filter((e) => e.total > 0);
      if (estados.length >= 2) {
        const mejor = estados.reduce((best, e) => (e.pct > best.pct ? e : best), estados[0]);
        const peor = estados.reduce((worst, e) => (e.pct < worst.pct ? e : worst), estados[0]);

        if (mejor.pct > 0) {
          cards.push(kpiCardHtml({
            title: 'Mayor operatividad',
            value: mejor.label,
            sub: `<span class="inline-flex items-center gap-0.5 text-xs font-bold whitespace-nowrap text-emerald-600 dark:text-emerald-400">${iconSvg('arrowUp')}<span>${mejor.pct.toFixed(0)}%</span></span>`,
            icon: iconSvg('arrowUp'),
            chipClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
          }));
        }
        if (peor.pct < 100) {
          cards.push(kpiCardHtml({
            title: 'Menor operatividad',
            value: peor.label,
            sub: `<span class="inline-flex items-center gap-0.5 text-xs font-bold whitespace-nowrap text-red-600 dark:text-red-400">${iconSvg('arrowDown')}<span>${peor.pct.toFixed(0)}%</span></span>`,
            icon: iconSvg('arrowDown'),
            chipClass: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400'
          }));
        }
      }
    } else {
      if (!isSingleStateFile && fullPorEstado && fullPorEstado.length > 1) {
        const sorted = [...fullPorEstado].sort((a, b) => b.pct - a.pct || b.total - a.total);
        const targetRaw = targetStateName || activeStateFilter;
        const canonActive = FleetConfig.resolveStateName(targetRaw);
        const normTarget = FleetConfig.normalize(targetRaw);
        const rankIdx = sorted.findIndex(
          (e) => (canonActive && FleetConfig.resolveStateName(e.label) === canonActive) || FleetConfig.normalize(e.label) === normTarget
        );
        if (rankIdx !== -1) {
          const rank = rankIdx + 1;
          const diff = analysis.rate - (nationalRate || 0);
          const isAbove = diff >= 0;
          cards.push(kpiCardHtml({
            title: 'Posición nacional',
            value: `#${rank} de ${sorted.length}`,
            sub: `<span class="inline-flex items-center gap-0.5 text-xs font-bold whitespace-nowrap ${isAbove ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">${isAbove ? iconSvg('arrowUp') : iconSvg('arrowDown')}<span>${isAbove ? '+' : ''}${diff.toFixed(1)}% vs promedio</span></span>`,
            icon: isAbove ? iconSvg('arrowUp') : iconSvg('arrowDown'),
            chipClass: isAbove ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
          }));
        }
      }

      if (cards.length === 0) {
        const counts = analysis.counts || {};
        const enRep = counts.en_reparacion || 0;
        const totalInactivos = analysis.total - (counts.operativo || 0);
        const pctRecup = totalInactivos > 0 ? (enRep / totalInactivos) * 100 : 0;
        cards.push(kpiCardHtml({
          title: 'Flota en recuperación',
          value: `${pctRecup.toFixed(1)}%`,
          sub: `<span class="text-xs text-slate-500 whitespace-nowrap font-medium dark:text-slate-400">de la flota inactiva fuera de servicio</span>`,
          icon: iconSvg('wrench'),
          chipClass: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
        }));
      }

      if (analysis.clase && analysis.clase.length > 0) {
        const topClase = analysis.clase[0];
        const upperLabel = escapeHtml(String(topClase.label || '').toUpperCase());
        cards.push(kpiCardHtml({
          title: 'Tipo principal',
          value: upperLabel,
          sub: `<span class="text-xs text-slate-500 whitespace-nowrap font-medium dark:text-slate-400">${fmt.format(topClase.count)} de ${fmt.format(analysis.total)} vehículos · ${topClase.pct.toFixed(1)}%</span>`,
          icon: iconSvg('truck'),
          chipClass: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400'
        }));
      } else if (analysis.stateDiagnostic && (analysis.stateDiagnostic.topTipos || analysis.stateDiagnostic.topModelos) && (analysis.stateDiagnostic.topTipos || analysis.stateDiagnostic.topModelos).length > 0) {
        const topItem = (analysis.stateDiagnostic.topTipos || analysis.stateDiagnostic.topModelos)[0];
        const upperLabel = escapeHtml(String(topItem.label || '').toUpperCase());
        cards.push(kpiCardHtml({
          title: 'Tipo principal',
          value: upperLabel,
          sub: `<span class="text-xs text-slate-500 whitespace-nowrap font-medium dark:text-slate-400">${fmt.format(topItem.count)} de ${fmt.format(analysis.total)} vehículos · ${topItem.pct.toFixed(1)}%</span>`,
          icon: iconSvg('truck'),
          chipClass: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400'
        }));
      } else if (analysis.verificado) {
        const v = analysis.verificado;
        cards.push(kpiCardHtml({
          title: 'Datos verificados',
          value: fmt.format(v.yes),
          sub: `<span class="text-xs text-slate-500 whitespace-nowrap font-medium dark:text-slate-400">de ${fmt.format(v.yes + v.no)} vehículos · ${v.pct.toFixed(1)}%</span>`,
          icon: iconSvg('checkCircle'),
          chipClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
        }));
      }
    }

    if (analysis.gpsCoverage) {
      const gps = analysis.gpsCoverage;
      cards.push(kpiCardHtml({
        title: 'Cobertura GPS',
        value: fmt.format(gps.yes),
        sub: `<span class="text-xs text-slate-500 whitespace-nowrap font-medium dark:text-slate-400">de ${fmt.format(gps.yes + gps.no)} vehículos · ${gps.pct.toFixed(1)}%</span>`,
        icon: iconSvg('mapPin'),
        chipClass: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400'
      }));
    } else if (analysis.verificado) {
      const v = analysis.verificado;
      cards.push(kpiCardHtml({
        title: 'Datos verificados',
        value: fmt.format(v.yes),
        sub: `<span class="text-xs text-slate-500 whitespace-nowrap font-medium dark:text-slate-400">de ${fmt.format(v.yes + v.no)} vehículos · ${v.pct.toFixed(1)}%</span>`,
        icon: iconSvg('checkCircle'),
        chipClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
      }));
    }

    if (cards.length < 3) {
      const activeTotal = analysis.activeFleet ? analysis.activeFleet.total : 0;
      cards.push(kpiCardHtml({
        title: 'Flota activa',
        value: fmt.format(activeTotal),
        sub: `<span class="text-xs text-slate-500 whitespace-nowrap font-medium dark:text-slate-400">${analysis.total ? ((activeTotal / analysis.total) * 100).toFixed(1) : '0'}% del parque automotor</span>`,
        icon: iconSvg('truck'),
        chipClass: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300'
      }));
    }

    byId('kpiCardsContainer').innerHTML = cards.slice(0, 3).join('');
  }

  let activeStateTab = 'tipo';

  function renderStateTopList(analysis) {
    const diag = (analysis && analysis.stateDiagnostic) || {};
    const isTipo = activeStateTab === 'tipo';
    const items = isTipo ? (diag.topTipos || []) : (diag.topModelos || []);

    const tipoBtn = byId('stateTabTipoBtn');
    const modeloBtn = byId('stateTabModeloBtn');
    if (tipoBtn && modeloBtn) {
      if (isTipo) {
        tipoBtn.setAttribute('aria-selected', 'true');
        tipoBtn.className = 'px-2.5 py-1 text-xs font-semibold rounded-md transition-all text-slate-900 bg-white shadow-xs dark:bg-slate-700 dark:text-slate-100 cursor-pointer';
        modeloBtn.setAttribute('aria-selected', 'false');
        modeloBtn.className = 'px-2.5 py-1 text-xs font-semibold rounded-md transition-all text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer';
      } else {
        modeloBtn.setAttribute('aria-selected', 'true');
        modeloBtn.className = 'px-2.5 py-1 text-xs font-semibold rounded-md transition-all text-slate-900 bg-white shadow-xs dark:bg-slate-700 dark:text-slate-100 cursor-pointer';
        tipoBtn.setAttribute('aria-selected', 'false');
        tipoBtn.className = 'px-2.5 py-1 text-xs font-semibold rounded-md transition-all text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer';
      }
    }

    const badge = byId('stateModelsTotalBadge');
    if (badge) {
      const unitLabel = isTipo ? 'tipos principales' : 'modelos principales';
      badge.textContent = items.length > 0 ? `${items.length} ${unitLabel}` : '';
    }

    const modelsList = byId('stateTopModelsList');
    if (modelsList) {
      if (items.length > 0) {
        modelsList.innerHTML = items.map((m, idx) => {
          const upperLabel = escapeHtml(String(m.label || '').toUpperCase());
          const isOther = upperLabel.startsWith('OTRA') || upperLabel.startsWith('OTRO');
          const barColor = isOther ? 'bg-slate-400 dark:bg-slate-500' : 'bg-sky-500';
          const labelColor = isOther ? 'text-slate-600 dark:text-slate-300 font-medium italic' : 'text-slate-800 dark:text-slate-200 font-semibold';
          return `
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs font-medium">
                <span class="truncate ${labelColor}" title="${upperLabel}">
                  <span class="text-slate-400 font-mono text-[11px] mr-1.5 font-normal">#${idx + 1}</span>${upperLabel}
                </span>
                <span class="text-slate-900 dark:text-slate-100 font-bold ml-2 shrink-0">${fmt.format(m.count)} <span class="text-slate-400 font-normal text-[11px]">(${m.pct.toFixed(1)}%)</span></span>
              </div>
              <div class="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700/50 overflow-hidden">
                <div class="h-full rounded-full ${barColor} transition-all duration-300" style="width: ${Math.min(m.pct, 100)}%"></div>
              </div>
            </div>
          `;
        }).join('');
      } else {
        const emptyMsg = isTipo
          ? 'No se detectaron datos de denominación o tipo de vehículo en los registros.'
          : 'No se detectaron datos de marca o modelo en los registros.';
        modelsList.innerHTML = `<div class="text-xs text-slate-400 py-6 text-center">${emptyMsg}</div>`;
      }
    }
  }

  function setStateTab(tab) {
    if (activeStateTab === tab) return;
    activeStateTab = tab;
    if (lastResult && lastResult.analysis) {
      renderStateTopList(lastResult.analysis);
    }
  }

  function renderMapSection(porEstado, fullPorEstado, isStateMode, targetStateName, analysis) {
    const mapContainer = byId('mapSectionContainer');
    if (!mapContainer) return;

    const items = fullPorEstado || porEstado || [];
    const hasValidStates = items.some((e) => Boolean(FleetConfig.resolveStateName(e.label)));
    if (!items.length || !hasValidStates) {
      mapContainer.classList.add('hidden');
      return;
    }

    mapContainer.classList.remove('hidden');

    const cardTitle = byId('mapCardTitle');
    const nationalBody = byId('nationalMapBody');
    const stateBody = byId('stateFocusBody');
    const fsWrapper = byId('mapFullscreenWrapper');

    if (isStateMode) {
      if (nationalBody) nationalBody.classList.add('hidden');
      if (stateBody) {
        stateBody.classList.remove('hidden');
        stateBody.classList.add('grid');
      }
      if (cardTitle) {
        cardTitle.textContent = `Composición del Parque Automotor · Estado ${targetStateName || 'Seleccionado'}`;
      }
      if (fsWrapper) fsWrapper.classList.add('hidden');

      renderStateTopList(analysis);

      if (window.FleetMap && FleetMap.renderMiniMap) {
        FleetMap.renderMiniMap('stateMiniMapBox', targetStateName, items);
      }
    } else {
      if (nationalBody) nationalBody.classList.remove('hidden');
      if (stateBody) {
        stateBody.classList.add('hidden');
        stateBody.classList.remove('grid');
      }
      if (cardTitle) {
        cardTitle.textContent = 'Mapa de operatividad por estado';
      }
      if (fsWrapper) fsWrapper.classList.remove('hidden');

      if (window.FleetMap) {
        FleetMap.render(items, targetStateName || null);
      }
    }
  }

  function legendHtml(items) {
    return items
      .map((item) => `
        <div class="flex items-center justify-between gap-3 text-xs sm:text-sm">
          <span class="flex items-center gap-1.5 text-slate-600 min-w-0 truncate dark:text-slate-300">
            <span class="w-2.5 h-2.5 rounded-full inline-block shrink-0" style="background:${escapeHtml(item.color)}"></span>
            <span class="truncate" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
          </span>
          <span class="font-semibold text-slate-900 shrink-0 ml-2 dark:text-slate-100">${fmt.format(item.count)}</span>
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
      const names = coverage.missingColumns.map((c) => escapeHtml(c.label)).join(', ');
      messages.push(`<div class="flex items-start gap-2">
        <svg class="w-5 h-5 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 zm-9-3.75h.008v.008H12v-.008z" /></svg>
        <span><strong>Análisis parcial (${coverage.detectedCount}/6 dimensiones):</strong> No se detectaron datos para <em>${names}</em>. El tablero se adaptó para mostrar los indicadores disponibles.</span>
      </div>`);
    }

    if (coverage.unclassifiedPct > 5) {
      messages.push(`<div class="flex items-start gap-2 ${messages.length ? 'mt-2 pt-2 border-t border-amber-200 dark:border-amber-900/50' : ''}">
        <svg class="w-5 h-5 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" /></svg>
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
      const colors = FleetCharts.fuelColors ? FleetCharts.fuelColors(fuel) : FleetCharts.palette(fuel.length);
      FleetCharts.renderDonut('fuelCanvas', fuel, totalFuel, { colors });
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

  function render(result) {
    lastResult = result;
    const {
      analysis,
      file,
      activeStateFilter,
      activeFleetOnly,
      rawRows,
      baseRows,
      cols,
      fullPorEstado,
      nationalRate,
      nationalTotal,
      isSingleStateFile,
      isStateMode,
      targetStateName
    } = result;

    renderFilters(rawRows, cols, activeStateFilter, activeFleetOnly, analysis, baseRows, isSingleStateFile, targetStateName);
    renderQualityBanner(analysis.coverage);
    renderHero(analysis, activeStateFilter, activeFleetOnly, isSingleStateFile, targetStateName);
    renderStatusList(analysis.stats);
    renderKpiCards(analysis, activeStateFilter, fullPorEstado, nationalRate, isSingleStateFile, targetStateName);
    renderMapSection(analysis.porEstado, fullPorEstado, isStateMode, targetStateName, analysis);
    renderFuelSection(analysis.fuel);
    renderClaseSection(analysis.clase);

    byId('emptyState').classList.add('hidden');
    byId('reportArea').classList.remove('hidden');
    const ab = byId('actionButtons');
    ab.classList.remove('hidden');
    ab.classList.add('flex');
    byId('exportBtn').disabled = false;
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
    const reportArea = byId('reportArea');
    if (reportArea) reportArea.classList.add('hidden');
    const emptyState = byId('emptyState');
    if (emptyState) emptyState.classList.remove('hidden');
    const qualityBox = byId('qualityBannerBox');
    if (qualityBox) qualityBox.classList.add('hidden');
    const filterBox = byId('filterBarBox');
    if (filterBox) filterBox.classList.add('hidden');
    const singlePill = byId('singleStatePill');
    if (singlePill) {
      singlePill.classList.add('hidden');
      singlePill.classList.remove('inline-flex');
    }
    const natBody = byId('nationalMapBody');
    if (natBody) natBody.classList.remove('hidden');
    const stBody = byId('stateFocusBody');
    if (stBody) {
      stBody.classList.add('hidden');
      stBody.classList.remove('grid');
    }
    const cardTitle = byId('mapCardTitle');
    if (cardTitle) cardTitle.textContent = 'Mapa de operatividad por estado';
    if (window.FleetMap && FleetMap.clearSelection) {
      FleetMap.clearSelection();
    }
    const fsWrapper = byId('mapFullscreenWrapper');
    if (fsWrapper) fsWrapper.classList.remove('hidden');
    const miniBox = byId('stateMiniMapBox');
    if (miniBox) miniBox.innerHTML = '';
    const topModelsList = byId('stateTopModelsList');
    if (topModelsList) topModelsList.innerHTML = '';
    const activeFleetBtn = byId('activeFleetBtn');
    if (activeFleetBtn) {
      activeFleetBtn.setAttribute('aria-pressed', 'false');
      activeFleetBtn.className = 'inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 shadow-xs cursor-pointer transition-all dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shrink-0';
      const svg = activeFleetBtn.querySelector('svg');
      if (svg) svg.className = 'w-3.5 h-3.5 shrink-0 text-slate-500 dark:text-slate-400 transition-colors';
      const dot = byId('activeFleetDot');
      if (dot) dot.classList.add('hidden');
    }
    const select = byId('stateFilterSelect');
    if (select) select.value = '';
    const badge = byId('activeFilterBadge');
    if (badge) {
      badge.classList.add('hidden');
      badge.classList.remove('inline-flex');
    }
    const clearBtn = byId('clearFilterBtn');
    if (clearBtn) {
      clearBtn.classList.add('hidden');
      clearBtn.classList.remove('inline-flex');
    }
    const countBadge = byId('statusCountBadge');
    if (countBadge) countBadge.textContent = '';
    const statusList = byId('statusList');
    if (statusList) statusList.innerHTML = '';
    const statusBar = byId('statusBar');
    if (statusBar) {
      statusBar.style.background = '';
      statusBar.innerHTML = '';
    }
    const statusBarContainer = byId('statusBarContainer');
    if (statusBarContainer) statusBarContainer.classList.add('hidden');
    activeStateTab = 'tipo';
    clearError();
  }

  function refresh() {
    if (!lastResult) return;
    render(lastResult);
  }

  function getLastResult() {
    return lastResult;
  }

  return { render, refresh, getLastResult, showError, clearError, setStatus, clearStatus, reset, setStateTab };
})();
