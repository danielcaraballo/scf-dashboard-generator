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
  let cachedDataMap = null;
  let cachedPorEstado = [];
  let cachedRanks = { ranks: {}, totalStatesWithData: 0 };
  let cachedNationalTotal = 0;
  let currentSelectedState = null;
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

  function computeRanks(porEstado) {
    const valid = (porEstado || [])
      .filter((e) => Boolean(FleetConfig.resolveStateName(e.label)) && e.total > 0)
      .sort((a, b) => b.pct - a.pct || b.total - a.total);

    const ranks = {};
    valid.forEach((item, index) => {
      const canon = FleetConfig.resolveStateName(item.label);
      if (canon && ranks[canon] === undefined) {
        ranks[canon] = index + 1;
      }
    });

    return { ranks, totalStatesWithData: valid.length };
  }

  function tooltipHtml(name, d) {
    const tone = toneFor(d.pct);
    const tier = d.pct >= 80 ? 'Alta' : d.pct >= 50 ? 'Media' : 'Baja';

    return `
      <div class="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-1.5">
        <span class="font-bold text-slate-900 dark:text-slate-100 text-xs truncate uppercase tracking-tight">${escapeHtml(name)}</span>
        <span class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full font-mono" style="background:${tone}20; color:${tone}">
          <span class="w-1.5 h-1.5 rounded-full inline-block shrink-0" style="background:${tone}"></span>
          ${tier}
        </span>
      </div>
      <div class="space-y-1.5 text-[11px] leading-tight">
        <div>
          <div class="flex items-baseline justify-between text-slate-600 dark:text-slate-400 mb-0.5">
            <span>Operatividad:</span>
            <strong class="font-mono text-xs font-bold" style="color:${tone}">${d.pct.toFixed(1)}%</strong>
          </div>
          <div class="w-full bg-slate-200 dark:bg-slate-700 h-1 rounded-full overflow-hidden">
            <div class="h-full rounded-full" style="width:${Math.min(100, Math.max(0, d.pct))}%; background:${tone}"></div>
          </div>
        </div>
        <div class="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400 pt-0.5">
          <span>Unidades:</span>
          <span class="font-mono font-semibold text-slate-800 dark:text-slate-200">${fmt(d.operativos)} op. / ${fmt(d.total)} total</span>
        </div>
        <div class="text-[9px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-center">
          Haz clic para fijar diagnóstico
        </div>
      </div>`;
  }

  let activeTooltipEl = null;
  let activeWrapperEl = null;
  let activeWrapperRect = null;
  let activeTooltipW = 0;
  let activeTooltipH = 0;

  function showTooltip(ev, name, d) {
    activeTooltipEl = activeTooltipEl || byId('mapTooltip');
    activeWrapperEl = activeWrapperEl || byId('mapVzWrapper');
    if (!activeTooltipEl || !activeWrapperEl) return;

    activeTooltipEl.innerHTML = tooltipHtml(name, d);
    activeTooltipEl.classList.remove('hidden');
    activeWrapperRect = activeWrapperEl.getBoundingClientRect();
    activeTooltipW = activeTooltipEl.offsetWidth;
    activeTooltipH = activeTooltipEl.offsetHeight;
    moveTooltip(ev);
    highlightState(name, true);
  }

  function moveTooltip(ev) {
    if (!activeTooltipEl || !activeWrapperRect || activeTooltipEl.classList.contains('hidden')) return;

    let x = ev.clientX - activeWrapperRect.left + 14;
    let y = ev.clientY - activeWrapperRect.top + 14;
    if (x + activeTooltipW > activeWrapperRect.width - 8) x = ev.clientX - activeWrapperRect.left - activeTooltipW - 14;
    if (y + activeTooltipH > activeWrapperRect.height - 8) y = ev.clientY - activeWrapperRect.top - activeTooltipH - 14;
    activeTooltipEl.style.left = `${Math.max(8, x)}px`;
    activeTooltipEl.style.top = `${Math.max(8, y)}px`;
  }

  function hideTooltip(name) {
    if (activeTooltipEl) activeTooltipEl.classList.add('hidden');
    activeWrapperRect = null;
    if (name) {
      highlightState(name, false);
    } else {
      document.querySelectorAll('.vz-state, .state-badge').forEach((el) => {
        el.classList.remove('is-hovered');
      });
    }
  }

  function highlightState(name, isHovered) {
    const escaped = window.CSS && CSS.escape ? CSS.escape(name) : name;
    const paths = document.querySelectorAll(`.vz-state[data-canon="${escaped}"]`);
    const badges = document.querySelectorAll(`.state-badge[data-canon="${escaped}"]`);
    paths.forEach((p) => {
      if (isHovered) p.classList.add('is-hovered');
      else p.classList.remove('is-hovered');
    });
    badges.forEach((b) => {
      if (isHovered) b.classList.add('is-hovered');
      else b.classList.remove('is-hovered');
    });
  }

  function selectState(name) {
    if (!name || !cachedDataMap) return;
    const canon = FleetConfig.resolveStateName(name);
    if (!canon || !cachedDataMap[canon]) return;

    if (currentSelectedState === canon) {
      clearSelection();
      return;
    }

    currentSelectedState = canon;
    const d = cachedDataMap[canon];
    const tone = toneFor(d.pct);
    const tier = d.pct >= 80 ? 'Alta' : d.pct >= 50 ? 'Media' : 'Baja';

    document.querySelectorAll('.vz-state').forEach((p) => {
      const pCanon = FleetConfig.resolveStateName(p.getAttribute('data-canon') || p.getAttribute('title'));
      if (pCanon === canon) {
        p.classList.add('active-state');
        p.classList.remove('is-dimmed', 'is-tier-hovered');
        if (p.parentNode) p.parentNode.appendChild(p);
      } else {
        p.classList.remove('active-state', 'is-tier-hovered');
        p.classList.add('is-dimmed');
      }
    });

    document.querySelectorAll('.state-badge').forEach((b) => {
      const bCanon = FleetConfig.resolveStateName(b.getAttribute('data-canon'));
      if (bCanon === canon) {
        b.classList.add('active-badge');
        b.classList.remove('is-dimmed', 'is-tier-hovered');
      } else {
        b.classList.remove('active-badge', 'is-tier-hovered');
        b.classList.add('is-dimmed');
      }
    });

    const chip = byId('mapSelectedStateChip');
    const chipText = byId('mapSelectedStateChipText');
    const resetBtn = byId('mapResetSelectionBtn');
    if (chip && chipText) {
      chipText.textContent = canon;
      chip.classList.remove('hidden');
      chip.classList.add('inline-flex');
    }
    if (resetBtn) {
      resetBtn.classList.remove('hidden');
      resetBtn.classList.add('inline-flex');
    }

    const inspector = byId('mapInspectorPanel');
    const general = byId('mapGeneralPanel');
    if (inspector && general) {
      general.classList.add('hidden');
      inspector.classList.remove('hidden');
      inspector.classList.add('flex');

      const stNameEl = byId('mapInspectorStateName');
      if (stNameEl) stNameEl.textContent = canon;

      const pctEl = byId('mapInspectorPct');
      if (pctEl) {
        pctEl.textContent = `${d.pct.toFixed(1)}%`;
        pctEl.style.color = tone;
      }

      const badgeEl = byId('mapInspectorBadge');
      if (badgeEl) {
        badgeEl.textContent = tier;
        badgeEl.style.backgroundColor = `${tone}20`;
        badgeEl.style.color = tone;
        badgeEl.style.borderColor = `${tone}50`;
      }

      const barEl = byId('mapInspectorBar');
      if (barEl) {
        barEl.style.width = `${Math.min(100, Math.max(0, d.pct))}%`;
        barEl.style.backgroundColor = tone;
      }

      const opCountEl = byId('mapInspectorOpCount');
      if (opCountEl) opCountEl.textContent = `${fmt(d.operativos)} un.`;

      const inopCountEl = byId('mapInspectorInopCount');
      if (inopCountEl) inopCountEl.textContent = `${fmt(d.inactivos)} un.`;

      const totalCountEl = byId('mapInspectorTotalCount');
      if (totalCountEl) totalCountEl.textContent = `${fmt(d.total)} un.`;

      const rankEl = byId('mapInspectorRank');
      const rank = cachedRanks.ranks ? cachedRanks.ranks[canon] : null;
      if (rankEl) {
        rankEl.textContent = rank ? `#${rank} de ${cachedRanks.totalStatesWithData}` : '—';
      }

      const shareEl = byId('mapInspectorShare');
      if (shareEl) {
        const share = cachedNationalTotal > 0 ? ((d.total / cachedNationalTotal) * 100).toFixed(1) : '0.0';
        shareEl.textContent = `${share}%`;
      }

      const filterBtnText = byId('mapInspectorFilterBtnText');
      const select = byId('stateFilterSelect');
      const isFilteredOnSelect = select && FleetConfig.normalize(select.value) === FleetConfig.normalize(canon);
      if (filterBtnText) {
        filterBtnText.textContent = isFilteredOnSelect ? 'Quitar filtro del tablero' : 'Filtrar tablero por este estado';
      }
    }
  }

  function clearSelection() {
    currentSelectedState = null;
    document.querySelectorAll('.vz-state, .state-badge').forEach((el) => {
      el.classList.remove('active-state', 'active-badge', 'is-dimmed', 'is-tier-hovered');
    });

    const chip = byId('mapSelectedStateChip');
    const resetBtn = byId('mapResetSelectionBtn');
    if (chip) {
      chip.classList.add('hidden');
      chip.classList.remove('inline-flex');
    }
    if (resetBtn) {
      resetBtn.classList.add('hidden');
      resetBtn.classList.remove('inline-flex');
    }

    const inspector = byId('mapInspectorPanel');
    const general = byId('mapGeneralPanel');
    if (inspector) {
      inspector.classList.add('hidden');
      inspector.classList.remove('flex');
    }
    if (general) {
      general.classList.remove('hidden');
    }
  }

  function highlightTier(tier) {
    if (currentSelectedState) return;
    document.querySelectorAll('.vz-state').forEach((path) => {
      const name = FleetConfig.resolveStateName(path.getAttribute('data-canon') || path.getAttribute('title'));
      const d = name ? cachedDataMap[name] : null;
      if (!d) {
        if (tier === 'nodata') {
          path.classList.add('is-tier-hovered');
          path.classList.remove('is-dimmed');
          if (path.parentNode) path.parentNode.appendChild(path);
        } else {
          path.classList.remove('is-tier-hovered');
          path.classList.add('is-dimmed');
        }
        return;
      }
      if (tier === 'nodata') {
        path.classList.remove('is-tier-hovered');
        path.classList.add('is-dimmed');
        return;
      }
      const stTier = d.pct >= 80 ? 'high' : d.pct >= 50 ? 'mid' : 'low';
      if (stTier === tier) {
        path.classList.add('is-tier-hovered');
        path.classList.remove('is-dimmed');
        if (path.parentNode) path.parentNode.appendChild(path);
      } else {
        path.classList.remove('is-tier-hovered');
        path.classList.add('is-dimmed');
      }
    });

    document.querySelectorAll('.state-badge').forEach((badge) => {
      const name = FleetConfig.resolveStateName(badge.getAttribute('data-canon'));
      const d = name ? cachedDataMap[name] : null;
      if (!d) {
        if (tier === 'nodata') {
          badge.classList.add('is-tier-hovered');
          badge.classList.remove('is-dimmed');
        } else {
          badge.classList.remove('is-tier-hovered');
          badge.classList.add('is-dimmed');
        }
        return;
      }
      if (tier === 'nodata') {
        badge.classList.remove('is-tier-hovered');
        badge.classList.add('is-dimmed');
        return;
      }
      const stTier = d.pct >= 80 ? 'high' : d.pct >= 50 ? 'mid' : 'low';
      if (stTier === tier) {
        badge.classList.add('is-tier-hovered');
        badge.classList.remove('is-dimmed');
      } else {
        badge.classList.remove('is-tier-hovered');
        badge.classList.add('is-dimmed');
      }
    });
  }

  function clearTierHighlight() {
    if (currentSelectedState) return;
    document.querySelectorAll('.vz-state, .state-badge').forEach((el) => {
      el.classList.remove('is-tier-hovered', 'is-dimmed');
    });
  }

  function toggleDashboardFilterForSelected() {
    if (!currentSelectedState) return;
    const select = byId('stateFilterSelect');
    if (!select) return;

    const currentNorm = select.value ? FleetConfig.normalize(select.value) : '';
    const targetNorm = FleetConfig.normalize(currentSelectedState);

    if (currentNorm === targetNorm) {
      select.value = '';
    } else {
      let matched = false;
      for (let i = 0; i < select.options.length; i++) {
        if (FleetConfig.normalize(select.options[i].value) === targetNorm) {
          select.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (!matched) select.value = targetNorm;
    }
    select.dispatchEvent(new Event('change', { bubbles: true }));

    const filterBtnText = byId('mapInspectorFilterBtnText');
    if (filterBtnText) {
      const nowFiltered = select.value && FleetConfig.normalize(select.value) === targetNorm;
      filterBtnText.textContent = nowFiltered ? 'Quitar filtro del tablero' : 'Filtrar tablero por este estado';
    }
  }

  function updateLegendCounters(porEstado) {
    let high = 0;
    let mid = 0;
    let low = 0;
    let withData = 0;

    (porEstado || []).forEach((e) => {
      const canon = FleetConfig.resolveStateName(e.label);
      if (!canon || e.total <= 0) return;
      withData++;
      if (e.pct >= 80) high++;
      else if (e.pct >= 50) mid++;
      else low++;
    });

    const totalVzStates = 24;
    const noData = Math.max(0, totalVzStates - withData);

    const highEl = byId('mapLegendHighCount');
    const midEl = byId('mapLegendMidCount');
    const lowEl = byId('mapLegendLowCount');
    const noDataEl = byId('mapLegendNoDataCount');
    const covEl = byId('mapLegendCoverageCount');
    const badgeEl = byId('mapCoverageBadge');

    if (highEl) highEl.textContent = `${high}`;
    if (midEl) midEl.textContent = `${mid}`;
    if (lowEl) lowEl.textContent = `${low}`;
    if (noDataEl) noDataEl.textContent = `${noData}`;
    if (covEl) covEl.textContent = `${withData} de ${totalVzStates} entidades`;
    if (badgeEl) badgeEl.textContent = `${withData} entidades`;
  }

  function setTagMode(mode) {
    currentTagMode = mode;
    const btnNone = byId('mapTagModeNone');
    const btnPct = byId('mapTagModePct');
    const btnVeh = byId('mapTagModeVeh');

    const activeClass =
      'px-2 py-1.5 rounded-md text-xs font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 shadow-xs transition-all touch-manipulation text-center cursor-pointer';
    const inactiveClass =
      'px-2 py-1.5 rounded-md text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all touch-manipulation text-center cursor-pointer';

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
    document.querySelectorAll('.state-badge').forEach((badge) => {
      const canon = FleetConfig.resolveStateName(badge.getAttribute('data-canon'));
      const d = canon ? cachedDataMap[canon] : null;
      const tspan = badge.querySelector('.badge-val-tspan');
      if (tspan) {
        if (d) {
          const tone = toneFor(d.pct);
          tspan.setAttribute('fill', tone);
          if (mode === 'veh') {
            tspan.textContent = `${fmt(d.total)} veh.`;
          } else {
            tspan.textContent = `${d.pct.toFixed(0)}%`;
          }
        } else {
          tspan.setAttribute('fill', '#64748B');
          tspan.textContent = 'Sin datos';
        }
      }
    });
  }

  function isFullscreen() {
    const mapCard = byId('mapCard');
    return Boolean(
      (document.fullscreenElement && document.fullscreenElement === mapCard) ||
      (mapCard && mapCard.classList.contains('is-fullscreen'))
    );
  }

  function updateFullscreenUi(isFs) {
    const btnFs = byId('mapFullscreenBtn');
    const iconExp = byId('mapFsIconExpand');
    const iconComp = byId('mapFsIconCompress');
    const btnText = byId('mapFsBtnText');
    if (iconExp && iconComp) {
      iconExp.classList.toggle('hidden', isFs);
      iconComp.classList.toggle('hidden', !isFs);
    }
    if (btnText) {
      btnText.textContent = isFs ? 'Salir' : 'Pantalla completa';
    }
    if (btnFs) {
      const title = isFs ? 'Salir de pantalla completa' : 'Pantalla completa';
      btnFs.setAttribute('title', title);
      btnFs.setAttribute('aria-label', title);
      if (isFs) {
        btnFs.classList.add('bg-sky-50', 'text-sky-600', 'border-sky-300', 'dark:bg-sky-950/50', 'dark:text-sky-400', 'dark:border-sky-800');
      } else {
        btnFs.classList.remove('bg-sky-50', 'text-sky-600', 'border-sky-300', 'dark:bg-sky-950/50', 'dark:text-sky-400', 'dark:border-sky-800');
      }
    }
  }

  function toggleFullscreen() {
    const mapCard = byId('mapCard');
    if (!mapCard) return;

    if (isFullscreen()) {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      mapCard.classList.remove('is-fullscreen');
      updateFullscreenUi(false);
    } else {
      if (typeof mapCard.requestFullscreen === 'function') {
        mapCard.requestFullscreen().catch(() => {
          mapCard.classList.add('is-fullscreen');
          updateFullscreenUi(true);
        });
      } else {
        mapCard.classList.add('is-fullscreen');
        updateFullscreenUi(true);
      }
    }
  }

  function bindUiEvents() {
    if (eventsBound) return;
    eventsBound = true;

    const btnNone = byId('mapTagModeNone');
    const btnPct = byId('mapTagModePct');
    const btnVeh = byId('mapTagModeVeh');
    const btnFs = byId('mapFullscreenBtn');
    const closeBtn = byId('mapInspectorCloseBtn');
    const resetBtn = byId('mapResetSelectionBtn');
    const filterBtn = byId('mapInspectorFilterBtn');

    if (btnNone) btnNone.onclick = () => setTagMode('none');
    if (btnPct) btnPct.onclick = () => setTagMode('pct');
    if (btnVeh) btnVeh.onclick = () => setTagMode('veh');
    if (btnFs) btnFs.onclick = () => toggleFullscreen();
    if (closeBtn) closeBtn.onclick = () => clearSelection();
    if (resetBtn) resetBtn.onclick = () => clearSelection();
    if (filterBtn) filterBtn.onclick = () => toggleDashboardFilterForSelected();

    const tierHigh = byId('mapLegendTierHigh');
    const tierMid = byId('mapLegendTierMid');
    const tierLow = byId('mapLegendTierLow');
    const tierNoData = byId('mapLegendTierNoData');

    if (tierHigh) {
      tierHigh.onmouseenter = () => highlightTier('high');
      tierHigh.onmouseleave = clearTierHighlight;
    }
    if (tierMid) {
      tierMid.onmouseenter = () => highlightTier('mid');
      tierMid.onmouseleave = clearTierHighlight;
    }
    if (tierLow) {
      tierLow.onmouseenter = () => highlightTier('low');
      tierLow.onmouseleave = clearTierHighlight;
    }
    if (tierNoData) {
      tierNoData.onmouseenter = () => highlightTier('nodata');
      tierNoData.onmouseleave = clearTierHighlight;
    }

    const wrapper = byId('mapVzWrapper');
    if (wrapper) {
      wrapper.onclick = (e) => {
        if (!e.target.closest('.vz-state') && !e.target.closest('.state-badge')) {
          if (currentSelectedState) clearSelection();
        }
      };
    }

    if (typeof document.addEventListener === 'function') {
      document.addEventListener('fullscreenchange', () => {
        const mapCard = byId('mapCard');
        const isFs = Boolean(mapCard && document.fullscreenElement === mapCard);
        if (!isFs && mapCard) {
          mapCard.classList.remove('is-fullscreen');
        }
        updateFullscreenUi(isFs);
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (currentSelectedState) {
            clearSelection();
            return;
          }
          const mapCard = byId('mapCard');
          if (mapCard && mapCard.classList.contains('is-fullscreen')) {
            mapCard.classList.remove('is-fullscreen');
            updateFullscreenUi(false);
          }
        }
      });
    }
  }

  function render(porEstado, activeStateFilter) {
    const box = byId('mapVzBox');
    const wrapper = byId('mapVzWrapper');
    const emptyEl = byId('mapEmpty');
    if (!box || !wrapper) return;

    bindUiEvents();

    cachedPorEstado = porEstado || [];
    cachedDataMap = buildDataMap(porEstado);
    cachedRanks = computeRanks(porEstado);
    cachedNationalTotal = Object.values(cachedDataMap).reduce((sum, item) => sum + (item.total || 0), 0);

    const hasData = Object.keys(cachedDataMap).length > 0;

    if (!hasData) {
      box.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');

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
    const noDataFill = isDark ? '#334155' : '#CBD5E1';
    const strokeColor = isDark ? '#1E293B' : '#94A3B8';
    const canonicalActive = activeStateFilter ? FleetConfig.resolveStateName(activeStateFilter) : null;

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
        path.setAttribute(
          'aria-label',
          `${name}: ${d.pct.toFixed(1)}% operatividad, ${fmt(d.operativos)} de ${fmt(d.total)} unidades. Clic para inspeccionar.`
        );

        path.onmouseenter = (e) => showTooltip(e, name, d);
        path.onmousemove = moveTooltip;
        path.onmouseleave = () => hideTooltip(name);
        path.onclick = (e) => {
          e.stopPropagation();
          selectState(name);
        };
        path.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectState(name);
          }
        };
      } else {
        path.classList.remove('has-data', 'active-state');
        path.classList.add('no-data');
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
        badge.setAttribute(
          'aria-label',
          `Etiqueta ${name}: ${d.pct.toFixed(0)}% de operatividad. Clic para inspeccionar.`
        );

        const tone = toneFor(d.pct);
        if (rect) {
          rect.setAttribute('stroke', tone);
          rect.setAttribute('fill', isDark ? '#1E293B' : '#FFFFFF');
        }
        if (valTspan) {
          valTspan.setAttribute('fill', tone);
          if (currentTagMode === 'veh') {
            valTspan.textContent = `${fmt(d.total)} veh.`;
          } else {
            valTspan.textContent = `${d.pct.toFixed(0)}%`;
          }
        }

        badge.onmouseenter = (e) => showTooltip(e, name, d);
        badge.onmousemove = moveTooltip;
        badge.onmouseleave = () => hideTooltip(name);
        badge.onclick = (e) => {
          e.stopPropagation();
          selectState(name);
        };
        badge.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectState(name);
          }
        };
      } else {
        badge.classList.remove('has-data', 'active-badge');
        badge.classList.add('no-data');
        badge.removeAttribute('tabindex');
        badge.removeAttribute('role');
        if (rect) {
          rect.setAttribute('stroke', isDark ? '#475569' : '#94A3B8');
          rect.setAttribute('fill', isDark ? '#1E293B' : '#FFFFFF');
        }
        if (textTspans[0]) {
          textTspans[0].setAttribute('fill', isDark ? '#94A3B8' : '#334155');
        }
        if (valTspan) {
          valTspan.setAttribute('fill', '#64748B');
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
        line.setAttribute('stroke', '#64748B');
      });
      leaderLinesGroup.querySelectorAll('circle').forEach((circle) => {
        circle.setAttribute('fill', isDark ? '#94A3B8' : '#475569');
      });
    }

    updateLegendCounters(porEstado);
    setTagMode(currentTagMode);

    if (canonicalActive) {
      selectState(canonicalActive);
    } else if (currentSelectedState && cachedDataMap[currentSelectedState]) {
      selectState(currentSelectedState);
    } else {
      clearSelection();
    }
  }

  function renderMiniMap(containerId, targetStateName, porEstado) {
    const box = byId(containerId);
    if (!box) return;

    let svgText;
    try {
      svgText = getSvgText();
    } catch (e) {
      box.innerHTML = '';
      return;
    }

    box.innerHTML = svgText;
    const svg = box.querySelector('svg');
    if (!svg) return;

    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.style.display = 'block';

    const badgesGroup = svg.querySelector('#badgesGroup');
    if (badgesGroup) badgesGroup.style.display = 'none';
    const leaderLinesGroup = svg.querySelector('#leaderLinesGroup');
    if (leaderLinesGroup) leaderLinesGroup.style.display = 'none';

    const isDark = document.documentElement.classList.contains('dark');
    const subtleFill = isDark ? '#334155' : '#E2E8F0';
    const subtleStroke = isDark ? '#1E293B' : '#CBD5E1';
    const canonTarget = FleetConfig.resolveStateName(targetStateName);

    const dataMap = buildDataMap(porEstado || []);
    const targetData = canonTarget ? dataMap[canonTarget] : null;
    const targetTone = targetData ? toneFor(targetData.pct) : '#0EA5E9';

    svg.querySelectorAll('.vz-state').forEach((path) => {
      const name = FleetConfig.resolveStateName(path.getAttribute('data-canon') || path.getAttribute('title'));
      if (name && name === canonTarget) {
        path.setAttribute('data-mini-target', 'true');
        path.setAttribute('fill', targetTone);
        path.setAttribute('stroke', '#0EA5E9');
        path.setAttribute('stroke-width', '2.4');
        path.style.filter = 'drop-shadow(0 0 5px rgba(14, 165, 233, 0.45))';
        if (path.parentNode) path.parentNode.appendChild(path);
      } else {
        path.removeAttribute('data-mini-target');
        path.setAttribute('fill', subtleFill);
        path.setAttribute('stroke', subtleStroke);
        path.setAttribute('stroke-width', '0.8');
        path.style.opacity = isDark ? '0.5' : '0.65';
      }
    });
  }

  return {
    render,
    renderMiniMap,
    setTagMode,
    toggleFullscreen,
    selectState,
    clearSelection,
    toneFor
  };
})();