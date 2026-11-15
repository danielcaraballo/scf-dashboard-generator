window.FleetExport = (function () {
  const PDF_FONT_SOURCES = [
    {
      url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Regular.ttf',
      fileName: 'Poppins-Regular.ttf',
      fontName: 'Poppins',
      style: 'normal'
    },
    {
      url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf',
      fileName: 'Poppins-Bold.ttf',
      fontName: 'Poppins',
      style: 'bold'
    },
    {
      url: 'https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/fonts/ttf/JetBrainsMono-Regular.ttf',
      fileName: 'JetBrainsMono-Regular.ttf',
      fontName: 'JetBrainsMono',
      style: 'normal'
    },
    {
      url: 'https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/fonts/ttf/JetBrainsMono-SemiBold.ttf',
      fileName: 'JetBrainsMono-SemiBold.ttf',
      fontName: 'JetBrainsMono',
      style: 'bold'
    }
  ];

  const pdfFontBase64Cache = new Map();

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  function dateStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function getMetadata() {
    const badgeTextEl = document.getElementById('activeFilterText');
    const badgeBox = document.getElementById('activeFilterBadge');
    let filterSubtitle = '';
    if (badgeBox && badgeTextEl && !badgeBox.classList.contains('hidden')) {
      filterSubtitle = badgeTextEl.textContent.trim();
    }
    const now = new Date();
    const dateStr = now.toLocaleDateString('es', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    return { dateStr, filterSubtitle };
  }

  async function ensurePdfFonts(pdf) {
    for (const f of PDF_FONT_SOURCES) {
      let base64 = pdfFontBase64Cache.get(f.url);
      if (!base64) {
        const res = await fetch(f.url);
        if (!res.ok) return false;
        base64 = await blobToBase64(await res.blob());
        pdfFontBase64Cache.set(f.url, base64);
      }
      pdf.addFileToVFS(f.fileName, base64);
      pdf.addFont(f.fileName, f.fontName, f.style);
    }
    return true;
  }

  function prefetchFonts() {
    if (typeof window === 'undefined' || !window.fetch) return;
    const run = () => {
      Promise.allSettled(
        PDF_FONT_SOURCES.map(async (f) => {
          if (pdfFontBase64Cache.has(f.url)) return;
          try {
            const res = await fetch(f.url);
            if (res.ok) {
              const base64 = await blobToBase64(await res.blob());
              pdfFontBase64Cache.set(f.url, base64);
            }
          } catch (e) {
          }
        })
      );
    };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 3000 });
    } else {
      setTimeout(run, 1500);
    }
  }

  async function captureElement(element) {
    if (!window.html2canvas) {
      await new Promise((resolve) => {
        let attempts = 0;
        const check = setInterval(() => {
          attempts++;
          if (window.html2canvas || attempts >= 80) {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });
    }
    if (!window.html2canvas) {
      throw new Error('La librería html2canvas no está disponible.');
    }
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    return html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#FFFFFF',
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      scrollX: 0,
      scrollY: 0,
      onclone: (doc) => {
        if (doc.documentElement) {
          doc.documentElement.classList.remove('dark');
        }
        doc.querySelectorAll('.vz-state').forEach((p) => {
          if (p.getAttribute('data-mini-target') === 'true') {
            p.setAttribute('stroke', '#0EA5E9');
            p.setAttribute('stroke-width', '2.2');
            return;
          }
          p.classList.remove('active-state', 'is-hovered', 'is-dimmed');
          p.setAttribute('stroke', '#CBD5E1');
          if (!p.getAttribute('fill') || p.getAttribute('fill').toUpperCase() === '#334155') {
            p.setAttribute('fill', '#CBD5E1');
          }
        });
        doc.querySelectorAll('.state-badge').forEach((b) => {
          b.classList.remove('active-badge', 'is-hovered', 'is-dimmed');
          const rect = b.querySelector('rect');
          if (rect) rect.setAttribute('fill', '#FFFFFF');
          const textTspans = b.querySelectorAll('tspan');
          if (textTspans[0]) textTspans[0].setAttribute('fill', '#0F172A');
        });
        const cloneLeaderLines = doc.querySelector('#leaderLinesGroup');
        if (cloneLeaderLines) {
          cloneLeaderLines.querySelectorAll('line').forEach((l) => l.setAttribute('stroke', '#94A3B8'));
          cloneLeaderLines.querySelectorAll('circle').forEach((c) => c.setAttribute('fill', '#64748B'));
        }
        const cloneGenPanel = doc.querySelector('#mapGeneralPanel');
        const cloneInspPanel = doc.querySelector('#mapInspectorPanel');
        if (cloneGenPanel && cloneInspPanel) {
          cloneGenPanel.classList.remove('hidden');
          cloneInspPanel.classList.add('hidden');
          cloneInspPanel.classList.remove('flex');
        }
        doc.querySelectorAll('.truncate, [style*="ellipsis"]').forEach((el) => {
          el.style.textOverflow = 'clip';
          el.style.whiteSpace = 'normal';
          el.style.overflow = 'visible';
        });
      }
    });
  }

  async function exportPDF() {
    const btn = document.getElementById('exportBtn');
    const originalLabel = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = 'Generando PDF…';

    let sectionWrappers = [];
    try {
      const lr = window.FleetUI && window.FleetUI.getLastResult ? window.FleetUI.getLastResult() : null;
      const analysis = lr ? lr.analysis : null;
      const { dateStr, filterSubtitle } = getMetadata();

      const pdf = new jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
      let fontsReady = false;
      try {
        fontsReady = await ensurePdfFonts(pdf);
      } catch (err) {
        fontsReady = false;
      }
      const pdfW = 279.4;
      const pdfH = 215.9;
      const marginX = 14;
      const marginY = 12;
      const contentW = pdfW - marginX * 2;
      const headerW = contentW;
      const headerX = marginX;
      const headerH = 18;
      const footerH = 8;

      const sectionsToCapture = Array.from(
        document.querySelectorAll('#reportArea [data-report-section]')
      ).filter(
        (el) => !el.hasAttribute('data-report-exclude') && el.offsetParent !== null
      );

      const capturedSections = [];

      for (const sectionEl of sectionsToCapture) {
        const wrap = document.createElement('div');
        wrap.style.cssText = `
          position: absolute;
          left: -9999px;
          top: 0;
          width: 1280px;
          background-color: #FFFFFF;
          padding: 24px 32px;
          box-sizing: border-box;
          font-family: 'Poppins', sans-serif;
        `;

        const cloned = sectionEl.cloneNode(true);
        cloned.querySelectorAll('[data-report-exclude]').forEach((e) => e.remove());
        wrap.appendChild(cloned);

        document.body.appendChild(wrap);
        if (window.FleetCharts && window.FleetCharts.renderLightChartsIn) {
          window.FleetCharts.renderLightChartsIn(wrap, analysis);
        }
        sectionWrappers.push(wrap);

        await new Promise((r) => setTimeout(r, 100));

        const canvas = await captureElement(wrap);
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgH = (canvas.height * contentW) / canvas.width;
        capturedSections.push({ imgData, imgH });
      }

      function setPdfFont(family, style) {
        if (fontsReady) {
          pdf.setFont(family, style);
        } else if (family === 'JetBrainsMono') {
          pdf.setFont('courier', style === 'bold' ? 'bold' : 'normal');
        } else {
          pdf.setFont('helvetica', style === 'bold' ? 'bold' : 'normal');
        }
      }

      const drawHeader = () => {
        setPdfFont('Poppins', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(15, 23, 42);
        pdf.text('Tablero de Control de Flota', headerX, marginY + 4.5);

        const dateLabel = 'FECHA DE EMISIÓN';
        setPdfFont('Poppins', 'bold');
        pdf.setFontSize(6.5);
        pdf.setTextColor(148, 163, 184);
        const labelW = pdf.getTextWidth(dateLabel);
        pdf.text(dateLabel, headerX + headerW - labelW, marginY + 3.5);

        setPdfFont('Poppins', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(51, 65, 85);
        const dateW = pdf.getTextWidth(dateStr);
        pdf.text(dateStr, headerX + headerW - dateW, marginY + 8);

        if (filterSubtitle) {
          setPdfFont('Poppins', 'bold');
          pdf.setFontSize(8.5);
          pdf.setTextColor(14, 165, 233);
          pdf.text(filterSubtitle, headerX, marginY + 11.5);
        }

        pdf.setDrawColor(14, 165, 233);
        pdf.setLineWidth(0.5);
        pdf.line(headerX, marginY + 14.5, headerX + headerW, marginY + 14.5);
      };

      let cursorY = marginY + headerH;

      for (let i = 0; i < capturedSections.length; i++) {
        const s = capturedSections[i];
        if (i > 0) {
          pdf.addPage();
          drawHeader();
          cursorY = marginY + headerH;
        } else if (pdf.getNumberOfPages() === 1) {
          drawHeader();
        }

        let drawH = s.imgH;
        let drawW = contentW;
        let drawX = marginX;
        const maxAvailH = pdfH - marginY - footerH - cursorY;
        if (drawH > maxAvailH) {
          const scale = maxAvailH / drawH;
          drawH = maxAvailH;
          drawW = contentW * scale;
          drawX = marginX + (contentW - drawW) / 2;
        }

        pdf.addImage(s.imgData, 'JPEG', drawX, cursorY, drawW, drawH);
        cursorY += drawH + 4;
      }

      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.3);
        pdf.line(marginX, pdfH - marginY - 4, pdfW - marginX, pdfH - marginY - 4);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text('Tablero de Control de Flota', marginX, pdfH - marginY);

        const pageStr = `Página ${p} de ${totalPages}`;
        const pageWidth = pdf.getTextWidth(pageStr);
        pdf.text(pageStr, pdfW - marginX - pageWidth, pdfH - marginY);
      }

      pdf.save(`Reporte_Flota_${dateStamp()}.pdf`);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      if (window.FleetUI) FleetUI.showError('No se pudo generar el PDF. Inténtalo de nuevo.');
    } finally {
      sectionWrappers.forEach((w) => {
        if (w && w.parentNode) w.parentNode.removeChild(w);
      });
      if (window.FleetCharts && window.FleetCharts.destroyExportCharts) {
        window.FleetCharts.destroyExportCharts();
      }
      btn.disabled = false;
      btn.innerHTML = originalLabel;
    }
  }

  prefetchFonts();

  return {
    dateStamp,
    getMetadata,
    ensurePdfFonts,
    prefetchFonts,
    captureElement,
    exportPDF
  };
})();
