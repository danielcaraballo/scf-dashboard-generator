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
    const fileNameEl = document.getElementById('fileName');
    const totalEl = document.getElementById('heroTotal');
    const fileName = fileNameEl ? fileNameEl.textContent.trim() : 'flota.csv';
    const totalRecords = totalEl ? totalEl.textContent.trim() : '0';
    const badgeTextEl = document.getElementById('activeFilterText');
    const badgeBox = document.getElementById('activeFilterBadge');
    let filterSubtitle = '';
    if (badgeBox && badgeTextEl && !badgeBox.classList.contains('hidden')) {
      filterSubtitle = badgeTextEl.textContent.trim();
    }
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    return { fileName, totalRecords, dateStr, filterSubtitle };
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

  function copyCanvases(source, target) {
    const sourceCanvases = source.querySelectorAll('canvas');
    const targetCanvases = target.querySelectorAll('canvas');

    sourceCanvases.forEach((srcCanvas, i) => {
      const destCanvas = targetCanvases[i];
      if (destCanvas && srcCanvas.width > 0 && srcCanvas.height > 0) {
        destCanvas.width = srcCanvas.width;
        destCanvas.height = srcCanvas.height;
        const ctx = destCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(srcCanvas, 0, 0);
        }
      }
    });
  }

  async function captureElement(element) {
    if (!window.html2canvas) {
      await new Promise((resolve) => {
        const check = setInterval(() => {
          if (window.html2canvas) { clearInterval(check); resolve(); }
        }, 50);
      });
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
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
        const seen = new Set();
        let node = walker.nextNode();
        while (node) {
          if (node.textContent.trim()) {
            const el = node.parentElement;
            if (el && !seen.has(el)) {
              seen.add(el);
              const cs = doc.defaultView.getComputedStyle(el);
              if (cs.textOverflow === 'ellipsis') {
                el.style.textOverflow = 'clip';
                el.style.whiteSpace = 'normal';
                el.style.overflow = 'visible';
              }
            }
          }
          node = walker.nextNode();
        }
      }
    });
  }

  async function exportPNG() {
    const btn = document.getElementById('imageBtn');
    const originalLabel = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = 'Generando PNG…';

    let wrapper = null;
    try {
      const reportArea = document.getElementById('reportArea');
      const { fileName, totalRecords, dateStr, filterSubtitle } = getMetadata();
      const escapeHtml = (window.FleetConfig && window.FleetConfig.escapeHtml) || ((s) => String(s ?? ''));
      const safeFileName = escapeHtml(fileName);
      const safeFilterSub = escapeHtml(filterSubtitle);
      const filterInfo = safeFilterSub ? ` &middot; <strong style="color: #0EA5E9; font-weight: 600;">${safeFilterSub}</strong>` : '';

      wrapper = document.createElement('div');
      wrapper.id = 'pngExportWrapper';
      wrapper.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 1280px;
        background-color: #FFFFFF;
        padding: 32px;
        box-sizing: border-box;
        font-family: 'Poppins', sans-serif;
        color: #0F172A;
      `;

      const clonedContent = reportArea.cloneNode(true);
      clonedContent.classList.remove('hidden');
      clonedContent.style.display = 'block';

      wrapper.innerHTML = `
        <div style="margin-bottom: 24px; background: #ffffff; border-radius: 6px; border: 1px solid #E2E8F0; padding: 24px 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h1 style="font-family: 'Poppins', sans-serif; font-size: 24px; font-weight: 700; color: #0F172A; margin: 0; line-height: 1.2;">Tablero de Control de Flota</h1>
            <p style="font-size: 13px; color: #64748B; margin: 4px 0 0 0;">
              Archivo: <strong style="color: #334155; font-weight: 600;">${safeFileName}</strong> &middot; Registros procesados: <strong style="color: #334155; font-weight: 600;">${totalRecords}</strong>${filterInfo}
            </p>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8; display: block; margin-bottom: 4px;">Fecha de Emisión</span>
            <span style="font-size: 13px; font-weight: 600; color: #334155; background: #F1F5F9; border: 1px solid #E2E8F0; padding: 6px 12px; border-radius: 8px; display: inline-block;">${dateStr}</span>
          </div>
        </div>
        <div id="pngReportBody" class="space-y-5">
        </div>
      `;

      const bodyContainer = wrapper.querySelector('#pngReportBody');
      bodyContainer.appendChild(clonedContent);

      document.body.appendChild(wrapper);
      copyCanvases(reportArea, wrapper);

      await new Promise((r) => setTimeout(r, 150));

      const canvas = await captureElement(wrapper);
      const link = document.createElement('a');
      link.download = `Reporte_Flota_${dateStamp()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Error al exportar PNG:', err);
      if (window.FleetUI) FleetUI.showError('No se pudo generar la imagen. Inténtalo de nuevo.');
    } finally {
      if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
      btn.disabled = false;
      btn.innerHTML = originalLabel;
    }
  }

  async function exportPDF() {
    const btn = document.getElementById('exportBtn');
    const originalLabel = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = 'Generando PDF…';

    let sectionWrappers = [];
    try {
      const sections = document.querySelectorAll('#reportArea [data-report-section]');
      const { fileName, totalRecords, dateStr, filterSubtitle } = getMetadata();

      const pdf = new jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      let fontsReady = false;
      try {
        fontsReady = await ensurePdfFonts(pdf);
      } catch (err) {
        fontsReady = false;
      }
      const pdfW = 297;
      const pdfH = 210;
      const marginX = 14;
      const marginY = 14;
      const contentW = pdfW - marginX * 2;
      const headerW = contentW;
      const headerX = marginX;
      const headerH = 24;
      const footerH = 10;

      const capturedSections = [];

      for (const section of sections) {
        const wrap = document.createElement('div');
        wrap.style.cssText = `
          position: absolute;
          left: -9999px;
          top: 0;
          width: 1280px;
          background-color: #FFFFFF;
          padding: 32px;
          box-sizing: border-box;
          font-family: 'Poppins', sans-serif;
        `;
        const cloned = section.cloneNode(true);
        wrap.appendChild(cloned);
        document.body.appendChild(wrap);
        copyCanvases(section, wrap);
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
        const boxH = 20;
        const cardRadius = 2;
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(headerX, marginY, headerW, boxH, cardRadius, cardRadius, 'FD');

        setPdfFont('Poppins', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(15, 23, 42);
        pdf.text('Tablero de Control de Flota', headerX + 7, marginY + 8);

        setPdfFont('Poppins', 'normal');
        pdf.setFontSize(8.5);
        const metaLabels = ['Archivo: ', ' · Registros: '];
        const metaValues = [fileName, totalRecords];
        if (filterSubtitle) {
          metaLabels.push(' · ');
          metaValues.push(filterSubtitle);
        }
        let metaX = headerX + 7;
        for (let i = 0; i < metaLabels.length; i++) {
          setPdfFont('Poppins', 'normal');
          pdf.setTextColor(100, 116, 139);
          pdf.text(metaLabels[i], metaX, marginY + 14);
          metaX += pdf.getTextWidth(metaLabels[i]);

          setPdfFont('Poppins', 'bold');
          pdf.setTextColor(i === 2 ? 14 : 51, i === 2 ? 165 : 65, i === 2 ? 233 : 85);
          pdf.text(metaValues[i], metaX, marginY + 14);
          metaX += pdf.getTextWidth(metaValues[i]);
        }

        const labelText = 'FECHA DE EMISIÓN';
        setPdfFont('Poppins', 'bold');
        pdf.setFontSize(6.5);
        pdf.setTextColor(148, 163, 184);
        const labelWidth = pdf.getTextWidth(labelText);
        pdf.text(labelText, headerX + headerW - 7 - labelWidth, marginY + 6.5);

        const badgeText = dateStr;
        setPdfFont('Poppins', 'bold');
        pdf.setFontSize(8);
        const badgeW = pdf.getTextWidth(badgeText) + 8;
        const badgeH = 6.5;
        const badgeX = headerX + headerW - 7 - badgeW;
        const badgeY = marginY + 8.5;
        pdf.setFillColor(241, 245, 249);
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(badgeX, badgeY, badgeW, badgeH, 1, 1, 'FD');

        pdf.setTextColor(51, 65, 85);
        pdf.text(badgeText, badgeX + 4, badgeY + 4.3);
      }

      let cursorY = marginY + headerH;

      for (let i = 0; i < capturedSections.length; i++) {
        const s = capturedSections[i];
        if (cursorY + s.imgH > pdfH - marginY - footerH && cursorY > marginY + headerH) {
          pdf.addPage();
          drawHeader();
          cursorY = marginY + headerH;
        }

        if (i === 0 && pdf.getNumberOfPages() === 1) {
          drawHeader();
        }

        pdf.addImage(s.imgData, 'JPEG', marginX, cursorY, contentW, s.imgH);
        cursorY += s.imgH + 5;
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
      btn.disabled = false;
      btn.innerHTML = originalLabel;
    }
  }

  return {
    dateStamp,
    getMetadata,
    ensurePdfFonts,
    copyCanvases,
    captureElement,
    exportPNG,
    exportPDF
  };
})();
