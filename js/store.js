/* 本地持久化：设置 / 最佳记录 / 未完成对局续玩 */
window.Store = (function () {
  const NS = 'arcade.v2.';
  const mem = {};                       // localStorage 不可用时的兜底
  let ok = true;
  try { localStorage.setItem(NS + '_t', '1'); localStorage.removeItem(NS + '_t'); }
  catch (e) { ok = false; }

  function read(k, d) {
    if (!ok) return k in mem ? mem[k] : d;
    try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); }
    catch (e) { return d; }
  }
  function write(k, v) {
    mem[k] = v;
    if (!ok) return;
    try { localStorage.setItem(NS + k, JSON.stringify(v)); }
    catch (e) {
      // 配额溢出：先丢掉体积最大的存档再重试一次
      try {
        Object.keys(localStorage).filter(x => x.startsWith(NS + 'save.'))
          .forEach(x => localStorage.removeItem(x));
        localStorage.setItem(NS + k, JSON.stringify(v));
      } catch (e2) { ok = false; }
    }
  }
  function drop(k) { delete mem[k]; if (ok) try { localStorage.removeItem(NS + k); } catch (e) {} }

  const settings = Object.assign({ theme: null, muted: false, vol: 0.3 }, read('settings', {}));
  const saveSettings = () => write('settings', settings);

  /** 记录：higher=true 取最大值，否则取最小值。返回 {best, isNew} */
  function record(gameId, key, value, higher) {
    const all = read('best', {});
    const k = gameId + '.' + key;
    const prev = all[k];
    const better = prev == null || (higher ? value > prev : value < prev);
    if (better) { all[k] = value; write('best', all); }
    return { best: all[k], isNew: better, prev };
  }
  const best = (gameId, key) => (read('best', {}))[gameId + '.' + key];
  /** 该游戏所有难度里的代表性最佳值 */
  function bestAny(gameId) {
    const all = read('best', {});
    const hits = Object.keys(all).filter(k => k.startsWith(gameId + '.'));
    return hits.length ? { key: hits[0].slice(gameId.length + 1), value: all[hits[0]] } : null;
  }

  function bump(gameId, field, by = 1) {
    const st = read('stats', {});
    const k = gameId + '.' + field;
    st[k] = (st[k] || 0) + by;
    write('stats', st);
    return st[k];
  }
  const stat = (gameId, field) => (read('stats', {}))[gameId + '.' + field] || 0;

  /* 对局存档：每局一个 key，避免单条过大 */
  const saveGame = (id, data) => write('save.' + id, { at: Date.now(), data });
  function loadGame(id, maxAgeMs = 7 * 864e5) {
    const s = read('save.' + id, null);
    if (!s || Date.now() - s.at > maxAgeMs) { drop('save.' + id); return null; }
    return s.data;
  }
  const clearGame = id => drop('save.' + id);
  const hasSave = id => !!read('save.' + id, null);

  function wipe() {
    if (ok) Object.keys(localStorage).filter(k => k.startsWith(NS))
      .forEach(k => localStorage.removeItem(k));
    Object.keys(mem).forEach(k => delete mem[k]);
  }
  /** 估算已占用字节，用于设置页展示 */
  function usage() {
    if (!ok) return 0;
    return Object.keys(localStorage).filter(k => k.startsWith(NS))
      .reduce((n, k) => n + k.length + (localStorage.getItem(k) || '').length, 0) * 2;
  }

  return { settings, saveSettings, record, best, bestAny, bump, stat,
           saveGame, loadGame, clearGame, hasSave, wipe, usage, available: ok };
})();