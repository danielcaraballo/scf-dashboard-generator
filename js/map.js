window.FleetMap = (function () {
  const COLORS = { high: '#10B981', mid: '#F59E0B', low: '#EF4444' };

  const byId = (id) => document.getElementById(id);
  const escapeHtml =
    (window.FleetConfig && FleetConfig.escapeHtml) ||
    ((s) => String(s ?? ''));

  function fmt(n) {
    return new Intl.NumberFormat('es-MX').format(n);
  }

  function getSvgText() {
    if (!window.FleetMapData) {
      throw new Error('FleetMapData no está disponible');
    }
    return window.FleetMapData;
  }

  function toneFor(pct) {
    if (pct >= 80) return COLORS.high;
    if (pct >= 50) return COLORS.mid;
    return COLORS.low;
  }

  let currentTagMode = 'none';
  let activeStateName = null;
  let cachedDataMap = null;
  let cachedLastResult = null;
  let eventsBound = false;

  function buildDataMap(porEstado) {
    const map = {};
    (porEstado || []).forEach((e) => {
      const canonical = FleetConfig.resolveStateName(e.label);
      if (!canonical) return;
      if (!map[canonical] || e.total > map[canonical].total) {
        map[canonical] = e;
      }
    });
    return map;
  }

  function tooltipHtml(name, d) {
    const tone = toneFor(d.pct);
    const select = byId('stateFilterSelect');
    const isFiltered = select && select.value && (
      FleetConfig.resolveStateName(select.value) === name ||
      FleetConfig.normalize(select.value) === FleetConfig.normalize(name)
    );

    const actionText = isFiltered
      ? '<span class="text-amber-600 dark:text-amber-400 font-semibold">Clic para quitar filtro &times;</span>'
      : '<span class="text-sky-600 dark:text-sky-400 font-semibold">Clic para filtrar por este estado &rarr;</span>';

    return `
      <div class="font-bold text-slate-900 dark:text-slate-100 text-xs mb-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
        <span>${escapeHtml(name)}</span>
        <span class="w-2.5 h-2.5 rounded-full inline-block shrink-0" style="background:${tone}"></span>
      </div>
      <div class="space-y-1 text-[11px] leading-tight">
        <div class="flex items-center justify-between gap-3 text-slate-700 dark:text-slate-300 font-medium">
          <span>Operatividad:</span>
          <strong class="font-mono font-bold" style="color:${tone}">${d.pct.toFixed(1)}%</strong>
        </div>
        <div class="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400">
          <span>Unidades:</span>
          <span class="font-mono font-semibold text-slate-800 dark:text-slate-200">${fmt(d.operativos)} op. / ${fmt(d.total)} total</span>
        </div>
        <div class="text-[10px] pt-1 text-right">
          ${actionText}
        </div>
      </div>`;
  }

  function showTooltip(ev, name, d) {
    const tooltipEl = byId('mapTooltip');
    const wrapper = byId('mapVzWrapper');
    if (!tooltipEl || !wrapper) return;

    tooltipEl.innerHTML = tooltipHtml(name, d);
    tooltipEl.classList.remove('hidden');
    moveTooltip(ev);
    highlightState(name, true);
  }

  function moveTooltip(ev) {
    const tooltipEl = byId('mapTooltip');
    const wrapper = byId('mapVzWrapper');
    if (!tooltipEl || !wrapper || tooltipEl.classList.contains('hidden')) return;

    const rect = wrapper.getBoundingClientRect();
    let x = ev.clientX - rect.left + 14;
    let y = ev.clientY - rect.top + 14;
    const tw = tooltipEl.offsetWidth;
    const th = tooltipEl.offsetHeight;
    if (x + tw > rect.width - 8) x = ev.clientX - rect.left - tw - 14;
    if (y + th > rect.height - 8) y = ev.clientY - rect.top - th - 14;
    tooltipEl.style.left = `${Math.max(8, x)}px`;
    tooltipEl.style.top = `${Math.max(8, y)}px`;
  }

  function hideTooltip(name) {
    const tooltipEl = byId('mapTooltip');
    if (tooltipEl) tooltipEl.classList.add('hidden');
    if (name) {
      highlightState(name, false);
    } else {
      document.querySelectorAll('.vz-state, .state-badge').forEach((el) => {
        el.classList.remove('is-hovered');
      });
    }
  }

  function highlightState(name, isHovered) {
    const paths = document.querySelectorAll(`.vz-state[data-canon="${name}"]`);
    const badges = document.querySelectorAll(`.state-badge[data-canon="${name}"]`);
    paths.forEach((p) => {
      if (isHovered) p.classList.add('is-hovered');
      else p.classList.remove('is-hovered');
    });
    badges.forEach((b) => {
      if (isHovered) b.classList.add('is-hovered');
      else b.classList.remove('is-hovered');
    });
  }

  function toggleStateFilter(canonicalName) {
    if (!canonicalName) return;
    const select = byId('stateFilterSelect');
    if (!select) return;

    hideTooltip();

    const isCurrentlyFiltered = select.value && (
      FleetConfig.resolveStateName(select.value) === canonicalName ||
      FleetConfig.normalize(select.value) === FleetConfig.normalize(canonicalName)
    );

    if (isCurrentlyFiltered) {
      select.value = '';
      select.dispatchEvent(new Event('change'));
    } else {
      const opt = Array.from(select.options).find((o) =>
        o.value && (
          FleetConfig.resolveStateName(o.value) === canonicalName ||
          FleetConfig.normalize(o.value) === FleetConfig.normalize(canonicalName)
        )
      );
      if (opt) {
        select.value = opt.value;
        select.dispatchEvent(new Event('change'));
      }
    }
  }

  function setTagMode(mode) {
    currentTagMode = mode;
    const btnNone = byId('mapTagModeNone');
    const btnPct = byId('mapTagModePct');
    const btnVeh = byId('mapTagModeVeh');

    const activeClass = 'px-2 py-1 rounded-md text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 font-semibold shadow-xs transition-all touch-manipulation';
    const inactiveClass = 'px-2 py-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition-all touch-manipulation';

    if (btnNone) btnNone.className = mode === 'none' ? activeClass : inactiveClass;
    if (btnPct) btnPct.className = mode === 'pct' ? activeClass : inactiveClass;
    if (btnVeh) btnVeh.className = mode === 'veh' ? activeClass : inactiveClass;

    const badgesGroup = byId('badgesGroup');
    const leaderLinesGroup = byId('leaderLinesGroup');

    if (!badgesGroup || !leaderLinesGroup) return;

    if (mode === 'none') {
      badgesGroup.style.opacity = '0';
      badgesGroup.style.pointerEvents = 'none';
      leaderLinesGroup.style.opacity = '0';
      leaderLinesGroup.style.pointerEvents = 'none';
    } else {
      updateBadgesDisplay(mode);
      badgesGroup.style.opacity = '1';
      badgesGroup.style.pointerEvents = 'auto';
      leaderLinesGroup.style.opacity = '1';
      leaderLinesGroup.style.pointerEvents = 'auto';
    }
  }

  function updateBadgesDisplay(mode) {
    if (!cachedDataMap) return;
    const isDark = document.documentElement.classList.contains('dark');
    document.querySelectorAll('.state-badge').forEach((badge) => {
      const canon = FleetConfig.resolveStateName(badge.getAttribute('data-canon'));
      const d = canon ? cachedDataMap[canon] : null;
      const tspan = badge.querySelector('.badge-val-tspan');
      if (tspan) {
        if (d) {
          const tone = toneFor(d.pct);
          tspan.setAttribute('fill', tone);
          if (mode === 'veh') {
            tspan.textContent = `${fmt(d.total)} ${d.total === 1 ? 'vehículo' : 'vehículos'}`;
          } else {
            tspan.textContent = `${d.pct.toFixed(0)}% Op.`;
          }
        } else {
          tspan.setAttribute('fill', isDark ? '#64748B' : '#94A3B8');
          tspan.textContent = 'Sin datos';
        }
      }
    });
  }

  function exportPng() {
    const svg = byId('venezuelaMapSvg') || document.querySelector('#mapVzBox svg');
    if (!svg) return;

    const svgClone = svg.cloneNode(true);
    const width = 1908;
    const height = 1590;
    svgClone.setAttribute('width', width);
    svgClone.setAttribute('height', height);

    svgClone.querySelectorAll('.state-badge').forEach((b) => {
      const rect = b.querySelector('rect');
      if (rect) rect.setAttribute('fill', '#FFFFFF');
      const textTspans = b.querySelectorAll('tspan');
      if (textTspans[0]) textTspans[0].setAttribute('fill', '#0F172A');
    });
    svgClone.querySelectorAll('.vz-state').forEach((p) => {
      p.setAttribute('stroke', '#FFFFFF');
      if (!p.getAttribute('fill') || p.getAttribute('fill').toUpperCase() === '#334155') {
        p.setAttribute('fill', '#E2E8F0');
      }
    });

    const legendItems = [
      { color: COLORS.high, label: '≥80% Operatividad' },
      { color: COLORS.mid, label: '50–79% Operatividad' },
      { color: COLORS.low, label: '<50% Operatividad' },
      { color: '#CBD5E1', label: 'Sin datos' }
    ];

    const itemHeight = 18.5;
    const boxPadding = 8.5;
    const boxHeight = legendItems.length * itemHeight + boxPadding * 2 - 3;
    const boxWidth = 120;
    const startX = 16;
    const startY = 514 - boxHeight;

    let legendItemsSvg = '';
    legendItems.forEach((item, idx) => {
      const itemY = startY + boxPadding + idx * itemHeight + 7;
      legendItemsSvg += `
        <circle cx="${startX + 12}" cy="${itemY}" r="4.2" fill="${item.color}" />
        <text x="${startX + 22}" y="${itemY + 3.2}" font-family="'Poppins', sans-serif" font-size="8.5" font-weight="600" fill="#475569">${item.label}</text>
      `;
    });

    const legendGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    legendGroup.setAttribute('id', 'svgExportLegend');
    legendGroup.innerHTML = `
      <rect x="${startX}" y="${startY}" width="${boxWidth}" height="${boxHeight}" rx="6" fill="#FFFFFF" fill-opacity="0.95" stroke="#cbd5e1" stroke-width="1.1" />
      ${legendItemsSvg}
    `;
    svgClone.appendChild(legendGroup);

    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, width, height);

      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = 'mapa_operatividad_flota.png';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
  }

  function renderRanking(rankingEl, dataMap, canonActive) {
    const entries = Object.entries(dataMap)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.pct - a.pct || b.total - a.total);

    if (!entries.length) {
      rankingEl.innerHTML = '';
      return;
    }

    const isMultiCol = entries.length > 8;

    rankingEl.innerHTML = `
      <div class="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1 pb-1.5 mb-1 border-b border-slate-100 dark:border-slate-800">
        <span>Ranking por Estado (${entries.length})</span>
        <span class="text-right">Operatividad</span>
      </div>
      <div class="grid grid-cols-1 ${isMultiCol ? 'sm:grid-cols-2' : ''} gap-1.5">
        ${entries.map((e, i) => {
          const tone = toneFor(e.pct);
          const isSelected = canonActive && e.name === canonActive;
          const containerCls = isSelected
            ? 'bg-sky-50 dark:bg-sky-500/15 border-sky-400 dark:border-sky-500/50 ring-1 ring-sky-400'
            : 'bg-slate-50/50 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-700/50 border-slate-200/70 dark:border-slate-700/60';

          return `
          <div class="px-2 py-1.5 rounded-md border transition-all cursor-pointer ${containerCls}" data-state-ranking="${escapeHtml(e.name)}" tabindex="0" role="button" aria-label="${escapeHtml(e.name)}: ${e.pct.toFixed(0)}% de operatividad (${fmt(e.operativos)} de ${fmt(e.total)} vehículos). Clic para filtrar.">
            <div class="flex items-center justify-between gap-1 mb-0.5">
              <div class="flex items-center gap-1 min-w-0">
                <span class="text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500 w-3.5 text-right shrink-0">${i + 1}</span>
                <span class="truncate font-medium text-[11px] text-slate-800 dark:text-slate-100" title="${escapeHtml(e.name)}">${escapeHtml(e.name)}</span>
                ${isSelected ? '<span class="inline-flex items-center px-1 py-0 rounded text-[8px] font-bold bg-sky-500 text-white shrink-0">Filtrado &times;</span>' : ''}
              </div>
              <span class="font-mono text-[11px] font-bold shrink-0 ml-1" style="color:${tone}">${e.pct.toFixed(0)}%</span>
            </div>
            <div class="flex items-center gap-1.5">
              <div class="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200/80 dark:bg-slate-700 flex">
                <div class="h-full bg-emerald-500" style="width:${e.pct}%" title="Operativos: ${fmt(e.operativos)} vehículos"></div>
                <div class="h-full bg-red-500" style="width:${100 - e.pct}%" title="No operativos: ${fmt(e.inactivos)} vehículos"></div>
              </div>
              <span class="text-[9.5px] text-slate-500 dark:text-slate-400 font-mono shrink-0">${fmt(e.operativos)}/${fmt(e.total)}</span>
            </div>
          </div>`;
        }).join('')}
      </div>`;

    rankingEl.querySelectorAll('[data-state-ranking]').forEach((el) => {
      const stateName = el.getAttribute('data-state-ranking');
      el.addEventListener('mouseenter', () => highlightState(stateName, true));
      el.addEventListener('mouseleave', () => highlightState(stateName, false));
      el.addEventListener('click', () => toggleStateFilter(stateName));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleStateFilter(stateName);
        }
      });
    });
  }

  function bindUiEvents() {
    if (eventsBound) return;
    eventsBound = true;

    const btnNone = byId('mapTagModeNone');
    const btnPct = byId('mapTagModePct');
    const btnVeh = byId('mapTagModeVeh');
    const btnPng = byId('mapExportPngBtn');

    if (btnNone) btnNone.onclick = () => setTagMode('none');
    if (btnPct) btnPct.onclick = () => setTagMode('pct');
    if (btnVeh) btnVeh.onclick = () => setTagMode('veh');
    if (btnPng) btnPng.onclick = () => exportPng();
  }

  function render(porEstado, lastResult, activeStateFilter) {
    const box = byId('mapVzBox');
    const wrapper = byId('mapVzWrapper');
    const emptyEl = byId('mapEmpty');
    const rankingEl = byId('mapRanking');
    const activeNotice = byId('mapActiveFilterNotice');
    if (!box || !wrapper) return;

    bindUiEvents();

    cachedDataMap = buildDataMap(porEstado);
    cachedLastResult = lastResult || (window.FleetUI && window.FleetUI.getLastResult ? window.FleetUI.getLastResult() : null);
    const hasData = Object.keys(cachedDataMap).length > 0;

    if (!hasData) {
      box.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      if (rankingEl) rankingEl.innerHTML = '';
      if (activeNotice) activeNotice.classList.add('hidden');
      return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');

    const canonActive = activeStateFilter ? FleetConfig.resolveStateName(activeStateFilter) : null;
    activeStateName = canonActive;

    if (activeNotice) {
      if (canonActive) {
        activeNotice.innerHTML = `<span>Filtrado: ${escapeHtml(canonActive)}</span><button type="button" id="mapClearActiveFilterBtn" class="hover:text-sky-800 dark:hover:text-sky-200 ml-0.5 text-sm font-bold" title="Quitar filtro">&times;</button>`;
        activeNotice.classList.remove('hidden');
        activeNotice.classList.add('inline-flex');
        const clearBtn = activeNotice.querySelector('#mapClearActiveFilterBtn');
        if (clearBtn) {
          clearBtn.onclick = () => {
            const select = byId('stateFilterSelect');
            if (select) {
              select.value = '';
              select.dispatchEvent(new Event('change'));
            }
          };
        }
      } else {
        activeNotice.classList.add('hidden');
        activeNotice.classList.remove('inline-flex');
        activeNotice.innerHTML = '';
      }
    }

    let svgText;
    try {
      svgText = getSvgText();
    } catch (err) {
      console.error('Error cargando el mapa:', err);
      box.innerHTML =
        '<p class="py-8 text-center text-sm text-slate-400">No se pudo cargar el mapa.</p>';
      return;
    }

    const isDark = document.documentElement.classList.contains('dark');
    const noDataFill = isDark ? '#334155' : '#E2E8F0';
    const strokeColor = isDark ? '#1E293B' : '#FFFFFF';

    box.innerHTML = svgText;
    const svg = box.querySelector('svg');
    if (svg) {
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.width = '100%';
      svg.style.height = 'auto';
      svg.style.display = 'block';
    }

    box.querySelectorAll('.vz-state').forEach((path) => {
      const name = FleetConfig.resolveStateName(path.getAttribute('data-canon') || path.getAttribute('title'));
      const d = name ? cachedDataMap[name] : null;

      path.setAttribute('data-canon', name || '');
      path.setAttribute('stroke', strokeColor);
      path.setAttribute('stroke-width', '1.1');

      if (d) {
        path.classList.add('has-data');
        path.classList.remove('no-data');
        path.setAttribute('fill', toneFor(d.pct));
        path.setAttribute('tabindex', '0');
        path.setAttribute('role', 'button');
        path.setAttribute('aria-label', `${name}: ${d.pct.toFixed(1)}% operatividad, ${fmt(d.operativos)} de ${fmt(d.total)} unidades`);

        if (canonActive) {
          if (name === canonActive) {
            path.classList.add('active-state');
            path.classList.remove('is-dimmed');
          } else {
            path.classList.remove('active-state');
            path.classList.add('is-dimmed');
          }
        } else {
          path.classList.remove('active-state', 'is-dimmed');
        }

        path.onmouseenter = (e) => showTooltip(e, name, d);
        path.onmousemove = moveTooltip;
        path.onmouseleave = () => hideTooltip(name);
        path.onclick = (e) => {
          e.stopPropagation();
          toggleStateFilter(name);
        };
        path.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleStateFilter(name);
          }
        };
      } else {
        path.classList.remove('has-data', 'active-state');
        path.classList.add('no-data');
        if (canonActive) path.classList.add('is-dimmed');
        else path.classList.remove('is-dimmed');
        path.setAttribute('fill', noDataFill);
        path.removeAttribute('tabindex');
        path.removeAttribute('role');
        path.setAttribute('aria-label', `${name || 'Entidad'}: Sin registros`);
        path.onmouseenter = null;
        path.onmousemove = null;
        path.onmouseleave = null;
        path.onclick = null;
        path.onkeydown = null;
      }
    });

    box.querySelectorAll('.state-badge').forEach((badge) => {
      const name = FleetConfig.resolveStateName(badge.getAttribute('data-canon'));
      const d = name ? cachedDataMap[name] : null;
      badge.setAttribute('data-canon', name || '');

      const rect = badge.querySelector('rect');
      const textTspans = badge.querySelectorAll('tspan');
      const valTspan = badge.querySelector('.badge-val-tspan');

      if (textTspans[0]) {
        textTspans[0].setAttribute('fill', isDark ? '#F1F5F9' : '#0F172A');
      }

      if (d) {
        badge.classList.add('has-data');
        badge.classList.remove('no-data');
        badge.setAttribute('tabindex', '0');
        badge.setAttribute('role', 'button');
        badge.setAttribute('aria-label', `Etiqueta ${name}: ${d.pct.toFixed(0)}% de operatividad`);

        if (canonActive) {
          if (name === canonActive) {
            badge.classList.add('active-badge');
            badge.classList.remove('is-dimmed');
          } else {
            badge.classList.remove('active-badge');
            badge.classList.add('is-dimmed');
          }
        } else {
          badge.classList.remove('active-badge', 'is-dimmed');
        }

        const tone = toneFor(d.pct);
        if (rect) {
          rect.setAttribute('stroke', tone);
          rect.setAttribute('fill', isDark ? '#1E293B' : '#FFFFFF');
        }
        if (valTspan) {
          valTspan.setAttribute('fill', tone);
          if (currentTagMode === 'veh') {
            valTspan.textContent = `${fmt(d.total)} ${d.total === 1 ? 'vehículo' : 'vehículos'}`;
          } else {
            valTspan.textContent = `${d.pct.toFixed(0)}% Op.`;
          }
        }

        badge.onmouseenter = (e) => showTooltip(e, name, d);
        badge.onmousemove = moveTooltip;
        badge.onmouseleave = () => hideTooltip(name);
        badge.onclick = (e) => {
          e.stopPropagation();
          toggleStateFilter(name);
        };
        badge.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleStateFilter(name);
          }
        };
      } else {
        badge.classList.remove('has-data', 'active-badge');
        badge.classList.add('no-data');
        if (canonActive) badge.classList.add('is-dimmed');
        else badge.classList.remove('is-dimmed');
        badge.removeAttribute('tabindex');
        badge.removeAttribute('role');
        if (rect) {
          rect.setAttribute('stroke', isDark ? '#475569' : '#CBD5E1');
          rect.setAttribute('fill', isDark ? '#1E293B' : '#FFFFFF');
        }
        if (textTspans[0]) {
          textTspans[0].setAttribute('fill', isDark ? '#94A3B8' : '#64748B');
        }
        if (valTspan) {
          valTspan.setAttribute('fill', isDark ? '#64748B' : '#94A3B8');
          valTspan.textContent = 'Sin datos';
        }
        badge.onmouseenter = null;
        badge.onmousemove = null;
        badge.onmouseleave = null;
        badge.onclick = null;
        badge.onkeydown = null;
      }
    });

    const leaderLinesGroup = box.querySelector('#leaderLinesGroup');
    if (leaderLinesGroup) {
      leaderLinesGroup.querySelectorAll('line').forEach((line) => {
        line.setAttribute('stroke', isDark ? '#64748B' : '#94A3B8');
      });
      leaderLinesGroup.querySelectorAll('circle').forEach((circle) => {
        circle.setAttribute('fill', isDark ? '#94A3B8' : '#64748B');
      });
    }

    setTagMode(currentTagMode);

    if (rankingEl) renderRanking(rankingEl, cachedDataMap, canonActive);
  }

  return { render, toggleStateFilter, setTagMode, exportPng, openDrawer: toggleStateFilter, closeDrawer: () => {} };
})();