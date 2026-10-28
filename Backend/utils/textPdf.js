function escapePdfText(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/([\\()])/g, "\\$1");
}

function createTextPdf(lines) {
  const wrappedLines = lines.flatMap((line) => {
    const text = String(line);
    if (!text) return [""];
    const chunks = [];
    for (let offset = 0; offset < text.length; offset += 92) chunks.push(text.slice(offset, offset + 92));
    return chunks;
  });
  const pageLines = [];
  for (let offset = 0; offset < wrappedLines.length; offset += 38) pageLines.push(wrappedLines.slice(offset, offset + 38));
  if (pageLines.length === 0) pageLines.push([]);

  const objects = [];
  const pageObjectIds = pageLines.map((_, index) => 4 + index * 2);
  const contentObjectIds = pageLines.map((_, index) => 5 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageLines.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  pageLines.forEach((linesOnPage, index) => {
    const pageId = pageObjectIds[index];
    const contentId = contentObjectIds[index];
    const commands = ["BT", "/F1 10 Tf"];
    let y = 752;
    for (const line of linesOnPage) {
      commands.push(`1 0 0 1 48 ${y} Tm (${escapePdfText(line)}) Tj`);
      y -= 18;
    }
    commands.push("ET");
    const stream = commands.join("\n");
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(pdf, "ascii");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}

module.exports = createTextPdf;
