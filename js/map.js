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
      <div class="font-bold text-slate-900 text-xs mb-1 dark:text-slate-100">${escapeHtml(name)}</div>
      <div class="space-y-0.5 text-[11px] leading-tight">
        <div class="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span class="w-2 h-2 rounded-full inline-block shrink-0" style="background:${tone}"></span>
          <span><strong class="text-slate-800 dark:text-slate-100">${d.pct.toFixed(1)}%</strong> de operatividad</span>
        </div>
        <div class="text-slate-500 dark:text-slate-400">${fmt(d.operativos)} operativos de ${fmt(d.total)} unidades</div>
      </div>`;
  }

  function attachTooltip(wrapper, tooltipEl, path, name, d) {
    const show = (ev) => {
      tooltipEl.innerHTML = tooltipHtml(name, d);
      tooltipEl.classList.remove('hidden');
      move(ev);
    };
    const move = (ev) => {
      if (tooltipEl.classList.contains('hidden')) return;
      const rect = wrapper.getBoundingClientRect();
      let x = ev.clientX - rect.left + 14;
      let y = ev.clientY - rect.top + 14;
      const tw = tooltipEl.offsetWidth;
      const th = tooltipEl.offsetHeight;
      if (x + tw > rect.width - 4) x = ev.clientX - rect.left - tw - 14;
      if (y + th > rect.height - 4) y = ev.clientY - rect.top - th - 14;
      tooltipEl.style.left = `${Math.max(4, x)}px`;
      tooltipEl.style.top = `${Math.max(4, y)}px`;
    };
    const hide = () => tooltipEl.classList.add('hidden');

    path.addEventListener('mouseenter', show);
    path.addEventListener('mousemove', move);
    path.addEventListener('mouseleave', hide);
  }

  function renderRanking(rankingEl, dataMap) {
    const entries = Object.entries(dataMap)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.pct - a.pct || b.total - a.total);

    if (!entries.length) {
      rankingEl.innerHTML = '';
      return;
    }

    rankingEl.innerHTML = entries
      .map((e, i) => {
        const tone = toneFor(e.pct);
        return `
        <div class="flex items-center gap-2 text-xs">
          <span class="w-4 text-right font-semibold text-slate-400 shrink-0 dark:text-slate-500">${i + 1}</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline justify-between gap-2">
              <span class="truncate font-medium text-slate-700 dark:text-slate-200" title="${escapeHtml(e.name)}">${escapeHtml(e.name)}</span>
              <span class="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">${fmt(e.total)} vhs</span>
            </div>
            <div class="mt-0.5 h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
              <div class="h-full rounded-full" style="width:${Math.min(e.pct, 100)}%; background:${tone}"></div>
            </div>
          </div>
          <span class="w-10 text-right font-bold shrink-0" style="color:${tone}">${e.pct.toFixed(0)}%</span>
        </div>`;
      })
      .join('');
  }

  function render(porEstado) {
    const box = byId('mapVzBox');
    const wrapper = byId('mapVzWrapper');
    const tooltipEl = byId('mapTooltip');
    const emptyEl = byId('mapEmpty');
    const rankingEl = byId('mapRanking');
    if (!box || !wrapper) return;

    const dataMap = buildDataMap(porEstado);
    const hasData = Object.keys(dataMap).length > 0;

    if (!hasData) {
      box.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      if (rankingEl) rankingEl.innerHTML = '';
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

    const dark = document.documentElement.classList.contains('dark');
    const noDataFill = dark ? '#334155' : '#E2E8F0';
    const strokeColor = dark ? '#1E293B' : '#FFFFFF';

    box.innerHTML = svgText;
    const svg = box.querySelector('svg');
    if (svg) {
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.width = '100%';
      svg.style.height = 'auto';
      svg.style.display = 'block';
    }

    box.querySelectorAll('path').forEach((path) => {
      const name = FleetConfig.resolveStateName(path.getAttribute('title'));
      const d = name ? dataMap[name] : null;
      path.classList.add('vz-state');
      path.setAttribute('stroke', strokeColor);
      path.setAttribute('stroke-width', '0.6');
      if (d) {
        path.setAttribute('fill', toneFor(d.pct));
        attachTooltip(wrapper, tooltipEl, path, name, d);
      } else {
        path.setAttribute('fill', noDataFill);
      }
    });

    if (rankingEl) renderRanking(rankingEl, dataMap);
  }

  return { render };
})();