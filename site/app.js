import { demoReport } from './demo.js';
import { validateReport } from './report-schema.js';
const $ = s => document.querySelector(s);
const photos = [];
let currentReport, isDemo = false, busy = false;
const apiBase = (window.APP_CONFIG?.apiBase || '').replace(/\/$/, '');
$('#connection-note').textContent = apiBase ? '照片在本地压缩后分析 · 预计需要 20—60 秒' : '正式分析待接通 · 可以先点上方「先看一份样片」';
function status(message, error = false) { $('#status').textContent = message; $('#status').classList.toggle('error', error); }
function setBusy(value) {
  busy = value;
  for (const el of document.querySelectorAll('#studio button, #studio input, #studio select, #demo, #start-over')) el.disabled = value;
  $('#analyze').textContent = value ? '正在发现你的生活美学…' : '生成我的电影 ✦';
}
async function compress(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let data = canvas.toDataURL('image/jpeg', .8);
    if (data.length > 1_000_000) data = canvas.toDataURL('image/jpeg', .55);
    if (data.length > 1_100_000) throw Error('这张照片压缩后仍过大，请换一张较小的照片。');
    return { data, name: file.name };
  } finally { URL.revokeObjectURL(url); }
}
function renderPhotos() {
  $('#photo-list').replaceChildren();
  photos.forEach((photo, index) => {
    const item = document.createElement('div'); item.className = 'photo-item';
    const img = document.createElement('img'); img.src = photo.data; img.alt = `第 ${index + 1} 张：${photo.name}`;
    const button = document.createElement('button'); button.textContent = '×'; button.disabled = busy; button.setAttribute('aria-label', `删除第 ${index + 1} 张照片`);
    button.onclick = () => { photos.splice(index, 1); renderPhotos(); };
    item.append(img, button); $('#photo-list').append(item);
  });
}
async function addFiles(files) {
  if (busy) return;
  setBusy(true); let rejected = 0;
  try {
    for (const file of files) {
      if (photos.length >= 9) { rejected++; continue; }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) { rejected++; continue; }
      try { photos.push(await compress(file)); } catch { rejected++; }
    }
    status(`已选择 ${photos.length} / 9 张照片。${rejected ? `有 ${rejected} 张未添加（超出数量、格式不支持、图片损坏或文件过大）。` : ''}`, rejected > 0);
  } finally { setBusy(false); renderPhotos(); $('#photos').value = ''; }
}
$('#photos').onchange = e => addFiles([...e.target.files]);
const zone = $('#dropzone');
zone.ondragover = e => { e.preventDefault(); zone.classList.add('dragging'); };
zone.ondragleave = () => zone.classList.remove('dragging');
zone.ondrop = e => { e.preventDefault(); zone.classList.remove('dragging'); addFiles([...e.dataTransfer.files]); };
$('#analyze').onclick = async () => {
  if (!apiBase) return status('正式分析尚未接通。请先体验样片，部署者配置 API 地址后即可使用。', true);
  if (photos.length < 3) return status('请先选择 3—9 张生活照片。', true);
  if (!$('#consent').checked) return status('请先阅读并勾选照片分析授权。', true);
  setBusy(true); status('正在从色彩、光线、构图和细节，寻找你的专属电影…');
  try {
    const response = await fetch(`${apiBase}/api/analyze`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({images:photos.map(p => p.data), mood:$('#mood').value}), signal:AbortSignal.timeout(100_000) });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || '分析暂时未完成，请稍后重试。');
    if (!validateReport(data, photos.length)) throw Error('报告格式不完整，请重新生成。');
    await showReport(data, false); status('你的电影已上映。可以保存海报，也可以继续拍下一部。');
  } catch (error) { status(error.name === 'TimeoutError' ? '这次分析用时较长，请稍后重试。' : error.message || '网络连接失败，请稍后重试。', true); }
  finally { setBusy(false); renderPhotos(); }
};
function element(tag, text, className) { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; }
async function showReport(report, demo) {
  currentReport = report; isDemo = demo;
  $('#result-label').textContent = demo ? 'DEMO / 创意样片 · 非上传照片分析' : 'YOUR PRIVATE PREMIERE / 专属首映';
  const container = $('#report'); container.replaceChildren();
  container.append(element('p', `「${report.archetype}」`, 'report-intro'));
  const tags = element('div', '', 'tags'); report.tags.forEach(t => tags.append(element('span', t))); container.append(tags);
  const intro = element('article', '', 'report-block'); intro.append(element('h3', '导演评语'), element('p', report.review)); container.append(intro);
  for (const observation of report.observations) {
    const block = element('article', '', 'report-block'); block.append(element('h3', observation.dimension), element('strong', observation.title), element('p', observation.evidence, 'evidence'), element('p', observation.interpretation), element('p', `${demo ? '样片插画' : '照片'} ${observation.photos.join('、')}`, 'evidence')); container.append(block);
  }
  const palette = element('div', '', 'palette'); report.palette.forEach(color => { const swatch = element('span', '', 'swatch'); swatch.style.backgroundColor = color; swatch.title = color; palette.append(swatch); });
  const colors = element('article', '', 'report-block'); colors.append(element('h3', '你的电影调色盘'), palette); container.append(colors);
  const tips = element('article', '', 'report-block'); tips.append(element('h3', '下一幕，可以这样拍'));
  report.suggestions.forEach(s => tips.append(element('strong', s.title), element('p', s.detail))); container.append(tips);
  $('#result').hidden = false; await document.fonts.ready; await drawPoster(); $('#result').scrollIntoView({behavior:'smooth'});
}
$('#demo').onclick = () => showReport(demoReport, true).catch(() => status('样片绘制失败，请刷新页面后重试。', true));
$('#start-over').onclick = () => $('#studio').scrollIntoView({behavior:'smooth'});
function wrap(ctx, text, x, y, maxWidth, lineHeight, maxLines = 10) {
  let line = '', lines = [];
  for (const char of text) {
    if (ctx.measureText(line + char).width > maxWidth && line) { lines.push(line); line = char; } else line += char;
  }
  if (line) lines.push(line);
  lines = lines.slice(0, maxLines);
  lines.forEach((value, i) => ctx.fillText(value, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}
function cover(ctx, img, x, y, w, h) {
  const ratio = Math.max(w / img.width, h / img.height), sw = w / ratio, sh = h / ratio;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}
async function drawPoster() {
  const canvas = $('#poster'), ctx = canvas.getContext('2d'), r = currentReport;
  ctx.fillStyle = '#f8f4e9'; ctx.fillRect(0, 0, 1080, 1440); ctx.fillStyle = '#293d30'; ctx.textAlign = 'left'; ctx.font = '20px Arial'; ctx.fillText('DAILY CINEMA / 日常有戏', 60, 65); ctx.textAlign = 'right'; ctx.fillText(isDemo ? '创意样片 · DEMO' : 'A FILM BY YOU', 1020, 65);
  if (!isDemo) {
    const source = photos.slice(0, 3).map(p => p.data);
    const images = await Promise.all(source.map(src => { const img = new Image(); img.src = src; return img.decode().then(() => img); }));
    cover(ctx, images[0], 60, 100, 960, 650);
    for (let i = 1; i < images.length; i++) cover(ctx, images[i], 60 + (i - 1) * 488, 766, 472, 185);
  } else {
    ctx.save(); ctx.beginPath(); ctx.rect(60, 100, 960, 850); ctx.clip();
    ctx.fillStyle = '#c5ceba'; ctx.fillRect(60, 100, 960, 850);
    ctx.fillStyle = '#f1d6a1'; ctx.beginPath(); ctx.arc(805, 280, 100, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#99a888'; ctx.beginPath(); ctx.ellipse(420, 740, 580, 330, -.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#bca17a'; ctx.fillRect(60, 680, 960, 270);
    ctx.fillStyle = '#eee6cd'; ctx.fillRect(340, 100, 22, 580); ctx.fillRect(60, 470, 960, 22);
    ctx.fillStyle = '#f5ecd7'; ctx.beginPath(); ctx.roundRect(650, 690, 135, 130, [5,5,45,45]); ctx.fill(); ctx.strokeStyle = '#f5ecd7'; ctx.lineWidth = 18; ctx.beginPath(); ctx.arc(790, 735, 30, -.5 * Math.PI, .5 * Math.PI); ctx.stroke();
    ctx.fillStyle = '#c78358'; ctx.beginPath(); ctx.roundRect(260, 640, 95, 170, [8,8,25,25]); ctx.fill(); ctx.strokeStyle = '#667b4b'; ctx.lineWidth = 7;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(305, 650); ctx.lineTo(245 + i * 65, 400 - i * 25); ctx.stroke(); ctx.fillStyle = '#738455'; ctx.beginPath(); ctx.ellipse(245 + i * 65, 435 - i * 25, 42, 15, -.5 + i * .5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#73806b'; ctx.font = '20px "Microsoft YaHei"'; ctx.fillText(isDemo ? '样片放映 · 非个人测评结果' : `${($('#nickname').value.trim() || '你').slice(0,16)} 的私人放映`, 540, 1005);
  ctx.fillStyle = '#293d30'; let titleSize = 65; ctx.font = `600 ${titleSize}px "Noto Serif SC", SimSun, serif`;
  while (ctx.measureText(r.title).width > 930 && titleSize > 32) { titleSize--; ctx.font = `600 ${titleSize}px "Noto Serif SC", SimSun, serif`; }
  ctx.fillText(r.title, 540, 1100);
  ctx.font = '25px "Microsoft YaHei"'; ctx.fillStyle = '#71806c'; wrap(ctx, r.subtitle, 540, 1170, 880, 37, 2);
  ctx.font = '22px "Microsoft YaHei"'; ctx.fillText(r.tags.join('    /    '), 540, 1270);
  ctx.strokeStyle = '#cdd2bf'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(60, 1320); ctx.lineTo(1020, 1320); ctx.stroke(); ctx.fillStyle = '#6b775f'; ctx.font = '20px "Microsoft YaHei"'; ctx.fillText(r.invitation, 540, 1362); ctx.font = '14px Arial'; ctx.fillText('AI 创意解读 · 生活没有标准答案 · 日常有戏', 540, 1404);
}
function posterBlob() { return new Promise((resolve, reject) => $('#poster').toBlob(blob => blob ? resolve(blob) : reject(Error('图片导出失败')), 'image/png')); }
$('#save-poster').onclick = async () => {
  try { const blob = await posterBlob(), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `日常有戏-${currentReport.title}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 20_000); }
  catch { status('保存失败，请尝试长按或右键海报保存图片。', true); }
};
$('#share').onclick = async () => {
  try {
    const file = new File([await posterBlob()], '我的生活电影.png', {type:'image/png'});
    if (navigator.canShare?.({files:[file]})) await navigator.share({files:[file], title:currentReport.title, text:currentReport.invitation});
    else { $('#save-poster').click(); status('海报已准备下载，保存后可以发给朋友。'); }
  } catch (e) { if (e.name !== 'AbortError') status('当前浏览器未能直接分享，请使用「保存海报」。', true); }
};
$('#privacy').onclick = () => $('#privacy-dialog').showModal();
$('#close-privacy').onclick = () => $('#privacy-dialog').close();
