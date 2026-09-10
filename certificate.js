// Сертификат рисуется локально. Системные шрифты поддерживают кириллицу;
// загружать шрифты, отправлять имя или подключать библиотеки не требуется.
function drawCertificate(canvas, profile, courseTitle, score, date) {
  canvas.width = 2400;
  canvas.height = 1697;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#314d98';
  ctx.lineWidth = 5;
  ctx.strokeRect(65, 65, 2270, 1567);
  ctx.strokeStyle = '#c5a356';
  ctx.lineWidth = 2;
  ctx.strokeRect(88, 88, 2224, 1521);
  // Угловой орнамент.
  [[110, 110], [2290, 110], [110, 1587], [2290, 1587]].forEach(([x, y]) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#c5a356'; ctx.fillRect(-10, -10, 20, 20); ctx.restore();
  });
  const line = (text, y, size, color = '#283d6b', weight = '400', maxWidth = 2040) => {
    let fit = size;
    ctx.font = `${weight} ${fit}px "Segoe UI", Arial, sans-serif`;
    while (ctx.measureText(text).width > maxWidth && fit > 10) {
      fit--; ctx.font = `${weight} ${fit}px "Segoe UI", Arial, sans-serif`;
    }
    ctx.textAlign = 'center'; ctx.fillStyle = color;
    ctx.fillText(text, 1200, y);
  };
  ctx.fillStyle = '#4b5ee8'; ctx.fillRect(914, 175, 85, 85);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '700 34px Consolas, monospace'; ctx.fillText('<D>', 957, 230);
  ctx.textAlign = 'left'; ctx.fillStyle = '#314d98'; ctx.font = '700 66px "Segoe UI", Arial, sans-serif'; ctx.fillText('DavCode', 1020, 243);
  line('УЧИСЬ И СОЗДАВАЙ', 305, 23, '#7f889c');
  line('Сертификат', 485, 126, '#283d6b', '600');
  line('об успешном прохождении учебного направления', 560, 35, '#7c8292');
  // Две строки и подбор размера позволяют разместить длинные фамилию и имя.
  line(profile.surname, 725, 82, '#314d98', '600');
  line(profile.name, 825, 82, '#314d98', '600');
  line(`Класс: ${profile.className}`, 905, 36, '#7c8292');
  ctx.strokeStyle = '#c5a356'; ctx.beginPath(); ctx.moveTo(925, 960); ctx.lineTo(1475, 960); ctx.stroke();
  line(courseTitle, 1070, 66, '#283d6b', '600');
  line(`Лучший результат теста: ${score}%`, 1150, 37);
  line(`Дата выдачи: ${date}`, 1225, 32, '#7c8292');
  line('Автор проекта: Русинов Давид, 11А класс', 1430, 31);
  line('Учебный сертификат школьного проекта', 1500, 26, '#8c815f');
  return canvas;
}

// Небольшой PDF-экспортёр: одна страница A4 с JPEG-изображением Canvas.
// Смещения xref вычисляются в байтах. Это настоящий PDF, не окно печати.
function certificatePdf(canvas) {
  const encoded = canvas.toDataURL('image/jpeg', 0.97).split(',')[1];
  const raw = atob(encoded);
  const jpeg = Uint8Array.from(raw, char => char.charCodeAt(0));
  const encoder = new TextEncoder();
  const parts = [], offsets = [0];
  let size = 0;
  const append = value => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    parts.push(bytes); size += bytes.length;
  };
  const object = (id, value) => { offsets[id] = size; append(`${id} 0 obj\n${value}\nendobj\n`); };
  append('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  offsets[4] = size;
  append(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  append(jpeg); append('\nendstream\nendobj\n');
  const commands = 'q\n841.89 0 0 595.28 0 0 cm\n/Im0 Do\nQ\n';
  object(5, `<< /Length ${encoder.encode(commands).length} >>\nstream\n${commands}endstream`);
  const xref = size;
  append('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) append(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  append(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

function downloadCertificate(blob, filename) {
  if (!blob) throw new Error('Не удалось создать файл.');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
