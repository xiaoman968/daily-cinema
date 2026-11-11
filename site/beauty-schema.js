export function validateBeauty(r) {
  const s=(v,n=400)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
  const score=v=>Number.isFinite(v)&&v>=0&&v<=10;
  if(!r||!s(r.kind,20))return false;
  if(r.kind==='unusable')return s(r.reason,180);
  return r.kind==='beauty'&&score(r.score)&&s(r.style,16)&&s(r.headline,40)&&s(r.summary)&&s(r.photoNote,180)&&s(r.shareLine,60)
    &&Array.isArray(r.tags)&&r.tags.length===3&&r.tags.every(v=>s(v,12))
    &&Array.isArray(r.features)&&r.features.length===5&&r.features.every(f=>f&&s(f.name,12)&&score(f.score)&&s(f.observation,160)&&s(f.highlight,160))
    &&Array.isArray(r.guides)&&r.guides.length===4&&r.guides.every(g=>g&&s(g.category,12)&&s(g.title,24)&&s(g.why,160)&&s(g.steps,240))
    &&Array.isArray(r.palette)&&r.palette.length===4&&r.palette.every(c=>c&&/^#[0-9a-f]{6}$/i.test(c.color)&&s(c.name,12));
}
