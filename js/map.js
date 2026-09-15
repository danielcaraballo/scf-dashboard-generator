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

  function render(porEstado) {
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
        path.removeAttribute('tabindex');
        path.removeAttribute('role');
        path.setAttribute('aria-label', `${name}: ${d.pct.toFixed(1)}% operatividad, ${fmt(d.operativos)} de ${fmt(d.total)} unidades`);

        path.onmouseenter = (e) => showTooltip(e, name, d);
        path.onmousemove = moveTooltip;
        path.onmouseleave = () => hideTooltip(name);
        path.onclick = null;
        path.onkeydown = null;
      } else {
        path.classList.remove('has-data');
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
        badge.removeAttribute('tabindex');
        badge.removeAttribute('role');
        badge.setAttribute('aria-label', `Etiqueta ${name}: ${d.pct.toFixed(0)}% de operatividad`);

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
        badge.onclick = null;
        badge.onkeydown = null;
      } else {
        badge.classList.remove('has-data');
        badge.classList.add('no-data');
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
  }

  return { render, setTagMode, exportPng, toggleFullscreen };
})();