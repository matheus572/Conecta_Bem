// utils/exportacao.js — geração de PDF (pdfkit) e planilha .xlsx (exceljs)
// para os relatórios (RF_29a). Sem binários externos (JS puro, ok no Alpine).
//
// `colunas` = [{ header, key }]`; `linhas` = objetos com as chaves de `key`.
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

/** Normaliza o payload para uma lista de seções ({ subtitulo, colunas, linhas }). */
function secoesDe(payload) {
  if (Array.isArray(payload.secoes)) return payload.secoes;
  return [{ subtitulo: null, colunas: payload.colunas, linhas: payload.linhas }];
}

/**
 * Gera um PDF simples (título + linhas no formato "coluna: valor"). Retorna
 * um Buffer. Aceentos usam a fonte padrão (Helvetica), que suporta Latin-1.
 * Aceita uma seção única ({colunas, linhas}) ou várias ({secoes}).
 */
async function gerarPdf({ titulo, ...resto }) {
  const secoes = secoesDe(resto);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(titulo, { align: 'center' });
    doc.moveDown();

    for (const [s, secao] of secoes.entries()) {
      if (s > 0) doc.moveDown();
      if (secao.subtitulo) {
        doc.fontSize(12).text(secao.subtitulo);
        doc.moveDown(0.3);
      }
      if (!secao.linhas.length) {
        doc.fontSize(10).text('Nenhum dado encontrado para os filtros aplicados.');
      } else {
        doc.fontSize(9);
        for (const [i, linha] of secao.linhas.entries()) {
          if (i > 0) doc.moveDown(0.3);
          doc.text(secao.colunas.map((c) => `${c.header}: ${linha[c.key] ?? ''}`).join(' | '));
        }
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

/** Gera uma planilha .xlsx com cabeçalho em negrito (uma aba por seção). */
async function gerarXlsx({ titulo, ...resto }) {
  const secoes = secoesDe(resto);
  const workbook = new ExcelJS.Workbook();
  for (const [i, secao] of secoes.entries()) {
    const nome = ((secao.subtitulo || titulo || 'Relatório') + (i ? ` ${i + 1}` : '')).slice(0, 31);
    const sheet = workbook.addWorksheet(nome);
    sheet.addRow(secao.colunas.map((c) => c.header)).font = { bold: true };
    for (const linha of secao.linhas) {
      sheet.addRow(secao.colunas.map((c) => linha[c.key] ?? ''));
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export { gerarPdf, gerarXlsx };
