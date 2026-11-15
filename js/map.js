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

    return `
      <div class="font-bold text-slate-900 dark:text-slate-100 text-xs mb-1.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
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

  function setTagMode(mode) {
    currentTagMode = mode;
    const btnNone = byId('mapTagModeNone');
    const btnPct = byId('mapTagModePct');
    const btnVeh = byId('mapTagModeVeh');

    const activeClass = 'w-full text-left px-3 py-2 rounded-md text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 shadow-xs transition-all touch-manipulation flex items-center justify-between';
    const inactiveClass = 'w-full text-left px-3 py-2 rounded-md text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/40 dark:hover:bg-slate-700/50 transition-all touch-manipulation flex items-center justify-between';

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

    if (btnNone) btnNone.onclick = () => setTagMode('none');
    if (btnPct) btnPct.onclick = () => setTagMode('pct');
    if (btnVeh) btnVeh.onclick = () => setTagMode('veh');
    if (btnFs) btnFs.onclick = () => toggleFullscreen();

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
          const mapCard = byId('mapCard');
          if (mapCard && mapCard.classList.contains('is-fullscreen')) {
            mapCard.classList.remove('is-fullscreen');
            updateFullscreenUi(false);
          }
        }
      });
    }
  }

  function triggerStateFilter(name) {
    const select = byId('stateFilterSelect');
    if (!select) return;
    const canon = FleetConfig.resolveStateName(name);
    const targetNorm = canon ? FleetConfig.normalize(canon) : FleetConfig.normalize(name);
    const currentNorm = select.value ? FleetConfig.normalize(select.value) : '';

    if (currentNorm && currentNorm === targetNorm) {
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
  }

  function render(porEstado, activeStateFilter) {
    const box = byId('mapVzBox');
    const wrapper = byId('mapVzWrapper');
    const emptyEl = byId('mapEmpty');
    if (!box || !wrapper) return;

    bindUiEvents();

    cachedDataMap = buildDataMap(porEstado);
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
        path.setAttribute('aria-label', `${name}: ${d.pct.toFixed(1)}% operatividad, ${fmt(d.operativos)} de ${fmt(d.total)} unidades. Clic para filtrar.`);

        if (canonicalActive) {
          if (name === canonicalActive) {
            path.classList.add('active-state');
            path.classList.remove('is-dimmed');
            if (path.parentNode) path.parentNode.appendChild(path);
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
        path.onclick = () => triggerStateFilter(name);
        path.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerStateFilter(name);
          }
        };
      } else {
        path.classList.remove('has-data', 'active-state');
        if (canonicalActive) {
          path.classList.add('is-dimmed');
        } else {
          path.classList.remove('is-dimmed');
        }
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
        badge.setAttribute('aria-label', `Etiqueta ${name}: ${d.pct.toFixed(0)}% de operatividad. Clic para filtrar.`);

        if (canonicalActive) {
          if (name === canonicalActive) {
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
            valTspan.textContent = `${d.pct.toFixed(0)}%`;
          }
        }

        badge.onmouseenter = (e) => showTooltip(e, name, d);
        badge.onmousemove = moveTooltip;
        badge.onmouseleave = () => hideTooltip(name);
        badge.onclick = () => triggerStateFilter(name);
        badge.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerStateFilter(name);
          }
        };
      } else {
        badge.classList.remove('has-data', 'active-badge');
        if (canonicalActive) {
          badge.classList.add('is-dimmed');
        } else {
          badge.classList.remove('is-dimmed');
        }
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

    setTagMode(currentTagMode);
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

  return { render, renderMiniMap, setTagMode, toggleFullscreen, toneFor };
})();