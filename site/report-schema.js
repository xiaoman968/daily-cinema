export function validateReport(r, photoCount = 9) {
  const str = (v, max = 600) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  if (!r || !str(r.title, 16) || !str(r.subtitle, 50) || !str(r.archetype, 20) || !str(r.review, 400) || !str(r.invitation, 80)) return false;
  if (!Array.isArray(r.tags) || r.tags.length !== 3 || !r.tags.every(v => str(v, 12))) return false;
  if (!Array.isArray(r.palette) || r.palette.length !== 4 || !r.palette.every(v => /^#[0-9a-f]{6}$/i.test(v))) return false;
  if (!Array.isArray(r.observations) || r.observations.length !== 4) return false;
  if (!r.observations.every(o => o && str(o.dimension, 12) && str(o.title, 24) && str(o.evidence, 140) && str(o.interpretation, 140) && Array.isArray(o.photos) && o.photos.length > 0 && o.photos.every(n => Number.isInteger(n) && n >= 1 && n <= photoCount))) return false;
  return Array.isArray(r.suggestions) && r.suggestions.length === 3 && r.suggestions.every(s => s && str(s.title, 24) && str(s.detail, 180));
}
