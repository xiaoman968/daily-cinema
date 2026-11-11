import { SYSTEM_PROMPT } from './prompt.js';
import { validateReport } from '../site/report-schema.js';
const MAX_BODY = 10_000_000;
const MOODS = new Set(['让照片自己说话','平淡里有小确幸','正在慢慢找回自己','想留住这段好时光','忙碌，也认真生活']);
function headers(origin) { return {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}; }
function json(data, status, origin) { return new Response(JSON.stringify(data), {status, headers:headers(origin)}); }
export function validInput(data) {
  return data && Array.isArray(data.images) && data.images.length >= 3 && data.images.length <= 9 && data.images.every(s => typeof s === 'string' && s.length <= 1_100_000 && /^data:image\/jpeg;base64,\/[9]j\/[A-Za-z0-9+/]*={0,2}$/.test(s)) && MOODS.has(data.mood);
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!origin || !allowed.includes(origin)) return json({error:'当前网站未获准访问此分析接口。'}, 403, 'null');
    if (new URL(request.url).pathname !== '/api/analyze') return json({error:'接口不存在。'}, 404, origin);
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:headers(origin)});
    if (request.method !== 'POST') return json({error:'请使用 POST 请求。'}, 405, origin);
    if (!env.DASHSCOPE_API_KEY) return json({error:'分析服务尚未配置，请先体验样片。'}, 503, origin);
    if (!env.RATE_LIMITER) return json({error:'分析服务尚未配置请求限额。'}, 503, origin);
    const { success } = await env.RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP') || 'unknown'});
    if (!success) return json({error:'分析次数较多，请一分钟后再试。'}, 429, origin);
    if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return json({error:'请求格式需要为 JSON。'}, 415, origin);
    if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY) return json({error:'照片数据过大，请减少照片数量。'}, 413, origin);
    let data;
    try {
      const reader = request.body?.getReader(); if (!reader) throw Error();
      const chunks = []; let size = 0;
      while (true) { const {done,value} = await reader.read(); if (done) break; size += value.length; if (size > MAX_BODY) { await reader.cancel(); return json({error:'照片数据过大，请减少照片数量。'}, 413, origin); } chunks.push(value); }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
      data = JSON.parse(new TextDecoder().decode(bytes));
    } catch { return json({error:'请求内容无法读取。'}, 400, origin); }
    if (!validInput(data)) return json({error:'请上传 3—9 张有效的生活照片，并选择生活底色。'}, 400, origin);
    const content = [{type:'text', text:`按上传顺序分析以下${data.images.length}张照片。用户选择的创作意向：${data.mood}。请严格输出指定JSON。`}, ...data.images.map(url => ({type:'image_url', image_url:{url}}))];
    let upstream;
    try {
      upstream = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.DASHSCOPE_API_KEY}`}, body:JSON.stringify({model:env.QWEN_MODEL || 'qwen3-vl-plus', enable_thinking:false, messages:[{role:'system',content:SYSTEM_PROMPT},{role:'user',content}], max_tokens:3200, temperature:.75, response_format:{type:'json_object'}}), signal:AbortSignal.timeout(85_000)});
    } catch { return json({error:'模型连接超时或网络暂不可用，请稍后重试。'}, 504, origin); }
    if (!upstream.ok) {
      const message = upstream.status === 401 ? '模型服务鉴权失败，请站点管理员检查密钥及地域配置。' : upstream.status === 429 ? '模型服务繁忙或额度不足，请稍后重试。' : '模型暂时无法完成分析，请稍后重试。';
      return json({error:message}, 502, origin);
    }
    try {
      const result = await upstream.json();
      const text = result.choices?.[0]?.message?.content;
      if (typeof text !== 'string') throw Error();
      const report = JSON.parse(text.replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,''));
      if (!validateReport(report, data.images.length)) throw Error();
      return json(report, 200, origin);
    } catch { return json({error:'这次报告没有生成完整，请重新尝试。'}, 502, origin); }
  }
};
