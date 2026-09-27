// utils/exportacao.js — geração de PDF (pdfkit) e planilha .xlsx (exceljs)
// para os relatórios (RF_29a). Sem binários externos (JS puro, ok no Alpine).
//
// `colunas` = [{ header, key }]`; `linhas` = objetos com as chaves de `key`.
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

/**
 * Gera um PDF simples (título + linhas no formato "coluna: valor"). Retorna
 * um Buffer. Aceentos usam a fonte padrão (Helvetica), que suporta Latin-1.
 */
async function gerarPdf({ titulo, colunas, linhas }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(titulo, { align: 'center' });
    doc.moveDown();

    if (!linhas.length) {
      doc.fontSize(11).text('Nenhum dado encontrado para os filtros aplicados.');
    } else {
      doc.fontSize(10);
      for (const [i, linha] of linhas.entries()) {
        if (i > 0) doc.moveDown(0.4);
        doc.text(colunas.map((c) => `${c.header}: ${linha[c.key] ?? ''}`).join(' | '));
      }
    }

    doc.moveDown();
    doc
      .fontSize(8)
      .fillColor('gray')
      .text(`Gerado pelo ConectaBem.net em ${new Date().toLocaleString('pt-BR')}`, {
        align: 'right',
      });
    doc.end();
  });
}

/** Gera uma planilha .xlsx com cabeçalho em negrito. Retorna um Buffer. */
async function gerarXlsx({ titulo, colunas, linhas }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet((titulo || 'Relatório').slice(0, 31));
  sheet.addRow(colunas.map((c) => c.header)).font = { bold: true };
  for (const linha of linhas) {
    sheet.addRow(colunas.map((c) => linha[c.key] ?? ''));
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export { gerarPdf, gerarXlsx };
