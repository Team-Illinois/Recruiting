/* Import answers from the website questionnaire export (pasted from a spreadsheet).
   Rules: a blank answer never overwrites a filled one; the newest filled answer wins;
   untouched sliders (every rating identical) are ignored; garbled characters are repaired. */
(function () {
  'use strict';
  var Q = window.TIR_Q, FIT = window.TIR_FIT;
  var MULTI = ['academies', 'academic_groups', 'divisions', 'size', 'setting', 'region', 'majors', 'showcases_past', 'showcases_next'];
  var NUMERIC = { sat: [400, 1600], act: [1, 36] };
  var SKIP = { created_at: 1, submitted_local: 1, player: 1, other_name: 1 };

  // Spreadsheet paste: tab-separated, fields with line breaks or tabs come wrapped in double quotes.
  function parseTSV(text) {
    var rows = [], row = [], cur = '', i = 0, q = false, s = String(text || '').replace(/\r\n?/g, '\n');
    while (i < s.length) {
      var ch = s[i];
      if (q) {
        if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i += 2; continue; } q = false; i++; continue; }
        cur += ch; i++; continue;
      }
      if (ch === '"' && cur === '') { q = true; i++; continue; }
      if (ch === '\t') { row.push(cur); cur = ''; i++; continue; }
      if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; i++; continue; }
      cur += ch; i++;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }
  // "doesnâ€™t" -> "doesn’t": text that was UTF-8 but read as Windows-1252
  var CP1252 = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f };
  function fixText(t) {
    if (!/[Â-Ãâ][\u0080-¿‘-„€™œšžŸ˜]/.test(t)) return t;
    return t.replace(/[Â-ô][\u0080-¿Œ-™]{1,3}/g, function (m) {
      try {
        var bytes = Array.prototype.map.call(m, function (c) { var cc = c.charCodeAt(0); return CP1252[c] !== undefined ? CP1252[c] : cc; });
        if (bytes.some(function (b) { return b > 255; })) return m;
        return decodeURIComponent(bytes.map(function (b) { return '%' + ('0' + b.toString(16)).slice(-2); }).join(''));
      } catch (e) { return m; }
    });
  }
  function clean(v) { return fixText(String(v === undefined || v === null ? '' : v)).replace(/ /g, ' ').trim(); }

  function toAnswers(header, cells) {
    var a = {}, notes = [], name = '';
    header.forEach(function (h, i) {
      var key = String(h || '').trim(), v = clean(cells[i]);
      if (!key) return;
      if (key === 'player') { if (v && !name) name = v; return; }
      if (SKIP[key] || v === '') return;
      if (MULTI.indexOf(key) > -1) { a[key] = v.split(/\s*;\s*/).filter(Boolean); return; }
      if (/^p_/.test(key)) { var n = parseInt(v, 10); if (!isNaN(n)) a[key] = Math.max(1, Math.min(10, n)); return; }
      if (NUMERIC[key]) {
        var num = parseInt(v.replace(/[^0-9]/g, ''), 10), r = NUMERIC[key];
        if (!/[a-z]/i.test(v) && !isNaN(num) && num >= r[0] && num <= r[1]) a[key] = num;
        else notes.push(key.toUpperCase() + ' box said "' + v + '"');
        return;
      }
      if (key === 'gpa') { var g = parseFloat(v); if (!isNaN(g)) a.gpa = g; else notes.push('GPA box said "' + v + '"'); return; }
      if (key === 'tuition_exchange' && v === 'Maybe') v = 'Not sure';
      if (key === 'target_schools') { a.target_schools = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); return; }
      a[key] = v;
    });
    if (notes.length) a.academic_note = [a.academic_note, '(From the website form: ' + notes.join('; ') + '.)'].filter(Boolean).join(' ');
    return { name: name, answers: a, created: clean(cells[header.indexOf('created_at')]) };
  }
  function scalesUntouched(a) {
    var v = Q.SCALES.map(function (sc) { return a[sc[0]]; }).filter(function (x) { return x !== undefined; });
    return v.length >= 8 && v.every(function (x) { return x === v[0]; });
  }
  // Several submissions from one player -> one answer set.
  function merge(subs) {
    subs = subs.slice().sort(function (x, y) { return x.created < y.created ? -1 : 1; });
    var out = {}, info = { submissions: subs.length, ignoredScales: 0, blanksKept: 0 };
    subs.forEach(function (s) {
      var a = s.answers, ignore = scalesUntouched(a); if (ignore) info.ignoredScales++;
      Object.keys(a).forEach(function (k) {
        if (/^p_/.test(k) && ignore) return;
        out[k] = a[k];
      });
    });
    var last = subs[subs.length - 1];
    if (subs.length > 1) Object.keys(out).forEach(function (k) { if (last.answers[k] === undefined) info.blanksKept++; });
    return { answers: out, latest: last.created, info: info };
  }
  function nameKey(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }
  function parse(text) {
    var rows = parseTSV(text);
    if (rows.length < 2) return { error: 'Paste the whole table, including the header row.' };
    var header = rows[0].map(function (h) { return String(h).trim(); });
    if (header.indexOf('player') < 0) return { error: 'The first row needs the column names (player, created_at, ...). Copy the header row too.' };
    var groups = {};
    rows.slice(1).forEach(function (r) {
      var t = toAnswers(header, r); if (!t.name) return;
      var k = nameKey(t.name); (groups[k] = groups[k] || { name: t.name, subs: [] }).subs.push(t);
    });
    return { players: Object.keys(groups).map(function (k) { var g = groups[k], m = merge(g.subs); return { name: g.name, key: k, answers: m.answers, latest: m.latest, info: m.info }; }) };
  }
  function matchPlayer(p, roster) {
    var k = p.key, email = String(p.answers.email || '').toLowerCase();
    var hit = roster.filter(function (r) { return nameKey(r.first_name + r.last_name) === k; })[0];
    if (hit) return { player: hit, how: 'name' };
    if (email) { hit = roster.filter(function (r) { return r.email && r.email.toLowerCase() === email; })[0]; if (hit) return { player: hit, how: 'email' }; }
    var last = k.slice(-6); hit = roster.filter(function (r) { var rk = nameKey(r.first_name + r.last_name); return rk.slice(-6) === last && rk[0] === k[0]; });
    return hit.length === 1 ? { player: hit[0], how: 'close' } : { player: null, how: 'none' };
  }
  function matchTargets(list, schools) {
    return (list || []).map(function (t) { return FIT.matchSchool(t, schools); }).filter(Boolean);
  }
  window.TIR_IMPORT = { parseTSV: parseTSV, fixText: fixText, parse: parse, merge: merge, matchPlayer: matchPlayer, matchTargets: matchTargets, nameKey: nameKey };
})();
