/* Coach-facing profile sheet. Opened from a player's private share link (no login).
   The database returns only coach-sheet fields, and hides phone numbers until the
   player's D1 contact date. */
(function () {
  'use strict';
  var C = window.TIR_CONFIG;
  var sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);
  var root = document.getElementById('sheet');
  var token = new URLSearchParams(location.search).get('t');

  function esc(t) { return String(t === null || t === undefined ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function kv(pairs) {
    var items = pairs.filter(function (p) { return p[1] !== null && p[1] !== undefined && String(p[1]).trim() !== ''; });
    if (!items.length) return '';
    return '<div class="kv">' + items.map(function (p) { return '<div class="' + (p[2] ? 'full' : '') + '">' + esc(p[0]) + '<b>' + (p[3] ? p[1] : esc(p[1])) + '</b></div>'; }).join('') + '</div>';
  }
  function sec(title, inner) { return inner ? '<div class="cs-sec"><h4>' + esc(title) + '</h4>' + inner + '</div>' : ''; }
  function day(d) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''; }
  function link(url, text) { if (!url) return ''; var u = /^https?:\/\//i.test(url) ? url : 'https://' + url; return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(text || url) + '</a>'; }
  function mail(e) { return e ? '<a href="mailto:' + esc(e) + '">' + esc(e) + '</a>' : ''; }
  function tel(n) { return n ? '<a href="tel:' + esc(n.replace(/[^0-9+]/g, '')) + '">' + esc(n) + '</a>' : ''; }
  function notFound() {
    root.innerHTML = '<div class="cs"><div class="cs-h"><div><h3>Profile unavailable</h3></div><img alt="Team Illinois Lacrosse" src="logo.png"><p>This link isn’t active. Ask Team Illinois Lacrosse for an updated link.</p></div></div>';
  }

  if (!token) { notFound(); return; }
  sb.rpc('get_shared_profile', { token: token }).then(function (r) {
    if (r.error || !r.data) { notFound(); return; }
    var v = r.data, t = v.testing || {};
    document.title = v.name + ' · Class of ' + v.grad_year + ' · Team Illinois Lacrosse';
    var size = [v.height, v.weight_lb ? v.weight_lb + ' lb' : ''].filter(Boolean).join(', ');
    var head = '<div class="cs-h"><div><h3>' + esc(v.name) + '</h3></div><img alt="Team Illinois Lacrosse" src="logo.png">' +
      '<p>' + esc(['Class of ' + v.grad_year, v.position, v.dominant_hand ? v.dominant_hand + '-handed' : '', size].filter(Boolean).join(' · ')) + '</p>' +
      '<p class="upd">Last updated ' + esc(new Date(v.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })) + '</p></div>';
    var events = (v.upcoming_events || []).slice(0, 3).map(function (e) {
      return [e.name + ' · ' + day(e.starts_on) + (e.ends_on && e.ends_on !== e.starts_on ? ' – ' + day(e.ends_on) : ''), [e.location, e.team, e.jersey ? '#' + e.jersey : ''].filter(Boolean).join(' · ') || ' ', 1];
    });
    var tests = [['10-yd', t.sprint_10yd_s ? t.sprint_10yd_s + ' s' : ''], ['5-10-5', t.pro_agility_s ? t.pro_agility_s + ' s' : ''], ['Vertical', t.vertical_in ? t.vertical_in + ' in' : ''],
      ['Broad', t.broad_jump_in ? t.broad_jump_in + ' in' : ''], ['Squat 1RM', t.squat_1rm_lb ? t.squat_1rm_lb + ' lb' : '']].filter(function (x) { return x[1]; });
    var testsHtml = tests.length ? '<div class="tests">' + tests.map(function (x) { return '<div>' + esc(x[0]) + '<b>' + esc(x[1]) + '</b></div>'; }).join('') + '</div>' +
      '<div class="verified">✓ Tested and verified by Team Illinois staff' + (t.test_date ? ' · ' + esc(day(t.test_date)) : '') + '</div>' : '';
    var opens = new Date(v.contact_opens).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    var contact = kv([['Player email', mail(v.player_email), 1, 1], ['Player cell', tel(v.player_cell), 0, 1], ['Parent', v.parent_name], ['Parent email', mail(v.parent_email), 1, 1], ['Parent cell', tel(v.parent_cell), 0, 1]]) +
      (v.contact_open ? '' : '<div class="gate">Phone numbers appear on ' + esc(opens) + ', when NCAA Division I coaches may begin recruiting contact for the Class of ' + esc(v.grad_year) + '.</div>');
    var refs = kv([[v.hs_coach || 'HS coach', mail(v.hs_coach_email), 0, 1], [v.club_coach || 'Club coach', mail(v.club_coach_email), 0, 1]]);
    root.innerHTML = '<article class="cs">' + head + '<div class="cs-b">' +
      sec('Teams', kv([['Club', [v.club_team, v.club_jersey ? '#' + v.club_jersey : ''].filter(Boolean).join(' · '), 1], ['High school', [v.high_school, v.hs_jersey ? '#' + v.hs_jersey : ''].filter(Boolean).join(' · '), 1]])) +
      sec('Upcoming events', kv(events)) +
      sec('Academics', kv([['GPA (unweighted)', v.gpa_unweighted], ['GPA (weighted)', v.gpa_weighted], ['SAT', v.sat], ['ACT', v.act], ['Intended major', v.intended_major, 1], ['Honors', v.academic_honors, 1], ['NCAA ID', v.ncaa_id, 1]])) +
      sec('Lacrosse', kv([['Stats', v.key_stats, 1], ['Honors', v.lacrosse_honors, 1], ['Highlight film', link(v.film_url, 'Watch film ↗'), 1, 1]])) +
      sec('Athletic testing', testsHtml) + sec('Contact', contact) + sec('References', refs) +
      '</div></article>' +
      '<div class="coach-actions"><button class="btn" id="pdf">Save as PDF</button>' + (v.film_url ? '<a class="btn ghost" href="' + esc(/^https?:/i.test(v.film_url) ? v.film_url : 'https://' + v.film_url) + '" target="_blank" rel="noopener">Watch film</a>' : '') + '</div>' +
      '<p class="coach-foot">Shared privately by Team Illinois Lacrosse. Please don’t forward without permission.</p>';
    document.getElementById('pdf').addEventListener('click', function () { window.print(); });
  }, notFound);
})();
