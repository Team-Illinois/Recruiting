/* Team Illinois Recruiting — app
   Families see only their own player. Directors see everyone.
   Privacy is enforced by the database (Supabase row-level security), not by this file. */
(function () {
  'use strict';
  var C = window.TIR_CONFIG;
  var sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  // ---------------------------------------------------------------- helpers
  var D = 864e5;
  function $(s, r) { return (r || document).querySelector(s); }
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, kid) {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { add(el, k); }); return; }
    el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }
  function one(x) { return Array.isArray(x) ? x[0] : x; }
  function stamp(t) { return t ? new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'; }
  function short(t) { return t ? new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'; }
  function day(d) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''; }
  function initials(a, b) { return ((a || '?')[0] + (b || '')[0]).toUpperCase(); }
  function blank(v) { return v === null || v === undefined || String(v).trim() === ''; }
  var tt;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(function () { t.hidden = true; }, 2600); }
  function fail(err, what) { console.error(err); toast((what ? what + ': ' : '') + (err && err.message ? err.message : 'Something went wrong. Check your connection.')); }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { toast('Copied'); }, function () { toast('Couldn’t copy. Press and hold to copy instead.'); });
    toast('Press and hold to copy.');
  }
  function baseUrl() { return location.origin + location.pathname.replace(/[^/]*$/, ''); }
  function coachUrl(token) { return baseUrl() + 'coach.html?t=' + encodeURIComponent(token); }
  function randomToken() { var a = new Uint8Array(9); crypto.getRandomValues(a); return Array.from(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }

  // ---------------------------------------------------------------- recruiting calendar
  function syEnd() { var n = new Date(); return n.getMonth() >= 7 ? n.getFullYear() + 1 : n.getFullYear(); } // rolls over Aug 1
  function grade(grad) { return 12 - (grad - syEnd()); }
  function gradeLabel(grad) { var g = grade(grad); return g >= 9 ? 'Grade ' + g : g === 8 ? '8th grade' : 'Grade ' + g; }
  function contactDate(grad) { // men's D1: Wednesday after Labor Day of junior year, 7:00 AM ET
    var y = grad - 2, d = new Date(y, 8, 1); while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    d.setDate(d.getDate() + 2);
    var iso = y + '-09-' + ('0' + d.getDate()).slice(-2) + 'T07:00:00-04:00';
    return { d: new Date(iso), label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' · 7:00 AM ET' };
  }
  var gradExtra = [];
  function gradYears() {
    var ys = []; for (var y = syEnd(); y <= syEnd() + 4; y++) ys.push(y);
    gradExtra.forEach(function (y) { if (y >= syEnd() && ys.indexOf(y) < 0) ys.push(y); });
    return ys.sort();
  }

  var TASKS = {
    early: [
      ['Create your NCAA Eligibility Center Profile Page', 'Free. Gets you an NCAA ID to put on your profile.'],
      ['Build a list of 15–20 schools', 'Mix of reach, target and likely fits academically and athletically.'],
      ['Cut a 3–4 minute highlight reel from fall ball', 'Best clips first. Put your jersey # and color in the title card.'],
      ['Email coaches your winter tournament schedule', 'Coaches can read your emails now but can’t reply about recruiting until junior year.'],
      ['Keep your GPA up this semester', 'Coaches look at transcripts before film more often than you’d think.']
    ],
    junior: [
      ['Follow up with every coach on your list', 'Contact is open. A short personal email beats a mass message.'],
      ['Schedule unofficial visits for winter break', 'Ask your director which schools have shown real interest.'],
      ['Update your profile with fall stats', 'Coaches see the change on the link you already sent.'],
      ['Register for the SAT or ACT if your schools want it', 'Check each school’s test policy on the Schools tab.'],
      ['Meet with your director to rank your list', 'Bring your notes from every coach conversation.']
    ],
    senior: [
      ['Request final amateurism certification', 'Done through your NCAA Eligibility Center account.'],
      ['Finish official visits', 'Log each one so your director can help you compare offers.'],
      ['Review admissions and financial aid deadlines', 'Early decision dates can come before an athletic commitment is final.'],
      ['Complete the FAFSA', 'Opens October 1. Some aid is first-come, first-served.'],
      ['Plan to send your final transcript after graduation', 'The Eligibility Center needs it to certify you.']
    ]
  };
  function phaseFor(grad) { var g = grade(grad); return g >= 12 ? 'senior' : g === 11 ? 'junior' : 'early'; }
  var PHASE_LABEL = { early: 'Building your foundation', junior: 'Junior year: contact is open', senior: 'Senior year: finishing strong' };

  // ---------------------------------------------------------------- profile fields
  var POSITIONS = ['Attack', 'Midfield', 'LSM', 'Defense', 'Faceoff', 'Goalie', 'SSDM'];
  var SECTIONS = [
    { id: 'player', title: 'Player', fields: [
      ['position', 'Position', 'select', POSITIONS], ['dominant_hand', 'Dominant hand', 'select', ['Right', 'Left', 'Both']],
      ['height', 'Height', 'text'], ['weight_lb', 'Weight (lb)', 'int'],
      ['high_school', 'High school', 'text', null, 1], ['hs_jersey', 'HS jersey #', 'text'], ['club_jersey', 'Club jersey #', 'text'],
      ['club_team', 'Club team', 'text', null, 1]] },
    { id: 'contact', title: 'Contact', fields: [
      ['player_email', 'Player email', 'email', null, 1], ['player_cell', 'Player cell', 'tel'], ['parent_name', 'Parent name', 'text'],
      ['parent_email', 'Parent email', 'email', null, 1], ['parent_cell', 'Parent cell', 'tel']] },
    { id: 'academics', title: 'Academics', fields: [
      ['gpa_unweighted', 'GPA (unweighted)', 'decimal'], ['gpa_weighted', 'GPA (weighted)', 'decimal'],
      ['sat', 'SAT (optional)', 'int', null, 0, 1], ['act', 'ACT (optional)', 'int', null, 0, 1],
      ['intended_major', 'Intended major', 'text', null, 1], ['ncaa_id', 'NCAA Eligibility Center ID', 'text', null, 1],
      ['academic_honors', 'Academic honors', 'text', null, 1]] },
    { id: 'lacrosse', title: 'Lacrosse', fields: [
      ['key_stats', 'Key stats', 'textarea', null, 1], ['lacrosse_honors', 'Honors', 'text', null, 1],
      ['film_url', 'Highlight video link (YouTube or Hudl)', 'url', null, 1]] },
    { id: 'refs', title: 'References', fields: [
      ['hs_coach', 'HS coach', 'text'], ['hs_coach_email', 'HS coach email', 'email'],
      ['club_coach', 'Club coach', 'text'], ['club_coach_email', 'Club coach email', 'email']] }
  ];
  var TEST_FIELDS = [['test_date', 'Test date', 'date'], ['sprint_10yd_s', '10-yd sprint (s)', 'decimal'], ['pro_agility_s', 'Pro agility 5-10-5 (s)', 'decimal'],
    ['vertical_in', 'Vertical jump (in)', 'decimal'], ['broad_jump_in', 'Broad jump (in)', 'decimal'], ['squat_1rm_lb', 'Back squat est. 1RM (lb)', 'int']];
  function completeness(pr) {
    var tot = 0, n = 0;
    SECTIONS.forEach(function (s) { s.fields.forEach(function (f) { if (f[5]) return; tot++; if (pr && !blank(pr[f[0]])) n++; }); });
    return Math.round(n / tot * 100);
  }

  // ---------------------------------------------------------------- schools
  var FIELDS = { eng: 'Engineering', bus: 'Business', cs: 'Computer Science', nur: 'Nursing', kin: 'Kinesiology / Exercise Science', edu: 'Education' };
  var FIELD_SHORT = { eng: 'Eng', bus: 'Bus', cs: 'CS', nur: 'Nursing', kin: 'Kin', edu: 'Edu' };
  var DIV_LABEL = { D1: 'NCAA D1', D2: 'NCAA D2', D3: 'NCAA D3', NAIA: 'NAIA', JUCO: 'Junior college' };
  var RULE = {
    D1: 'NCAA D1: coaches can start recruiting contact the Wednesday after Labor Day of junior year, 7:00 AM ET.',
    D2: 'NCAA D2: contact rules differ from D1. Ask your director before reaching out as an underclassman.',
    D3: 'NCAA D3: contact rules differ from D1, and there are no athletic scholarships. Ask your director for timing.',
    NAIA: 'NAIA: NCAA recruiting rules don’t apply. Coaches set their own timeline.',
    JUCO: 'Junior college: NCAA recruiting rules don’t apply. Coaches set their own timeline.'
  };
  var ACC_RANK = { 'Under 20%': 0, '20–50%': 1, '50%+': 2, 'Open admission': 3 };
  var NET_RANK = { 'Under $20k': 0, '$20k–35k': 1, '$35k+': 2 };
  var STATUS = ['Researching', 'Contacted', 'Interested', 'Visited', 'Offer'];
  var STATUS_PILL = { Researching: 'i', Contacted: 'i', Interested: 'g', Visited: 'g', Offer: 'g' };
  function searchLink(q) { return 'https://www.google.com/search?q=' + encodeURIComponent(q); }

  // ---------------------------------------------------------------- state
  var S = { user: null, member: null, players: [], pid: null, tab: 'home', schools: null, filters: null, dir: {} };
  function player() { return S.players.filter(function (p) { return p.id === S.pid; })[0]; }

  // ---------------------------------------------------------------- save status bar
  var saveState = { pending: 0, last: null, err: false };
  function saveBar() {
    var el = h('div', { class: 'savebar', id: 'savebar', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), h('span', { id: 'saveText' }));
    setTimeout(paintSave, 0); return el;
  }
  function paintSave() {
    var bar = $('#savebar'), txt = $('#saveText'); if (!bar) return;
    bar.classList.toggle('saving', saveState.pending > 0);
    bar.classList.toggle('err', saveState.err);
    txt.textContent = saveState.err ? 'Couldn’t save. Check your connection and try again.' :
      saveState.pending > 0 ? 'Saving…' : saveState.last ? 'Saved · Last updated ' + stamp(saveState.last) : 'Changes save automatically';
  }
  function track(promise) {
    saveState.pending++; saveState.err = false; paintSave();
    return Promise.resolve(promise).then(function (res) {
      saveState.pending--;
      if (res && res.error) { saveState.err = true; paintSave(); throw res.error; }
      saveState.last = Date.now(); paintSave(); return res;
    }, function (e) { saveState.pending--; saveState.err = true; paintSave(); throw e; });
  }

  // ---------------------------------------------------------------- sheets (bottom panels)
  function sheet(build) {
    var scrim = h('div', { class: 'scrim' }), box = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'grab' }));
    scrim.appendChild(box);
    function close() { scrim.remove(); }
    scrim.addEventListener('click', function (e) { if (e.target === scrim) close(); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    build(box, close);
    document.body.appendChild(scrim);
    var f = box.querySelector('input,select,textarea'); if (f) setTimeout(function () { f.focus(); }, 50);
    return close;
  }
  function field(label, input, full) { var id = input.id || ('f' + Math.random().toString(36).slice(2)); input.id = id; return h('div', { class: 'field' + (full ? ' full' : '') }, h('label', { for: id, text: label }), input); }
  function select(opts, val, attrs) { var s = h('select', attrs || {}); opts.forEach(function (o) { var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; s.appendChild(h('option', { value: v, text: t })); }); if (val !== undefined && val !== null) s.value = val; return s; }

  // ================================================================ AUTH
  function showAuth(mode, msg) {
    mode = mode || 'signin';
    var app = $('#app'); app.innerHTML = ''; app.hidden = false; $('#boot').hidden = true;
    var err = h('div', { class: 'err', role: 'alert', text: msg || '' });
    var wrap = h('div', { class: 'login' }, h('div', { class: 'login-in' }, loginBrand(), h('div', { class: 'login-side' }, h('div', { class: 'login-card' },
      h('div', { class: 'authtabs', role: 'tablist' },
        h('button', { type: 'button', 'aria-pressed': String(mode === 'signin'), onclick: function () { showAuth('signin'); }, text: 'Sign in' }),
        h('button', { type: 'button', 'aria-pressed': String(mode === 'create'), onclick: function () { showAuth('create'); }, text: 'First time here' })),
      form(), err,
      h('p', { class: 'fine', text: 'Accounts are set up by your Team Illinois recruiting directors. Each player and parent gets their own sign-in, and you only ever see your own player.' })))));
    app.appendChild(wrap);

    function form() {
      if (mode === 'signin') {
        var em = h('input', { type: 'email', autocomplete: 'username', placeholder: 'you@email.com', required: true });
        var pw = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Your password', required: true });
        return h('form', { novalidate: true, onsubmit: function (e) {
          e.preventDefault(); err.textContent = '';
          if (!em.value.trim() || !pw.value) { err.textContent = 'Enter your email and password.'; return; }
          busy(this, true);
          sb.auth.signInWithPassword({ email: em.value.trim(), password: pw.value }).then(function (r) {
            if (r.error) { busy(e.target, false); err.textContent = /invalid/i.test(r.error.message) ? 'That email and password don’t match. Try again or reset your password.' : r.error.message; return; }
            start();
          });
        } },
          field('Email', em), field('Password', pw),
          h('button', { class: 'btn', type: 'submit', text: 'Sign in' }),
          h('div', { class: 'row2' }, h('button', { type: 'button', onclick: function () { showForgot(em.value); }, text: 'Forgot password?' })));
      }
      var cem = h('input', { type: 'email', autocomplete: 'username', placeholder: 'The email your director used' });
      var code = h('input', { type: 'text', autocomplete: 'off', placeholder: '6-character code', maxlength: '6', style: 'text-transform:uppercase;letter-spacing:.15em' });
      var nm = h('input', { type: 'text', autocomplete: 'name', placeholder: 'First and last name' });
      var p1 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'At least 10 characters' });
      var p2 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Type it again' });
      return h('form', { novalidate: true, onsubmit: function (e) {
        e.preventDefault(); err.textContent = '';
        var email = cem.value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Enter the email your director sent the invite to.'; return; }
        if (p1.value.length < 10) { err.textContent = 'Use a password with at least 10 characters.'; return; }
        if (p1.value !== p2.value) { err.textContent = 'The two passwords don’t match.'; return; }
        busy(e.target, true);
        sb.auth.signUp({ email: email, password: p1.value, options: { data: { invite_code: code.value.trim().toUpperCase(), full_name: nm.value.trim() } } }).then(function (r) {
          busy(e.target, false);
          if (r.error) {
            err.textContent = /database error|invite/i.test(r.error.message) ? 'That email and invite code don’t match an open invite. Check both with your director. Codes work once.' :
              /registered|exists/i.test(r.error.message) ? 'This email already has an account. Use Sign in, or reset your password.' : r.error.message;
            return;
          }
          if (!r.data.session) { showAuth('signin', 'Account created. Check your email to confirm it, then sign in.'); return; }
          start();
        });
      } },
        field('Email', cem), field('Invite code (directors leave blank)', code), field('Your name', nm), field('Create a password', p1), field('Confirm password', p2),
        h('button', { class: 'btn', type: 'submit', text: 'Create my account' }));
    }
  }
  function loginBrand() {
    return h('div', { class: 'login-brand' }, h('img', { src: 'crest.png', alt: 'Team Illinois Lacrosse' }), h('h1', { text: 'Recruiting' }),
      h('p', { text: 'Your path to college lacrosse, organized in one place.' }));
  }
  function loginPanel(kids) { return h('div', { class: 'login' }, h('div', { class: 'login-in' }, loginBrand(), h('div', { class: 'login-side' }, h('div', { class: 'login-card' }, kids)))); }
  function busy(form, on) { var b = form && form.querySelector('button[type=submit]'); if (b) { b.disabled = on; b.dataset.t = b.dataset.t || b.textContent; b.textContent = on ? 'One moment…' : b.dataset.t; } }
  function showForgot(prefill) {
    sheet(function (box, close) {
      var em = h('input', { type: 'email', value: prefill || '', placeholder: 'you@email.com' });
      var note = h('p', { class: 'note' });
      box.appendChild(h('h2', { text: 'Reset password' }));
      box.appendChild(h('p', { text: 'We’ll email you a link to set a new password.' }));
      box.appendChild(field('Email', em));
      box.appendChild(note);
      box.appendChild(h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: function () {
        if (!em.value.trim()) return;
        sb.auth.resetPasswordForEmail(em.value.trim(), { redirectTo: baseUrl() }).then(function (r) {
          note.textContent = r.error ? r.error.message : 'If that email has an account, a reset link is on its way. Check spam too.';
        });
      }, text: 'Send reset link' }), h('button', { class: 'btn ghost', onclick: close, text: 'Close' })));
    });
  }
  function showSetPassword() {
    var app = $('#app'); app.innerHTML = ''; app.hidden = false; $('#boot').hidden = true;
    var p1 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'At least 10 characters' });
    var p2 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Type it again' });
    var err = h('div', { class: 'err', role: 'alert' });
    app.appendChild(loginPanel([h('h2', { class: 'card-h', text: 'Set a new password' }),
      h('form', { novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        if (p1.value.length < 10) { err.textContent = 'Use at least 10 characters.'; return; }
        if (p1.value !== p2.value) { err.textContent = 'The two passwords don’t match.'; return; }
        busy(e.target, true);
        sb.auth.updateUser({ password: p1.value }).then(function (r) {
          busy(e.target, false);
          if (r.error) { err.textContent = r.error.message; return; }
          history.replaceState(null, '', location.pathname); toast('Password updated'); start();
        });
      } }, field('New password', p1), field('Confirm password', p2), err, h('button', { class: 'btn', type: 'submit', text: 'Save password' }))]));
  }
  function signOut() { sb.auth.signOut().then(function () { S = { user: null, member: null, players: [], pid: null, tab: 'home', schools: null, filters: null, dir: {} }; showAuth('signin'); }); }
  function changePassword() {
    sheet(function (box, close) {
      var p1 = h('input', { type: 'password', autocomplete: 'new-password' }), p2 = h('input', { type: 'password', autocomplete: 'new-password' });
      var err = h('p', { class: 'note' });
      box.append(h('h2', { text: 'Change password' }), field('New password (10+ characters)', p1), field('Confirm', p2), err,
        h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: function () {
          if (p1.value.length < 10) { err.textContent = 'Use at least 10 characters.'; return; }
          if (p1.value !== p2.value) { err.textContent = 'The passwords don’t match.'; return; }
          sb.auth.updateUser({ password: p1.value }).then(function (r) { if (r.error) err.textContent = r.error.message; else { close(); toast('Password updated'); } });
        }, text: 'Save' }), h('button', { class: 'btn ghost', onclick: close, text: 'Cancel' })));
    });
  }

  // ================================================================ START
  function start() {
    sb.auth.getUser().then(function (r) {
      if (!r.data || !r.data.user) { showAuth('signin'); return; }
      S.user = r.data.user;
      return Promise.all([
        sb.from('members').select('*').eq('id', S.user.id).maybeSingle(),
        sb.from('grad_classes').select('grad_year')
      ]).then(function (res) {
        S.member = res[0].data || { role: 'family' };
        gradExtra = (res[1].data || []).map(function (g) { return g.grad_year; });
        if (S.member.role === 'director') { S.tab = 'roster'; return renderDirector(); }
        return sb.from('players').select('*').order('grad_year').then(function (pr) {
          if (pr.error) throw pr.error;
          S.players = pr.data || [];
          if (!S.players.length) return renderUnlinked();
          var saved = null; try { saved = localStorage.getItem('tir-pid'); } catch (e) { }
          S.pid = S.players.some(function (p) { return p.id === saved; }) ? saved : S.players[0].id;
          S.tab = 'home'; renderFamily();
        });
      });
    }).catch(function (e) { fail(e, 'Couldn’t load the app'); showAuth('signin'); });
  }
  function renderUnlinked() {
    var app = $('#app'); app.innerHTML = ''; app.hidden = false; $('#boot').hidden = true;
    app.appendChild(loginPanel([h('h2', { class: 'card-h', text: 'Almost there' }),
      h('p', { class: 'fine', style: 'text-align:left;margin:8px 0 16px', text: 'Your account isn\u2019t linked to a player yet. Ask a Team Illinois recruiting director to link it, then sign in again.' }),
      h('button', { class: 'btn', style: 'width:100%', onclick: signOut, text: 'Sign out' })]));
  }

  // ================================================================ FAMILY APP
  var FAM_TABS = [['home', 'Home', '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'], ['schools', 'Schools', '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>'],
    ['coaches', 'Coaches', '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'], ['profile', 'Profile', '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/>'],
    ['more', 'More', '<path d="M4 6h16M4 12h16M4 18h16"/>']];
  var DIR_TABS = [['roster', 'Roster', '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-3.5 4-5 7-5s6 1.5 7 5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .8 3.4 2.4 4 5"/>'],
    ['requests', 'Requests', '<path d="M4 4h16v12H5.5L4 18z"/><path d="M8 9h8M8 12h5"/>'], ['events', 'Events', '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'],
    ['meetings', 'Meetings', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'], ['dmore', 'More', '<path d="M4 6h16M4 12h16M4 18h16"/>']];
  function tabBar(tabs, current, go) {
    var nav = h('nav', { 'aria-label': 'Main' });
    tabs.forEach(function (t) {
      var b = h('button', { 'data-tab': t[0], 'aria-current': t[0] === current ? 'page' : null, onclick: function () { go(t[0]); } });
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + t[2] + '</svg>';
      b.appendChild(document.createTextNode(t[1])); nav.appendChild(b);
    });
    return h('div', { class: 'tabs' }, h('div', { class: 'side-brand' }, h('img', { src: 'crest.png', alt: 'Team Illinois Lacrosse' }), h('b', { text: 'Recruiting' })), nav,
      h('div', { class: 'side-foot', text: (S.member && S.member.role === 'director' ? 'Director view \u00b7 ' : '') + 'Team Illinois Lacrosse' }));
  }
  function shell(content, tabs, current, go) {
    var app = $('#app'); app.innerHTML = ''; app.hidden = false; $('#boot').hidden = true;
    app.appendChild(h('div', { class: 'app' }, content));
    app.appendChild(tabBar(tabs, current, go));
    window.scrollTo(0, 0);
  }
  function topbar(title, sub) {
    return h('header', { class: 'mini pad' }, h('img', { src: 'crest-sm.png', alt: 'Team Illinois Lacrosse', class: 'mini-logo' }),
      h('div', { class: 'mini-t' }, h('h1', { text: title }), sub ? h('span', { text: sub }) : null));
  }
  function goFam(t) { S.tab = t; renderFamily(); }

  function renderFamily() {
    var p = player(); if (!p) return renderUnlinked();
    var main = h('div', {});
    shell(main, FAM_TABS, S.tab, goFam);
    var views = { home: famHome, schools: viewSchools, coaches: famCoaches, profile: famProfile, more: famMore };
    (views[S.tab] || famHome)(main, p);
  }

  function contactCard(p) {
    var c = contactDate(p.grad_year), open = new Date() >= c.d;
    return h('div', { class: 'window', 'aria-live': 'polite' },
      h('div', {}, h('div', { class: 'lbl', text: 'D1 contact window' }), h('div', { class: 'big', text: open ? 'Coaches can contact you' : Math.ceil((c.d - new Date()) / D).toLocaleString() + ' days to go' })),
      h('div', { class: 'status ' + (open ? 'open' : 'closed'), text: open ? 'Open' : 'Not yet' }),
      h('div', { class: 'sub', text: open ? 'Opened ' + c.label + '. Calls, texts, emails and visits with D1 coaches are allowed now.' :
        'D1 coaches can start recruiting contact on ' + c.label + '. Until then you can email them; they can’t reply about recruiting, directly or through your club staff.' }));
  }

  function famHome(main, p) {
    var hr = new Date().getHours();
    var hero = h('header', { class: 'hero pad' },
      h('div', { class: 'topbar' }, h('div', { class: 'brand' }, h('img', { class: 'logo', src: 'crest-sm.png', alt: 'Team Illinois Lacrosse' }), h('span', { text: 'Recruiting' })),
        h('button', { class: 'signout', 'aria-label': 'Account', onclick: function () { goFam('more'); } }, h('span', { class: 'avatar', text: initials(p.first_name, p.last_name) }))),
      h('div', { class: 'hero-grid' }, h('div', {},
        h('div', { class: 'greet', text: hr < 12 ? 'Good morning,' : hr < 17 ? 'Good afternoon,' : 'Good evening,' }),
        h('h1', { class: 'name', text: p.first_name + ' ' + p.last_name }),
        h('div', { class: 'chips', id: 'chips' }, h('span', { class: 'chip', text: 'Class of ' + p.grad_year }), h('span', { class: 'chip', text: gradeLabel(p.grad_year) }), h('span', { class: 'chip', text: 'Men\u2019s lacrosse' })),
        h('div', { class: 'private' }, lockIcon(), 'Private to you, your parents and your recruiting directors')),
      contactCard(p)));
    main.appendChild(hero);
    var body = h('div', { class: 'pad' }); main.appendChild(body);
    body.appendChild(saveBar());
    if (S.players.length > 1) body.appendChild(playerSwitch());
    if (!isStandalone()) body.appendChild(installBanner());
    body.appendChild(h('section', {}, h('div', { class: 'actions' },
      action('primary', 'share', 'Send my profile', 'Text or email a coach', function () { shareSheet(p); }),
      action('', 'chat', 'Log a coach contact', 'Email, call, camp, visit', function () { logContactSheet(p.id, function () { renderFamily(); }); }),
      action('', 'cal', 'Request a meeting', 'With your recruiting director', function () { meetingSheet(p); }),
      action('', 'school', 'My schools', 'Search and save schools', function () { goFam('schools'); }))));
    var todo = h('section', {}, h('div', { class: 'sh' }, h('h2', { text: 'Your to-do list' }), h('span', { class: 'when', id: 'taskCount' })),
      h('div', { class: 'phase', text: PHASE_LABEL[phaseFor(p.grad_year)] }), h('div', { class: 'progress' }, h('i', { id: 'bar' })), h('div', { class: 'list', id: 'tasks' }, loading()));
    var ev = h('section', {}, h('div', { class: 'sh' }, h('h2', { text: 'Next event' })), h('div', { id: 'nextEvent' }, loading()));
    var act = h('section', {}, h('div', { class: 'sh' }, h('h2', { text: 'Coach activity' }), h('button', { class: 'link', onclick: function () { goFam('coaches'); }, text: 'See all' })), h('div', { class: 'list', id: 'activity' }, loading()));
    var my = h('section', {}, h('div', { class: 'sh' }, h('h2', { text: 'My schools' }), h('button', { class: 'link', onclick: function () { goFam('schools'); }, text: 'Search' })), h('div', { class: 'list', id: 'mySchools' }, loading()));
    body.appendChild(h('div', { class: 'cols' }, h('div', {}, todo, resources()), h('div', {}, ev, act, my)));

    var pid = p.id, ph = phaseFor(p.grad_year);
    Promise.all([
      sb.from('task_checks').select('*').eq('player_id', pid),
      sb.from('event_rosters').select('team_label,jersey,events(name,starts_on,ends_on,location)').eq('player_id', pid),
      sb.from('coach_contacts').select('*').eq('player_id', pid).order('created_at', { ascending: false }).limit(4),
      sb.from('coach_request_players').select('sent_at,coach_requests(coach_name,college)').eq('player_id', pid).order('sent_at', { ascending: false }).limit(4),
      sb.from('saved_schools').select('status,updated_at,schools(name,division,city,state)').eq('player_id', pid).order('updated_at', { ascending: false }),
      sb.from('player_profiles').select('updated_at').eq('player_id', pid).maybeSingle(),
      sb.from('profile_views').select('viewed_at', { count: 'exact' }).eq('player_id', pid).order('viewed_at', { ascending: false }).limit(1)
    ]).then(function (r) {
      r.forEach(function (x) { if (x.error) throw x.error; });
      // last updated
      var lu = r[5].data && r[5].data.updated_at; if (lu && !saveState.last) { saveState.last = new Date(lu).getTime(); paintSave(); }
      // tasks
      var done = {}; (r[0].data || []).forEach(function (t) { done[t.task_key] = t.checked_at; });
      var list = $('#tasks'); list.innerHTML = '';
      function prog() { var n = TASKS[ph].filter(function (_, i) { return done[ph + '-' + i]; }).length; $('#bar').style.width = (n / TASKS[ph].length * 100) + '%'; $('#taskCount').textContent = n + ' of ' + TASKS[ph].length + ' done'; }
      TASKS[ph].forEach(function (t, i) {
        var key = ph + '-' + i, id = 't-' + key, at = h('div', { class: 'at' });
        var cb = h('input', { type: 'checkbox', id: id, checked: !!done[key] });
        function paint() { at.textContent = done[key] ? 'Checked off ' + stamp(done[key]) : ''; }
        cb.addEventListener('change', function () {
          var req = cb.checked ? sb.from('task_checks').upsert({ player_id: pid, task_key: key, checked_at: new Date().toISOString() }) : sb.from('task_checks').delete().eq('player_id', pid).eq('task_key', key);
          if (cb.checked) done[key] = new Date().toISOString(); else delete done[key];
          paint(); prog(); track(req).catch(function (e) { fail(e, 'Not saved'); });
        });
        paint();
        list.appendChild(h('div', { class: 'task' }, cb, h('label', { for: id }, h('div', { class: 't', text: t[0] }), h('div', { class: 'd', text: t[1] }), at)));
      });
      prog();
      // next event
      var today = new Date().toISOString().slice(0, 10);
      var evs = (r[1].data || []).map(function (x) { return { e: one(x.events), r: x }; }).filter(function (x) { return x.e && (x.e.ends_on || x.e.starts_on) >= today; })
        .sort(function (a, b) { return a.e.starts_on < b.e.starts_on ? -1 : 1; });
      $('#nextEvent').innerHTML = '';
      $('#nextEvent').appendChild(evs.length ? eventCard(evs[0].e, evs[0].r) : h('div', { class: 'empty', text: 'Your directors haven’t added an upcoming event for you yet.' }));
      // activity
      var items = (r[2].data || []).map(function (c) { return { s: (c.school_name || '?').slice(0, 2).toUpperCase(), n: c.school_name || 'School', t: c.notes || c.contact_type, c: 'i', p: c.contact_type.split(' ')[0] === 'Coach' ? 'Reply' : 'Logged', at: c.created_at }; })
        .concat((r[3].data || []).map(function (x) { var q = one(x.coach_requests) || {}; return { s: (q.college || '?').slice(0, 2).toUpperCase(), n: q.college || 'College', t: 'Your director sent your profile to ' + (q.coach_name || 'the coach'), c: 'g', p: 'Sent', at: x.sent_at }; }))
        .sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 4);
      var views = r[6].count || 0;
      if (views) items.unshift({ s: '★', n: 'Profile views', t: views + ' coach view' + (views === 1 ? '' : 's') + ' of your link', c: 'g', p: 'Views', at: r[6].data[0].viewed_at });
      rows($('#activity'), items, 'Last', 'No coach activity yet. Log your first email or call with “Log a coach contact.”');
      // schools
      var ss = (r[4].data || []).slice(0, 4).map(function (x) { var s = one(x.schools) || {}; return { s: (s.name || '?').replace(/[^A-Za-z ]/g, '').split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(), n: s.name, t: (DIV_LABEL[s.division] || '') + ' · ' + (s.city || '') + ', ' + (s.state || ''), c: STATUS_PILL[x.status], p: x.status, at: x.updated_at }; });
      rows($('#mySchools'), ss, 'Updated', 'Tap Schools and star a school to start your list.');
    }).catch(function (e) { fail(e, 'Couldn’t load your home screen'); });
  }
  function loading() { return h('div', { class: 'empty', text: 'Loading…' }); }
  function lockIcon() { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'; return s; }
  var ICONS = { share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>', chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
    cal: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>', school: '<path d="M3 10l9-6 9 6"/><path d="M5 10v9h14v-9"/><path d="M10 19v-5h4v5"/>' };
  function action(cls, icon, title, sub, fn) { var b = h('button', { class: 'act ' + cls, onclick: fn }); b.innerHTML = '<svg viewBox="0 0 24 24">' + ICONS[icon] + '</svg>'; b.append(h('strong', { text: title }), h('span', { text: sub })); return b; }
  function rows(el, data, label, emptyText) {
    el.innerHTML = '';
    if (!data.length) { el.appendChild(h('div', { class: 'empty', style: 'border:0', text: emptyText })); return; }
    data.forEach(function (r) {
      el.appendChild(h('div', { class: 'row' }, h('div', { class: 'mono', text: r.s }),
        h('div', { class: 'meta' }, h('b', { text: r.n || '' }), h('span', { text: r.t || '' }), r.at ? h('time', { datetime: new Date(r.at).toISOString(), text: label + ' ' + short(r.at) }) : null),
        r.p ? h('span', { class: 'pill ' + (r.c || 'i'), text: r.p }) : null));
    });
  }
  function eventCard(e, r) {
    var d = new Date(e.starts_on + 'T12:00:00');
    return h('div', { class: 'event' }, h('div', { class: 'date' }, h('small', { text: d.toLocaleDateString('en-US', { month: 'short' }) }), h('b', { text: String(d.getDate()) })),
      h('div', {}, h('h3', { text: e.name }), h('p', { text: [day(e.starts_on) + (e.ends_on && e.ends_on !== e.starts_on ? ' – ' + day(e.ends_on) : ''), e.location].filter(Boolean).join(' · ') }),
        r && (r.jersey || r.team_label) ? h('div', { class: 'jersey' }, 'Wearing ', r.jersey ? h('b', { text: '#' + r.jersey }) : null, r.team_label ? ' · ' + r.team_label : '') : null));
  }
  function playerSwitch() {
    var s = select(S.players.map(function (p) { return [p.id, p.first_name + ' ' + p.last_name + ' · ' + p.grad_year]; }), S.pid, { 'aria-label': 'Player' });
    s.addEventListener('change', function () { S.pid = s.value; try { localStorage.setItem('tir-pid', s.value); } catch (e) { } saveState.last = null; renderFamily(); });
    return h('div', { class: 'preview' }, h('div', { class: 'lbl', text: 'Viewing player' }), s);
  }
  function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
  function installBanner() {
    var hidden = false; try { hidden = localStorage.getItem('tir-install-hide') === '1'; } catch (e) { }
    if (hidden) return null;
    var el = h('div', { class: 'install' }, h('div', {}, h('b', { text: 'Put Team Illinois Recruiting on your home screen' }),
      'On iPhone, open this page in Safari, tap Share, then Add to Home Screen. On Android, tap the ⋮ menu, then Add to Home screen.'),
      h('button', { 'aria-label': 'Dismiss', text: '×', onclick: function () { el.remove(); try { localStorage.setItem('tir-install-hide', '1'); } catch (e) { } } }));
    return el;
  }
  function resources() {
    return h('section', {}, h('div', { class: 'sh' }, h('h2', { text: 'Resources' })), h('div', { class: 'list res' },
      h('a', { href: 'https://web3.ncaa.org/ecwr3/', target: '_blank', rel: 'noopener' }, 'NCAA Eligibility Center', h('span', { text: 'Register ↗' })),
      h('a', { href: 'https://www.ncaa.org/sports/2021/2/8/recruiting-calendars.aspx', target: '_blank', rel: 'noopener' }, 'NCAA recruiting calendars', h('span', { text: 'Official ↗' })),
      h('a', { href: 'https://studentaid.gov/h/apply-for-aid/fafsa', target: '_blank', rel: 'noopener' }, 'FAFSA financial aid', h('span', { text: 'Apply ↗' }))));
  }

  // ---------------------------------------------------------------- share profile
  function shareMessage(p, coachName) {
    var who = (coachName || '').split(',')[0].trim() || 'Coach';
    return 'Hi ' + who + ',\n\nI’m ' + p.first_name + ' ' + p.last_name + ', a Class of ' + p.grad_year + ' lacrosse player with Team Illinois Lacrosse. My profile, film and upcoming schedule are here:\n' + coachUrl(p.share_token) + '\n\nThank you,\n' + p.first_name;
  }
  function shareSheet(p) {
    sheet(function (box, close) {
      if (!p.share_enabled) { box.append(h('h2', { text: 'Sharing is off' }), h('p', { text: 'Your directors have turned off your coach link. Ask them to turn it back on.' }), h('div', { class: 'btns' }, h('button', { class: 'btn ghost', onclick: close, text: 'Close' }))); return; }
      var coach = h('input', { type: 'text', placeholder: 'Coach Smith, Denver' });
      var msg = h('textarea', { rows: '7' }); msg.value = shareMessage(p, '');
      coach.addEventListener('input', function () { msg.value = shareMessage(p, coach.value); });
      var link = coachUrl(p.share_token);
      var subj = p.first_name + ' ' + p.last_name + ' – Class of ' + p.grad_year + ' – Team Illinois Lacrosse';
      box.append(h('h2', { text: 'Send my profile' }),
        h('p', { text: 'Only people you send this link to can open it, and it always shows your latest info. Coaches can save it as a PDF from the page.' }),
        field('Coach and school', coach), field('Message', msg),
        h('div', { class: 'field' }, h('label', { text: 'Profile link' }), h('div', { class: 'copybox' }, h('input', { readonly: true, value: link }), h('button', { class: 'btn ghost', onclick: function () { copy(link); }, text: 'Copy' }))),
        h('div', { class: 'btns' },
          navigator.share ? h('button', { class: 'btn', onclick: function () { navigator.share({ title: subj, text: msg.value }).catch(function () { }); }, text: 'Share…' }) : null,
          h('a', { class: 'btn ghost', href: 'mailto:?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(msg.value), onclick: function () { this.href = 'mailto:?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(msg.value); }, text: 'Email' }),
          h('a', { class: 'btn ghost', href: 'sms:?&body=' + encodeURIComponent(msg.value), onclick: function () { this.href = 'sms:?&body=' + encodeURIComponent(msg.value); }, text: 'Text' }),
          h('button', { class: 'btn ghost', onclick: function () { copy(msg.value); }, text: 'Copy' })),
        h('p', { class: 'note' }, h('a', { href: link, target: '_blank', rel: 'noopener', text: 'Preview what coaches see ↗' })));
    });
  }

  // ---------------------------------------------------------------- coach log
  var TYPES = ['I emailed the coach', 'Coach emailed me', 'Phone call', 'Camp or clinic', 'Unofficial visit', 'Official visit', 'Other'];
  function logContactSheet(pid, after) {
    loadSchools().then(function (schools) {
      sheet(function (box, close) {
        var sch = select([['', 'Pick a school']].concat(schools.map(function (s) { return [s.id, s.name]; })).concat([['other', 'Other (type it)']]), '');
        var other = h('input', { type: 'text', placeholder: 'School name', hidden: true });
        sch.addEventListener('change', function () { other.hidden = sch.value !== 'other'; });
        var ty = select(TYPES, TYPES[0]), when = h('input', { type: 'date', value: new Date().toISOString().slice(0, 10) }), notes = h('textarea', { rows: '3', placeholder: 'What did they say? Any next step?' });
        var err = h('p', { class: 'note' });
        box.append(h('h2', { text: 'Log a coach contact' }), h('p', { text: 'Only you, your parents and your directors see this log.' }),
          field('School', sch), other, field('Type', ty), field('Date', when), field('Notes', notes), err,
          h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: function () {
            var sid = sch.value && sch.value !== 'other' ? sch.value : null;
            var name = sid ? schools.filter(function (s) { return s.id === sid; })[0].name : other.value.trim();
            if (!name) { err.textContent = 'Pick or type a school.'; return; }
            track(sb.from('coach_contacts').insert({ player_id: pid, school_id: sid, school_name: name, contact_type: ty.value, notes: notes.value.trim() || null, occurred_on: when.value || null }))
              .then(function () { close(); toast('Saved · ' + short(Date.now())); if (after) after(); }, function (e) { fail(e, 'Not saved'); });
          }, text: 'Save contact' }), h('button', { class: 'btn ghost', onclick: close, text: 'Cancel' })));
      });
    });
  }
  function famCoaches(main, p) {
    main.appendChild(topbar('Coaches', 'Your coach log'));
    var body = h('div', { class: 'pad' }); main.appendChild(body);
    body.appendChild(h('div', { class: 'toolrow' }, h('button', { class: 'btn', onclick: function () { logContactSheet(p.id, function () { renderFamily(); }); }, text: '+ Log a coach contact' })));
    var views = h('div', { id: 'viewsBox' }), sent = h('div', { class: 'list', id: 'sentList' }, loading()), log = h('div', { id: 'logList', class: 'grid2' }, loading());
    body.append(h('section', {}, views), h('section', {}, h('div', { class: 'sh' }, h('h2', { text: 'Sent by your directors' })), sent),
      h('section', {}, h('div', { class: 'sh' }, h('h2', { text: 'Your log' })), log));
    contactLog(p.id, log, true);
    Promise.all([sb.from('coach_request_players').select('sent_at,coach_requests(coach_name,college)').eq('player_id', p.id).order('sent_at', { ascending: false }),
      sb.from('profile_views').select('viewed_at', { count: 'exact' }).eq('player_id', p.id).order('viewed_at', { ascending: false }).limit(1)]).then(function (r) {
      rows(sent, (r[0].data || []).map(function (x) { var q = one(x.coach_requests) || {}; return { s: (q.college || '?').slice(0, 2).toUpperCase(), n: q.college, t: q.coach_name ? 'Sent to ' + q.coach_name : '', c: 'g', p: 'Sent', at: x.sent_at }; }), 'Sent', 'When a director sends your profile to a coach, it shows up here.');
      var n = r[1].count || 0;
      views.appendChild(h('div', { class: 'meter' }, h('b', { text: String(n) }), ' coach view' + (n === 1 ? '' : 's') + ' of your profile link', n ? ' · last ' + short(r[1].data[0].viewed_at) : ''));
    });
  }
  function contactLog(pid, el, canDeleteOwn) {
    sb.from('coach_contacts').select('*').eq('player_id', pid).order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).then(function (r) {
      el.innerHTML = '';
      if (r.error) return fail(r.error);
      if (!r.data.length) { el.appendChild(h('div', { class: 'empty', text: 'Nothing logged yet.' })); return; }
      r.data.forEach(function (c) {
        var mine = c.created_by === S.user.id || (S.member && S.member.role === 'director');
        el.appendChild(h('article', { class: 'sc' }, h('div', { class: 'sc-top' }, h('div', { class: 'meta' }, h('b', { class: 'sc-name', text: c.school_name || 'School' }),
          h('div', { class: 'sc-loc', text: c.contact_type + ' · ' + day(c.occurred_on) })),
          canDeleteOwn && mine ? h('button', { class: 'link-x', 'aria-label': 'Delete', text: 'Delete', onclick: function () {
            confirmIn(this, function () { track(sb.from('coach_contacts').delete().eq('id', c.id)).then(function () { contactLog(pid, el, canDeleteOwn); }, fail); });
          } }) : null),
          c.notes ? h('p', { class: 'note', style: 'margin-top:6px', text: c.notes }) : null,
          h('time', { class: 'stamp', text: 'Logged ' + stamp(c.created_at) })));
      });
    });
  }
  function confirmIn(btn, fn) { if (btn.dataset.armed) { fn(); return; } btn.dataset.armed = '1'; btn.textContent = 'Tap again to confirm'; setTimeout(function () { delete btn.dataset.armed; btn.textContent = 'Delete'; }, 3000); }

  // ---------------------------------------------------------------- meetings (family)
  function meetingSheet(p) {
    sheet(function (box, close) {
      var fmt = select(['Video call', 'In person', 'Phone'], 'Video call'), when = h('input', { type: 'text', placeholder: 'e.g. Weeknights after 6, or Sat morning' }), topic = h('textarea', { rows: '3', placeholder: 'e.g. Rank my school list, review my film' });
      var list = h('div', { class: 'list' }, loading());
      box.append(h('h2', { text: 'Request a meeting' }), h('p', { text: 'A recruiting director will confirm a time with you and a parent.' }),
        field('Format', fmt), field('Times that work', when), field('What do you want to cover?', topic),
        h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: function () {
          var req = { format: fmt.value, when: when.value.trim(), topic: topic.value.trim() };
          track(sb.from('meeting_requests').insert({ player_id: p.id, format: req.format, requested_for: req.when || null, topic: req.topic || null }))
            .then(function () { meetingSent(box, close, p, req); }, function (e) { fail(e, 'Not sent'); });
        }, text: 'Send request' }), h('button', { class: 'btn ghost', onclick: close, text: 'Cancel' })),
        h('h3', { class: 'subh', text: 'Your requests' }), list);
      sb.from('meeting_requests').select('*').eq('player_id', p.id).order('created_at', { ascending: false }).limit(5).then(function (r) {
        rows(list, (r.data || []).map(function (m) { return { s: '◷', n: m.format || 'Meeting', t: m.topic || m.requested_for || '', c: m.status === 'Confirmed' || m.status === 'Done' ? 'g' : m.status === 'Cancelled' ? 'w' : 'i', p: m.status, at: m.created_at }; }), 'Requested', 'No requests yet.');
      });
    });
  }

  function meetingSent(box, close, p, req) {
    var to = (C.directorEmails || []).join(',');
    var subj = 'Meeting request: ' + p.first_name + ' ' + p.last_name + ' (Class of ' + p.grad_year + ')';
    var body = 'Hi Team Illinois recruiting directors,\n\nI just requested a meeting in the recruiting app.\n\nPlayer: ' + p.first_name + ' ' + p.last_name + ', Class of ' + p.grad_year +
      '\nFormat: ' + req.format + '\nTimes that work: ' + (req.when || 'Flexible') + '\nWhat we want to cover: ' + (req.topic || 'General check-in') + '\n\nThank you!';
    box.innerHTML = '';
    box.append(h('div', { class: 'grab' }), h('h2', { text: 'Request saved' }),
      h('p', { text: 'Your directors will see it in the app. To make sure they see it today, send them a quick email too.' }),
      h('div', { class: 'btns' },
        to ? h('a', { class: 'btn', href: 'mailto:' + to + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body), text: 'Email the directors' }) : null,
        h('button', { class: 'btn ghost', onclick: function () { copy(body); }, text: 'Copy message' }),
        h('button', { class: 'btn ghost', onclick: close, text: 'Done' })),
      to ? h('p', { class: 'note', text: 'Goes to: ' + (C.directorEmails || []).join(', ') }) : null);
  }

  // ---------------------------------------------------------------- profile (family + director)
  function famProfile(main, p) {
    main.appendChild(topbar('My profile', 'Private · coaches see it only through your link'));
    var body = h('div', { class: 'pad' }); main.appendChild(body);
    body.appendChild(saveBar());
    body.appendChild(h('div', { class: 'toolrow' }, h('a', { class: 'btn ghost', href: coachUrl(p.share_token), target: '_blank', rel: 'noopener', text: 'What coaches see ↗' }),
      h('button', { class: 'btn', onclick: function () { shareSheet(p); }, text: 'Send my profile' })));
    var holder = h('div', {}, loading()); body.appendChild(holder);
    profileEditor(holder, p, false);
  }
  function profileEditor(holder, p, isDirector) {
    Promise.all([sb.from('player_profiles').select('*').eq('player_id', p.id).maybeSingle(), sb.from('player_testing').select('*').eq('player_id', p.id).maybeSingle()]).then(function (r) {
      if (r[0].error) return fail(r[0].error);
      var pr = r[0].data || { player_id: p.id, section_updated: {} }, te = r[1].data;
      if (!saveState.last && pr.updated_at) { saveState.last = new Date(pr.updated_at).getTime(); paintSave(); }
      holder.innerHTML = '';
      var meter = h('div', { class: 'meter' }), bar = h('i', {});
      function paintMeter() { var c = completeness(pr); meter.innerHTML = ''; meter.append('Profile ', h('b', { text: c + '%' }), ' complete · Last updated ' + stamp(pr.updated_at), h('div', { class: 'bar' }, bar)); bar.style.width = c + '%'; }
      paintMeter(); holder.appendChild(meter);
      var secs = h('div', { class: 'psecs' }); holder.appendChild(secs);
      var timers = {};
      SECTIONS.forEach(function (sec) {
        var stampEl = h('time', {});
        function paintT() { var t = (pr.section_updated || {})[sec.id]; stampEl.textContent = t ? 'Updated ' + short(t) : ''; }
        paintT();
        var grid = h('div', { class: 'pgrid' });
        sec.fields.forEach(function (f) {
          var col = f[0], el;
          if (f[2] === 'select') el = select([['', 'Choose']].concat(f[3]), pr[col] || '');
          else if (f[2] === 'textarea') { el = h('textarea', { rows: '2' }); el.value = pr[col] || ''; }
          else el = h('input', { type: f[2] === 'int' || f[2] === 'decimal' ? 'text' : f[2], inputmode: f[2] === 'int' ? 'numeric' : f[2] === 'decimal' ? 'decimal' : null, value: pr[col] === null || pr[col] === undefined ? '' : String(pr[col]) });
          el.id = 'pf-' + col;
          var hint = h('div', { class: 'fhint' });
          el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', function () {
            clearTimeout(timers[col]);
            timers[col] = setTimeout(function () {
              var v = el.value.trim(), val = v === '' ? null : v;
              if (val !== null && f[2] === 'int') { val = parseInt(v.replace(/[^0-9]/g, ''), 10); if (isNaN(val)) { hint.textContent = 'Numbers only'; return; } }
              if (val !== null && f[2] === 'decimal') { val = parseFloat(v); if (isNaN(val)) { hint.textContent = 'Numbers only, like 3.75'; return; } }
              hint.textContent = '';
              var su = Object.assign({}, pr.section_updated || {}); su[sec.id] = new Date().toISOString();
              var patch = { section_updated: su }; patch[col] = val;
              track(sb.from('player_profiles').update(patch).eq('player_id', p.id).select('updated_at').single()).then(function (res) {
                pr[col] = val; pr.section_updated = su; pr.updated_at = res.data.updated_at; paintT(); paintMeter();
              }, function (e) { hint.textContent = /check constraint/i.test(e.message) ? 'That value is out of range.' : 'Not saved: ' + e.message; });
            }, 600);
          });
          grid.appendChild(h('div', { class: 'pf' + (f[4] ? ' full' : '') }, h('label', { for: el.id, text: f[1] }), el, hint));
        });
        secs.appendChild(h('section', { class: 'psec' }, h('div', { class: 'psec-h' }, h('h3', { text: sec.title }), stampEl), grid));
      });
      // testing
      var tgrid = h('div', { class: 'pgrid' }), tStamp = h('time', { text: te && te.updated_at ? 'Updated ' + short(te.updated_at) : '' });
      te = te || { player_id: p.id };
      TEST_FIELDS.forEach(function (f) {
        var el = h('input', { type: f[2] === 'date' ? 'date' : 'text', inputmode: f[2] === 'date' ? null : 'decimal', value: te[f[0]] === null || te[f[0]] === undefined ? '' : String(te[f[0]]), readonly: !isDirector });
        el.id = 'tf-' + f[0];
        if (isDirector) el.addEventListener('input', function () {
          clearTimeout(timers[f[0]]);
          timers[f[0]] = setTimeout(function () {
            var v = el.value.trim(), val = v === '' ? null : f[2] === 'date' ? v : f[2] === 'int' ? parseInt(v, 10) : parseFloat(v);
            if (val !== null && f[2] !== 'date' && isNaN(val)) { toast('Numbers only'); return; }
            var patch = { player_id: p.id }; patch[f[0]] = val;
            track(sb.from('player_testing').upsert(patch).select('updated_at').single()).then(function (res) { te[f[0]] = val; tStamp.textContent = 'Updated ' + short(res.data.updated_at); }, function (e) { fail(e, 'Not saved'); });
          }, 600);
        });
        tgrid.appendChild(h('div', { class: 'pf' }, h('label', { for: el.id, text: f[1] }), el));
      });
      secs.appendChild(h('section', { class: 'psec' }, h('div', { class: 'psec-h' }, h('h3', { text: 'Athletic testing' }), tStamp),
        isDirector ? h('span', { class: 'lock', text: 'Families can see these but can’t edit them' }) : h('span', { class: 'lock', text: '🔒 Entered by your director after testing' }), tgrid));
    });
  }

  // ---------------------------------------------------------------- schools
  function loadSchools() {
    if (S.schools) return Promise.resolve(S.schools);
    return sb.from('schools').select('*').order('name').then(function (r) { if (r.error) { fail(r.error); return []; } S.schools = r.data; return r.data; });
  }
  var EMPTY_F = { div: [], region: [], control: [], size_band: [], acceptance_band: [], test_policy: [], net_price_band: [], athletic_aid: [], field: '', level: 'acc', q: '', mine: false, sort: 'name' };
  function viewSchools(main, p) {
    main.appendChild(topbar('Find schools', 'Men’s lacrosse programs'));
    var body = h('div', { class: 'pad' }); main.appendChild(body);
    if (!S.filters) { try { S.filters = JSON.parse(localStorage.getItem('tir-filters')) || null; } catch (e) { } S.filters = Object.assign(JSON.parse(JSON.stringify(EMPTY_F)), S.filters || {}); }
    var F = S.filters, saved = {};
    function saveF() { try { localStorage.setItem('tir-filters', JSON.stringify(F)); } catch (e) { } }
    var q = h('input', { type: 'search', placeholder: 'Search school, city, state or field', 'aria-label': 'Search schools', value: F.q });
    var fCount = h('b', { hidden: true }), mineBtn = h('button', { class: 'fbtn', 'aria-pressed': String(F.mine), text: '★ My list' });
    var sort = select([['name', 'Sort: Name'], ['acc', 'Sort: Hardest to get in'], ['net', 'Sort: Lowest net price']], F.sort, { 'aria-label': 'Sort by' });
    var divRow = h('div', { class: 'divrow' }), count = h('span', {}), clear = h('button', { hidden: true, text: 'Clear filters' }), list = h('div', { class: 'grid2 g3' }, loading());
    body.append(h('div', { class: 'search' }, q), h('div', { class: 'toolrow' }, h('button', { class: 'fbtn', onclick: openFilters }, 'Filters ', fCount), p ? mineBtn : null, sort), divRow,
      h('div', { class: 'count' }, count, clear), list,
      h('div', { class: 'legend' }, 'Ranges come from public federal data. Schools marked “Sample” are still being verified by your directors.'));
    q.addEventListener('input', function () { F.q = q.value; saveF(); paint(); });
    sort.addEventListener('change', function () { F.sort = sort.value; saveF(); paint(); });
    mineBtn.addEventListener('click', function () { F.mine = !F.mine; mineBtn.setAttribute('aria-pressed', String(F.mine)); saveF(); paint(); });
    clear.addEventListener('click', function () { var s = F.sort; S.filters = F = Object.assign(JSON.parse(JSON.stringify(EMPTY_F)), { sort: s }); q.value = ''; mineBtn.setAttribute('aria-pressed', 'false'); saveF(); paint(); });
    var ACTIVE = ['div', 'region', 'control', 'size_band', 'acceptance_band', 'test_policy', 'net_price_band', 'athletic_aid'];
    function activeCount() { var n = 0; ACTIVE.forEach(function (k) { if (F[k].length) n++; }); if (F.field) n++; return n; }
    function matches(s) {
      var t = F.q.trim().toLowerCase();
      if (t) { var hay = (s.name + ' ' + s.city + ' ' + s.state + ' ' + s.region + ' ' + Object.keys(s.academics || {}).map(function (k) { return FIELDS[k]; }).join(' ')).toLowerCase(); if (t.split(/\s+/).some(function (w) { return hay.indexOf(w) < 0; })) return false; }
      if (F.mine && !saved[s.id]) return false;
      for (var i = 0; i < ACTIVE.length; i++) { var k = ACTIVE[i], v = k === 'div' ? s.division : s[k]; if (F[k].length && F[k].indexOf(v) < 0) return false; }
      if (F.field) { var lv = (s.academics || {})[F.field]; if (!lv) return false; if (F.level === 'top' && lv !== 'top') return false; }
      return true;
    }
    function paint() {
      var schools = (S.schools || []).filter(matches);
      schools.sort(function (a, b) {
        if (F.sort === 'acc') return ((ACC_RANK[a.acceptance_band] || 9) - (ACC_RANK[b.acceptance_band] || 9)) || a.name.localeCompare(b.name);
        if (F.sort === 'net') return ((NET_RANK[a.net_price_band] || 9) - (NET_RANK[b.net_price_band] || 9)) || a.name.localeCompare(b.name);
        return a.name.localeCompare(b.name);
      });
      var n = activeCount(); fCount.hidden = !n; fCount.textContent = n;
      count.textContent = schools.length + ' of ' + S.schools.length + ' programs';
      clear.hidden = !(n || F.q || F.mine);
      divRow.innerHTML = '';
      ['D1', 'D2', 'D3', 'NAIA', 'JUCO'].forEach(function (d) {
        divRow.appendChild(h('button', { class: 'fchip', 'aria-pressed': String(F.div.indexOf(d) > -1), text: DIV_LABEL[d], onclick: function () { var i = F.div.indexOf(d); if (i > -1) F.div.splice(i, 1); else F.div.push(d); saveF(); paint(); } }));
      });
      list.innerHTML = '';
      if (!schools.length) { list.appendChild(h('div', { class: 'empty', text: 'No programs match these filters. Try removing one, or clear them all.' })); return; }
      schools.forEach(function (s) { list.appendChild(schoolCard(s)); });
    }
    function schoolCard(s) {
      var team = s.team_url || searchLink(s.name + " men's lacrosse"), adm = s.admissions_url || searchLink(s.name + ' undergraduate admissions'), camp = s.camps_url || searchLink(s.name + " men's lacrosse camps");
      var badges = h('div', { class: 'badges' }, h('span', { class: 'bd div', text: DIV_LABEL[s.division] }),
        h('span', { class: 'bd ' + (s.athletic_aid === 'No' ? 'noaid' : 'aid'), text: s.athletic_aid === 'No' ? 'No athletic aid' : s.athletic_aid === 'Varies' ? 'Aid varies' : 'Athletic aid' }),
        s.control ? h('span', { class: 'bd', text: s.control }) : null, s.is_sample ? h('span', { class: 'bd sample', text: 'Sample' }) : null);
      Object.keys(FIELDS).forEach(function (k) { var lv = (s.academics || {})[k]; if (lv) badges.appendChild(h('span', { class: 'bd ' + (lv === 'top' ? 'top' : 'acc'), text: FIELD_SHORT[k] + (lv === 'top' ? ' ★' : '') })); });
      var ms = h('div', { class: 'mystatus' }), star = null;
      if (p) {
        star = h('button', { class: 'star', 'aria-label': 'Save ' + s.name + ' to my list', 'aria-pressed': String(!!saved[s.id]) });
        star.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>';
        star.addEventListener('click', function () {
          if (saved[s.id]) { delete saved[s.id]; track(sb.from('saved_schools').delete().eq('player_id', p.id).eq('school_id', s.id)).then(function () { toast('Removed from your list'); }, fail); }
          else { saved[s.id] = { status: 'Researching', updated_at: new Date().toISOString() }; track(sb.from('saved_schools').upsert({ player_id: p.id, school_id: s.id, status: 'Researching' })).then(function () { toast('Added to your list'); }, fail); }
          if (F.mine) paint(); else paintMs();
        });
      }
      function paintMs() {
        ms.innerHTML = ''; if (star) star.setAttribute('aria-pressed', String(!!saved[s.id]));
        var m = saved[s.id]; ms.hidden = !m; if (!m) return;
        var sel = select(STATUS, m.status, { 'aria-label': 'Status for ' + s.name });
        var tm = h('time', { text: 'Updated ' + short(m.updated_at) });
        sel.addEventListener('change', function () { m.status = sel.value; m.updated_at = new Date().toISOString(); tm.textContent = 'Updated ' + short(m.updated_at); track(sb.from('saved_schools').update({ status: sel.value }).eq('player_id', p.id).eq('school_id', s.id)).catch(fail); });
        ms.append(h('label', { text: 'My status' }), sel, tm);
      }
      paintMs();
      var facts = h('div', { class: 'facts' });
      [['Acceptance rate', s.acceptance_band], ['Undergrads', s.size_band], ['Test policy', s.test_policy], ['Avg. net price / yr', s.net_price_band], ['Athletic aid', s.athletic_aid], ['Region', s.region]].forEach(function (f) { facts.appendChild(h('div', {}, h('b', { text: f[1] || '—' }), f[0])); });
      return h('article', { class: 'sc' }, h('div', { class: 'sc-top' }, h('div', { class: 'meta' }, h('a', { class: 'sc-name', href: team, target: '_blank', rel: 'noopener' }, s.name, h('span', { text: 'Team site ↗' })),
        h('div', { class: 'sc-loc', text: [s.city, s.state].filter(Boolean).join(', ') + (s.region ? ' · ' + s.region : '') })), star),
        badges, ms, h('details', {}, h('summary', { text: 'Details' }), facts, h('div', { class: 'rule', text: RULE[s.division] }),
          h('div', { class: 'links' }, h('a', { href: team, target: '_blank', rel: 'noopener', text: 'Team site ↗' }), h('a', { href: adm, target: '_blank', rel: 'noopener', text: 'Admissions ↗' }), h('a', { href: camp, target: '_blank', rel: 'noopener', text: 'Camps ↗' }))));
    }
    var GROUPS = [['div', 'Division', ['D1', 'D2', 'D3', 'NAIA', 'JUCO'], DIV_LABEL], ['athletic_aid', 'Athletic scholarships', ['Yes', 'No', 'Varies'], { Yes: 'Offered', No: 'Not offered (D3)', Varies: 'Varies' }],
      ['region', 'Region', ['Midwest', 'Northeast', 'Mid-Atlantic', 'Southeast', 'West']], ['size_band', 'Undergrad enrollment', ['Under 3,000', '3,000–10,000', '10,000+']],
      ['control', 'Public or private', ['Public', 'Private']], ['acceptance_band', 'Acceptance rate', ['Under 20%', '20–50%', '50%+', 'Open admission']],
      ['test_policy', 'Test policy', ['Required', 'Optional', 'Not used']], ['net_price_band', 'Average net price per year', ['Under $20k', '$20k–35k', '$35k+']]];
    function openFilters() {
      sheet(function (box, close) {
        var fieldSel = select([['', 'Any field']].concat(Object.keys(FIELDS).map(function (k) { return [k, FIELDS[k]]; })), F.field, { 'aria-label': 'Field of study' });
        var lvl = h('div', { class: 'opts' }), show = h('span', {});
        function sync() {
          box.querySelectorAll('[data-g]').forEach(function (g) { var k = g.getAttribute('data-g'); g.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(F[k].indexOf(b.getAttribute('data-v')) > -1)); }); });
          lvl.querySelectorAll('button').forEach(function (b) { b.disabled = !F.field; b.setAttribute('aria-pressed', String(!!F.field && F.level === b.getAttribute('data-lv'))); });
          show.textContent = (S.schools || []).filter(matches).length; saveF(); paint();
        }
        fieldSel.addEventListener('change', function () { F.field = fieldSel.value; sync(); });
        [['acc', 'Accredited program'], ['top', 'Highly ranked (top 50)']].forEach(function (l) { lvl.appendChild(h('button', { class: 'fchip', 'data-lv': l[0], text: l[1], onclick: function () { F.level = l[0]; sync(); } })); });
        box.append(h('h2', { text: 'Filters' }), h('p', { text: 'Pick as many as you want. Results update as you tap.' }),
          h('div', { class: 'fgroup' }, h('h3', { text: 'Academic strength' }), fieldSel, lvl,
            h('div', { class: 'help', text: 'Accredited means the program meets its national standard (ABET for engineering and CS, AACSB for business, CCNE or ACEN for nursing, CAAHEP for exercise science, CAEP for education). Highly ranked is a smaller list your directors update each year.' })));
        GROUPS.forEach(function (g) {
          var opts = h('div', { class: 'opts', 'data-g': g[0] });
          g[2].forEach(function (o) { opts.appendChild(h('button', { class: 'fchip', 'data-v': o, text: (g[3] && g[3][o]) || o, onclick: function () { var i = F[g[0]].indexOf(o); if (i > -1) F[g[0]].splice(i, 1); else F[g[0]].push(o); sync(); } })); });
          box.appendChild(h('div', { class: 'fgroup' }, h('h3', { text: g[1] }), opts));
        });
        box.appendChild(h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: close }, 'Show ', show, ' programs'), h('button', { class: 'btn ghost', onclick: function () { ACTIVE.forEach(function (k) { F[k] = []; }); F.field = ''; fieldSel.value = ''; sync(); }, text: 'Clear all' })));
        sync();
      });
    }
    Promise.all([loadSchools(), p ? sb.from('saved_schools').select('*').eq('player_id', p.id) : Promise.resolve({ data: [] })]).then(function (r) {
      (r[1].data || []).forEach(function (x) { saved[x.school_id] = x; });
      paint();
    });
  }

  // ---------------------------------------------------------------- more (family)
  function famMore(main, p) {
    main.appendChild(topbar('More', p.first_name + ' ' + p.last_name));
    var body = h('div', { class: 'pad' }); main.appendChild(body);
    var acct = S.user.email;
    body.append(
      S.players.length > 1 ? playerSwitch() : null,
      h('section', {}, h('div', { class: 'list res' },
        btnRow('Send my profile to a coach', 'Share', function () { shareSheet(p); }),
        btnRow('Request a meeting with a director', 'Request', function () { meetingSheet(p); }),
        h('a', { href: coachUrl(p.share_token), target: '_blank', rel: 'noopener' }, 'Preview what coaches see', h('span', { text: 'Open ↗' })))),
      h('section', {}, h('div', { class: 'sh' }, h('h2', { text: 'Home screen' })),
        h('div', { class: 'install' }, h('div', {}, h('b', { text: isStandalone() ? 'You’re using the home screen app' : 'Add to your home screen' }),
          isStandalone() ? 'You’re all set.' : 'iPhone: open this page in Safari, tap Share, then Add to Home Screen. Android: tap ⋮, then Add to Home screen. You’ll sign in once more inside the home screen app.'))),
      resources(),
      h('section', {}, h('div', { class: 'sh' }, h('h2', { text: 'Account' })), h('div', { class: 'list res' },
        h('div', { class: 'acct' }, 'Signed in as ', h('b', { text: acct })),
        btnRow('Change password', 'Change', changePassword),
        btnRow('Sign out', 'Sign out', signOut))));
  }
  function btnRow(label, btn, fn) { return h('button', { class: 'rowbtn', onclick: fn }, label, h('span', { text: btn })); }

  // ================================================================ DIRECTOR APP
  function goDir(t) { S.tab = t; S.dir.player = null; renderDirector(); }
  function renderDirector() {
    var main = h('div', {});
    shell(main, DIR_TABS, S.dir.player ? 'roster' : S.tab, goDir);
    if (S.dir.player) return dirPlayer(main, S.dir.player);
    var views = { roster: dirRoster, requests: dirRequests, events: dirEvents, meetings: dirMeetings, dmore: dirMore };
    (views[S.tab] || dirRoster)(main);
    meetingBadge();
  }
  function loadRoster() {
    return Promise.all([
      sb.from('players').select('*, player_profiles(*), player_testing(test_date,updated_at), player_access(user_id,relation)').order('last_name'),
      sb.from('coach_contacts').select('player_id,created_at').order('created_at', { ascending: false })
    ]).then(function (r) {
      if (r[0].error) throw r[0].error;
      var last = {}; (r[1].data || []).forEach(function (c) { if (!last[c.player_id]) last[c.player_id] = c.created_at; });
      S.dir.roster = (r[0].data || []).map(function (p) {
        var pr = one(p.player_profiles) || {}, te = one(p.player_testing) || null, comp = completeness(pr), flags = [];
        if (comp < 80) flags.push('Profile ' + comp + '%');
        if (grade(p.grad_year) >= 11 && (!last[p.id] || Date.now() - new Date(last[p.id]) > 30 * D)) flags.push('No coach contact 30+ days');
        if (!te || !te.test_date || Date.now() - new Date(te.test_date) > 183 * D) flags.push(te && te.test_date ? 'Testing 6+ months old' : 'No testing');
        if (!(p.player_access || []).length) flags.push('No family login');
        return { p: p, pr: pr, te: te, comp: comp, last: last[p.id], flags: flags };
      });
      return S.dir.roster;
    });
  }
  function dirRoster(main) {
    main.appendChild(topbar('Roster', 'Directors only'));
    var body = h('div', { class: 'pad' }); main.appendChild(body);
    var f = S.dir.rf = S.dir.rf || { year: '', need: false, q: '' };
    var q = h('input', { type: 'search', placeholder: 'Search name, position, high school', 'aria-label': 'Search roster', value: f.q });
    var chips = h('div', { class: 'divrow' }), count = h('div', { class: 'count' }), list = h('div', { class: 'grid2 g3' }, loading());
    body.append(h('div', { class: 'toolrow' }, h('button', { class: 'btn', onclick: addPlayerSheet, text: '+ Add player' })), h('div', { class: 'search' }, q), chips, count, list);
    q.addEventListener('input', function () { f.q = q.value; paint(); });
    function paint() {
      chips.innerHTML = '';
      chips.appendChild(h('button', { class: 'fchip', 'aria-pressed': String(f.need), text: '⚠ Needs attention', onclick: function () { f.need = !f.need; paint(); } }));
      gradYears().forEach(function (y) { chips.appendChild(h('button', { class: 'fchip', 'aria-pressed': String(f.year === y), text: 'Class of ' + y, onclick: function () { f.year = f.year === y ? '' : y; paint(); } })); });
      var t = f.q.trim().toLowerCase();
      var rs = (S.dir.roster || []).filter(function (r) {
        if (f.year && r.p.grad_year !== f.year) return false;
        if (f.need && !r.flags.length) return false;
        if (t) { var hay = (r.p.first_name + ' ' + r.p.last_name + ' ' + (r.pr.position || '') + ' ' + (r.pr.high_school || '')).toLowerCase(); if (hay.indexOf(t) < 0) return false; }
        return r.p.status === 'active' || f.year;
      });
      count.textContent = rs.length + ' player' + (rs.length === 1 ? '' : 's') + (f.need ? ' needing attention' : '');
      list.innerHTML = '';
      if (!rs.length) { list.appendChild(h('div', { class: 'empty', text: (S.dir.roster || []).length ? 'No players match.' : 'No players yet. Tap “+ Add player” to add your first one.' })); return; }
      rs.sort(function (a, b) { return a.p.grad_year - b.p.grad_year || a.p.last_name.localeCompare(b.p.last_name); });
      rs.forEach(function (r) {
        list.appendChild(h('button', { class: 'rost', onclick: function () { S.dir.player = r.p.id; S.dir.ptab = 'profile'; renderDirector(); } },
          h('div', { class: 'mono', text: initials(r.p.first_name, r.p.last_name) }),
          h('div', { class: 'meta' }, h('b', { text: r.p.first_name + ' ' + r.p.last_name }),
            h('span', { text: ['Class of ' + r.p.grad_year, r.pr.position, r.pr.gpa_unweighted ? r.pr.gpa_unweighted + ' GPA' : null].filter(Boolean).join(' · ') }),
            r.flags.length ? h('span', { class: 'flags', text: '⚠ ' + r.flags.join(' · ') }) : h('span', { class: 'okflag', text: '✓ On track' })),
          h('div', { class: 'rost-r' }, h('b', { text: r.comp + '%' }), h('small', { text: r.last ? 'Contact ' + short(r.last).split(',')[0] : 'No contacts' }))));
      });
    }
    loadRoster().then(paint, function (e) { fail(e, 'Couldn’t load roster'); });
  }
  function addPlayerSheet() {
    sheet(function (box, close) {
      var fn = h('input', { type: 'text', autocomplete: 'off' }), ln = h('input', { type: 'text', autocomplete: 'off' }), gy = select(gradYears().map(function (y) { return [y, 'Class of ' + y]; }), syEnd() + 1);
      var err = h('p', { class: 'note' });
      box.append(h('h2', { text: 'Add a player' }), field('First name', fn), field('Last name', ln), field('Grad year', gy), err,
        h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: function () {
          if (!fn.value.trim() || !ln.value.trim()) { err.textContent = 'Enter a first and last name.'; return; }
          track(sb.from('players').insert({ first_name: fn.value.trim(), last_name: ln.value.trim(), grad_year: +gy.value }).select().single()).then(function (r) {
            close(); toast('Player added. Now invite the family.'); S.dir.player = r.data.id; S.dir.ptab = 'access'; renderDirector();
          }, function (e) { fail(e, 'Not added'); });
        }, text: 'Add player' }), h('button', { class: 'btn ghost', onclick: close, text: 'Cancel' })));
    });
  }

  function meetingBadge() {
    sb.from('meeting_requests').select('id', { count: 'exact', head: true }).eq('status', 'Requested').then(function (r) {
      var n = r.count || 0, btn = document.querySelector('.tabs nav button[data-tab="meetings"]'); if (!btn) return;
      var old = btn.querySelector('.badge'); if (old) old.remove();
      if (n) btn.appendChild(h('span', { class: 'badge', 'aria-label': n + ' new meeting requests', text: n > 9 ? '9+' : String(n) }));
      if (n && !S.dir.badgeToasted) { S.dir.badgeToasted = true; toast(n + ' meeting request' + (n === 1 ? '' : 's') + ' waiting'); }
    });
  }

  // ---------------------------------------------------------------- director: one player
  function dirPlayer(main, pid) {
    var body = h('div', { class: 'pad' });
    var back = h('button', { class: 'back', onclick: function () { S.dir.player = null; renderDirector(); }, text: '← Roster' });
    main.append(h('header', { class: 'mini pad' }, back), body);
    sb.from('players').select('*').eq('id', pid).single().then(function (r) {
      if (r.error) return fail(r.error);
      var p = r.data;
      body.append(h('div', { class: 'vh' }, h('h2', { text: p.first_name + ' ' + p.last_name }), h('span', { text: 'Class of ' + p.grad_year + ' · ' + gradeLabel(p.grad_year) + (p.status !== 'active' ? ' · ' + p.status : '') })));
      body.appendChild(saveBar());
      var tabs = [['profile', 'Profile'], ['notes', 'Notes'], ['log', 'Coach log'], ['access', 'Family & link'], ['basics', 'Basics']];
      var seg = h('div', { class: 'seg' }), holder = h('div', {});
      tabs.forEach(function (t) { seg.appendChild(h('button', { 'aria-pressed': String((S.dir.ptab || 'profile') === t[0]), text: t[1], onclick: function () { S.dir.ptab = t[0]; renderDirector(); } })); });
      body.append(seg, holder);
      var t = S.dir.ptab || 'profile';
      if (t === 'profile') { holder.appendChild(h('div', { class: 'toolrow' }, h('a', { class: 'btn ghost', href: coachUrl(p.share_token), target: '_blank', rel: 'noopener', text: 'Coach view ↗' }))); var ph = h('div', {}, loading()); holder.appendChild(ph); profileEditor(ph, p, true); }
      if (t === 'notes') dirNotes(holder, p);
      if (t === 'log') { holder.appendChild(h('div', { class: 'toolrow' }, h('button', { class: 'btn', onclick: function () { logContactSheet(p.id, function () { renderDirector(); }); }, text: '+ Log contact' }))); var lg = h('div', { class: 'grid2' }, loading()); holder.appendChild(lg); contactLog(p.id, lg, true); }
      if (t === 'access') dirAccess(holder, p);
      if (t === 'basics') dirBasics(holder, p);
    });
  }
  function dirNotes(holder, p) {
    var ta = h('textarea', { rows: '3', placeholder: 'Private note. Families never see these.' }), list = h('div', { class: 'grid2', style: 'margin-top:14px' }, loading());
    holder.append(h('section', { class: 'psec' }, h('div', { class: 'psec-h' }, h('h3', { text: 'Director notes' })), field('New note', ta, 1),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: function () {
        if (!ta.value.trim()) return;
        track(sb.from('director_notes').insert({ player_id: p.id, body: ta.value.trim() })).then(function () { ta.value = ''; load(); }, fail);
      }, text: 'Save note' }))), list);
    function load() {
      Promise.all([sb.from('director_notes').select('*').eq('player_id', p.id).order('created_at', { ascending: false }), sb.from('members').select('id,full_name,email').eq('role', 'director')]).then(function (r) {
        var who = {}; (r[1].data || []).forEach(function (m) { who[m.id] = m.full_name || m.email; });
        list.innerHTML = '';
        if (!(r[0].data || []).length) { list.appendChild(h('div', { class: 'empty', text: 'No notes yet.' })); return; }
        r[0].data.forEach(function (n) {
          list.appendChild(h('article', { class: 'sc' }, h('p', { class: 'notebody', text: n.body }), h('div', { class: 'sc-top' }, h('time', { class: 'stamp', text: (who[n.created_by] || 'Director') + ' · ' + stamp(n.created_at) }),
            h('button', { class: 'link-x', text: 'Delete', onclick: function () { confirmIn(this, function () { track(sb.from('director_notes').delete().eq('id', n.id)).then(load, fail); }); } }))));
        });
      });
    }
    load();
  }
  function dirAccess(holder, p) {
    var linked = h('div', { class: 'list' }, loading()), invites = h('div', { class: 'grid2' }, loading());
    var email = h('input', { type: 'email', placeholder: 'family@email.com' }), rel = select([['parent', 'Parent'], ['player', 'Player']], 'parent');
    var linkEmail = h('input', { type: 'email', placeholder: 'Email of an existing account' });
    var shareToggle = h('input', { type: 'checkbox', checked: p.share_enabled, id: 'shareT' });
    var link = coachUrl(p.share_token);
    holder.append(
      h('section', { class: 'psec' }, h('div', { class: 'psec-h' }, h('h3', { text: 'Invite a family member' })),
        h('p', { class: 'psec-note', text: 'Creates a one-time code. They tap “First time here” in the app, enter this email and the code, and create their own password.' }),
        h('div', { class: 'pgrid' }, h('div', { class: 'pf full' }, h('label', { text: 'Their email' }), email), h('div', { class: 'pf' }, h('label', { text: 'They are the' }), rel)),
        h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: function () {
          var e = email.value.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(e)) { toast('Enter a valid email'); return; }
          track(sb.from('invites').insert({ email: e, player_id: p.id, relation: rel.value }).select().single()).then(function (r) { email.value = ''; loadAll(); inviteMessage(p, r.data); }, function (e2) { fail(e2, 'Invite not created'); });
        }, text: 'Create invite' }))),
      h('section', {}, h('div', { class: 'sh' }, h('h2', { text: 'Who can sign in' })), linked),
      h('section', {}, h('div', { class: 'sh' }, h('h2', { text: 'Invites' })), invites),
      h('section', { class: 'psec' }, h('div', { class: 'psec-h' }, h('h3', { text: 'Link an existing account' })),
        h('p', { class: 'psec-note', text: 'For a parent who already has a login for another son.' }),
        h('div', { class: 'copybox' }, linkEmail, h('button', { class: 'btn ghost', onclick: function () {
          var e = linkEmail.value.trim().toLowerCase(); if (!e) return;
          sb.from('members').select('id,email').ilike('email', e).maybeSingle().then(function (r) {
            if (!r.data) { toast('No account with that email. Send an invite instead.'); return; }
            track(sb.from('player_access').insert({ player_id: p.id, user_id: r.data.id, relation: 'parent' })).then(function () { linkEmail.value = ''; loadAll(); toast('Linked'); }, fail);
          });
        }, text: 'Link' }))),
      h('section', { class: 'psec' }, h('div', { class: 'psec-h' }, h('h3', { text: 'Coach link' })),
        h('label', { class: 'toggle', for: 'shareT' }, shareToggle, ' Coaches can open this player’s link'),
        h('div', { class: 'copybox', style: 'margin-top:10px' }, h('input', { readonly: true, value: link }), h('button', { class: 'btn ghost', onclick: function () { copy(link); }, text: 'Copy' })),
        h('div', { class: 'btns' }, h('a', { class: 'btn ghost', href: link, target: '_blank', rel: 'noopener', text: 'Open ↗' }),
          h('button', { class: 'btn ghost', onclick: function () { var b = this; if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Tap again: old link stops working'; return; }
            track(sb.from('players').update({ share_token: randomToken() }).eq('id', p.id)).then(function () { toast('New link created'); renderDirector(); }, fail); }, text: 'Make a new link' }))));
    shareToggle.addEventListener('change', function () { track(sb.from('players').update({ share_enabled: shareToggle.checked }).eq('id', p.id)).then(function () { p.share_enabled = shareToggle.checked; toast(shareToggle.checked ? 'Coach link on' : 'Coach link off'); }, fail); });
    function loadAll() {
      Promise.all([sb.from('player_access').select('user_id,relation,created_at').eq('player_id', p.id), sb.from('invites').select('*').eq('player_id', p.id).order('created_at', { ascending: false })]).then(function (r) {
        var ids = (r[0].data || []).map(function (a) { return a.user_id; });
        (ids.length ? sb.from('members').select('id,email,full_name').in('id', ids) : Promise.resolve({ data: [] })).then(function (m) {
          var by = {}; (m.data || []).forEach(function (x) { by[x.id] = x; });
          linked.innerHTML = '';
          if (!ids.length) linked.appendChild(h('div', { class: 'empty', style: 'border:0', text: 'No one can sign in for this player yet. Create an invite above.' }));
          (r[0].data || []).forEach(function (a) {
            var mm = by[a.user_id] || {};
            linked.appendChild(h('div', { class: 'row' }, h('div', { class: 'mono', text: a.relation === 'player' ? 'P' : 'Pa' }), h('div', { class: 'meta' }, h('b', { text: mm.full_name || mm.email || 'Account' }), h('span', { text: (mm.email || '') + ' · ' + a.relation })),
              h('button', { class: 'link-x', text: 'Remove', onclick: function () { var b = this; if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Tap again'; return; } track(sb.from('player_access').delete().eq('player_id', p.id).eq('user_id', a.user_id)).then(loadAll, fail); } })));
          });
        });
        invites.innerHTML = '';
        if (!(r[1].data || []).length) invites.appendChild(h('div', { class: 'empty', text: 'No invites yet.' }));
        (r[1].data || []).forEach(function (iv) {
          invites.appendChild(h('article', { class: 'sc' }, h('div', { class: 'sc-top' }, h('div', { class: 'meta' }, h('b', { class: 'code', text: iv.code }), h('div', { class: 'sc-loc', text: iv.email + ' · ' + iv.relation })),
            iv.used_at ? h('span', { class: 'pill g', text: 'Used' }) : h('span', { class: 'pill i', text: 'Open' })),
            h('time', { class: 'stamp', text: iv.used_at ? 'Used ' + stamp(iv.used_at) : 'Created ' + stamp(iv.created_at) }),
            iv.used_at ? null : h('div', { class: 'btns' }, h('button', { class: 'btn ghost', onclick: function () { inviteMessage(p, iv); }, text: 'Send invite' }),
              h('button', { class: 'btn ghost', onclick: function () { var b = this; if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Tap again'; return; } track(sb.from('invites').delete().eq('code', iv.code)).then(loadAll, fail); }, text: 'Cancel invite' }))));
        });
      });
    }
    loadAll();
  }
  function inviteMessage(p, iv) {
    var msg = 'Hi,\n\nYou’re invited to Team Illinois Recruiting for ' + p.first_name + ' ' + p.last_name + '.\n\n1. Open ' + baseUrl() + '\n2. Tap “First time here”\n3. Enter this email: ' + iv.email + '\n4. Enter invite code: ' + iv.code + '\n5. Create your own password\n\nThen add it to your phone’s home screen. The code works once.\n\nTeam Illinois Lacrosse';
    sheet(function (box, close) {
      var ta = h('textarea', { rows: '11' }); ta.value = msg;
      box.append(h('h2', { text: 'Send the invite' }), h('p', { text: 'Code ' + iv.code + ' for ' + iv.email }), ta,
        h('div', { class: 'btns' }, h('a', { class: 'btn', href: 'mailto:' + encodeURIComponent(iv.email) + '?subject=' + encodeURIComponent('Your Team Illinois Recruiting invite') + '&body=' + encodeURIComponent(msg), text: 'Email' }),
          h('a', { class: 'btn ghost', href: 'sms:?&body=' + encodeURIComponent(msg), text: 'Text' }), h('button', { class: 'btn ghost', onclick: function () { copy(ta.value); }, text: 'Copy' }), h('button', { class: 'btn ghost', onclick: close, text: 'Done' })));
    });
  }
  function dirBasics(holder, p) {
    var fn = h('input', { type: 'text', value: p.first_name }), ln = h('input', { type: 'text', value: p.last_name });
    var gy = select(gradYears().concat(gradYears().indexOf(p.grad_year) < 0 ? [p.grad_year] : []).map(function (y) { return [y, 'Class of ' + y]; }), p.grad_year);
    var st = select([['active', 'Active'], ['graduated', 'Graduated'], ['left', 'Left the club']], p.status);
    holder.append(h('section', { class: 'psec' }, h('div', { class: 'psec-h' }, h('h3', { text: 'Player basics' })), h('div', { class: 'pgrid' },
      h('div', { class: 'pf' }, h('label', { text: 'First name' }), fn), h('div', { class: 'pf' }, h('label', { text: 'Last name' }), ln), h('div', { class: 'pf' }, h('label', { text: 'Grad year' }), gy), h('div', { class: 'pf' }, h('label', { text: 'Status' }), st)),
      h('p', { class: 'psec-note', text: 'Graduated or left: the player drops off the roster and the coach link stops working.' }),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: function () {
        if (!fn.value.trim() || !ln.value.trim()) { toast('Name can’t be blank'); return; }
        track(sb.from('players').update({ first_name: fn.value.trim(), last_name: ln.value.trim(), grad_year: +gy.value, status: st.value }).eq('id', p.id)).then(function () { toast('Saved'); renderDirector(); }, fail);
      }, text: 'Save basics' }))));
  }

  // ---------------------------------------------------------------- director: coach requests
  function dirRequests(main) {
    main.appendChild(topbar('Coach requests', 'Send players to a college coach'));
    var body = h('div', { class: 'pad' }); main.appendChild(body);
    var list = h('div', { class: 'grid2' }, loading());
    body.append(h('div', { class: 'toolrow' }, h('button', { class: 'btn', onclick: function () { newRequest(main); }, text: '+ New coach request' })), list);
    sb.from('coach_requests').select('*, coach_request_players(sent_at, players(first_name,last_name,grad_year,share_token))').order('created_at', { ascending: false }).then(function (r) {
      list.innerHTML = '';
      if (r.error) return fail(r.error);
      if (!r.data.length) { list.appendChild(h('div', { class: 'empty', text: 'When a coach asks “who do you have?”, tap New coach request, filter the roster, and send profiles in one message.' })); return; }
      r.data.forEach(function (q) {
        var ps = (q.coach_request_players || []).map(function (x) { return one(x.players); }).filter(Boolean);
        list.appendChild(h('article', { class: 'sc' }, h('div', { class: 'sc-top' }, h('div', { class: 'meta' }, h('b', { class: 'sc-name', text: q.college }), h('div', { class: 'sc-loc', text: q.coach_name + (q.coach_contact ? ' · ' + q.coach_contact : '') }))),
          q.request_text ? h('p', { class: 'note', text: '“' + q.request_text + '”' }) : null,
          h('p', { class: 'note', text: 'Sent: ' + (ps.map(function (p) { return p.first_name + ' ' + p.last_name + ' (' + p.grad_year + ')'; }).join(', ') || 'none') }),
          h('div', { class: 'sc-top' }, h('time', { class: 'stamp', text: stamp(q.created_at) }), h('button', { class: 'link-x', text: 'Message again', onclick: function () { requestMessage(q, ps); } }))));
      });
    });
  }
  function newRequest(main) {
    main.innerHTML = '';
    var body = h('div', { class: 'pad' });
    main.append(h('header', { class: 'mini pad' }, h('button', { class: 'back', onclick: function () { renderDirector(); }, text: '← Requests' })), body);
    var cn = h('input', { type: 'text', placeholder: 'Coach Smith' }), col = h('input', { type: 'text', placeholder: 'Denver' }), cc = h('input', { type: 'text', placeholder: 'Email or phone' }), rt = h('textarea', { rows: '2', placeholder: 'What did they ask for? e.g. 2028 defensemen, 3.5+ GPA' });
    var gy = select([['', 'Any class']].concat(gradYears().map(function (y) { return [y, 'Class of ' + y]; })), ''), pos = select([['', 'Any position']].concat(POSITIONS), ''), gpa = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'e.g. 3.5' });
    var picks = {}, list = h('div', {}, loading()), cnt = h('span', {});
    body.append(h('div', { class: 'vh' }, h('h2', { text: 'New coach request' })),
      h('section', { class: 'psec' }, h('div', { class: 'pgrid' }, h('div', { class: 'pf' }, h('label', { text: 'Coach' }), cn), h('div', { class: 'pf' }, h('label', { text: 'College' }), col),
        h('div', { class: 'pf full' }, h('label', { text: 'Coach contact (optional)' }), cc), h('div', { class: 'pf full' }, h('label', { text: 'Their request (optional)' }), rt))),
      h('section', { class: 'psec' }, h('div', { class: 'psec-h' }, h('h3', { text: 'Find players' })), h('div', { class: 'pgrid' }, h('div', { class: 'pf' }, h('label', { text: 'Class' }), gy), h('div', { class: 'pf' }, h('label', { text: 'Position' }), pos), h('div', { class: 'pf' }, h('label', { text: 'Min GPA' }), gpa))),
      list, h('div', { class: 'stickybar' }, h('button', { class: 'btn', onclick: save }, 'Save and write message (', cnt, ')')));
    [gy, pos].forEach(function (s) { s.addEventListener('change', paint); }); gpa.addEventListener('input', paint);
    function paint() {
      var min = parseFloat(gpa.value) || 0;
      var rs = (S.dir.roster || []).filter(function (r) { return r.p.status === 'active' && (!gy.value || r.p.grad_year === +gy.value) && (!pos.value || r.pr.position === pos.value) && (!min || (r.pr.gpa_unweighted || 0) >= min); });
      list.innerHTML = '';
      if (!rs.length) list.appendChild(h('div', { class: 'empty', text: 'No players match.' }));
      rs.forEach(function (r) {
        var id = 'pick-' + r.p.id, cb = h('input', { type: 'checkbox', id: id, checked: !!picks[r.p.id] });
        cb.addEventListener('change', function () { if (cb.checked) picks[r.p.id] = r; else delete picks[r.p.id]; cnt.textContent = Object.keys(picks).length; });
        var te = r.te || {};
        list.appendChild(h('label', { class: 'task pickrow', for: id }, cb, h('div', { class: 'meta' }, h('div', { class: 't', text: r.p.first_name + ' ' + r.p.last_name + ' · ' + r.p.grad_year }),
          h('div', { class: 'd', text: [r.pr.position, r.pr.gpa_unweighted ? r.pr.gpa_unweighted + ' GPA' : null, r.pr.club_team, r.p.share_enabled ? null : 'coach link OFF'].filter(Boolean).join(' · ') }))));
      });
      cnt.textContent = Object.keys(picks).length;
    }
    function save() {
      var ids = Object.keys(picks);
      if (!cn.value.trim() || !col.value.trim()) { toast('Enter the coach and college'); return; }
      if (!ids.length) { toast('Pick at least one player'); return; }
      track(sb.from('coach_requests').insert({ coach_name: cn.value.trim(), college: col.value.trim(), coach_contact: cc.value.trim() || null, request_text: rt.value.trim() || null, grad_year: gy.value ? +gy.value : null, position: pos.value || null }).select().single()).then(function (r) {
        return track(sb.from('coach_request_players').insert(ids.map(function (id) { return { request_id: r.data.id, player_id: id }; }))).then(function () {
          requestMessage(r.data, ids.map(function (id) { return picks[id].p; })); S.tab = 'requests'; renderDirector();
        });
      }).catch(function (e) { fail(e, 'Not saved'); });
    }
    (S.dir.roster ? Promise.resolve() : loadRoster()).then(paint, fail);
  }
  function requestMessage(q, players) {
    var lines = players.map(function (p) { return '• ' + p.first_name + ' ' + p.last_name + ' (Class of ' + p.grad_year + '): ' + coachUrl(p.share_token); }).join('\n');
    var msg = 'Coach ' + (q.coach_name || '').replace(/^coach\s+/i, '') + ',\n\nThanks for reaching out. Here are the Team Illinois players we discussed. Each link has their academics, film, testing and upcoming schedule, and you can save it as a PDF:\n\n' + lines + '\n\nTeam Illinois Lacrosse Recruiting';
    var contact = q.coach_contact || '', isEmail = /@/.test(contact);
    sheet(function (box, close) {
      var ta = h('textarea', { rows: '12' }); ta.value = msg;
      box.append(h('h2', { text: 'Message to ' + q.college }), ta, h('div', { class: 'btns' },
        h('a', { class: 'btn', href: 'mailto:' + (isEmail ? encodeURIComponent(contact) : '') + '?subject=' + encodeURIComponent('Team Illinois Lacrosse players') + '&body=' + encodeURIComponent(msg), text: 'Email' }),
        h('a', { class: 'btn ghost', href: 'sms:' + (!isEmail ? contact.replace(/[^0-9+]/g, '') : '') + '?&body=' + encodeURIComponent(msg), text: 'Text' }),
        h('button', { class: 'btn ghost', onclick: function () { copy(ta.value); }, text: 'Copy' }), h('button', { class: 'btn ghost', onclick: close, text: 'Done' })));
    });
  }

  // ---------------------------------------------------------------- director: events
  function dirEvents(main) {
    main.appendChild(topbar('Events', 'Tournaments and showcases'));
    var body = h('div', { class: 'pad' }); main.appendChild(body);
    var list = h('div', { class: 'grid2' }, loading());
    body.append(h('div', { class: 'toolrow' }, h('button', { class: 'btn', onclick: function () { eventSheet(null); }, text: '+ Add event' })), list);
    sb.from('events').select('*, event_rosters(player_id)').order('starts_on', { ascending: false }).then(function (r) {
      list.innerHTML = '';
      if (r.error) return fail(r.error);
      if (!r.data.length) { list.appendChild(h('div', { class: 'empty', text: 'Add each tournament once. Players you add to it see it on their home screen and coach sheet.' })); return; }
      var today = new Date().toISOString().slice(0, 10);
      r.data.forEach(function (e) {
        var past = (e.ends_on || e.starts_on) < today;
        list.appendChild(h('div', { class: past ? 'past' : '' }, eventCard(e, null), h('div', { class: 'btns', style: 'margin:6px 0 14px' },
          h('button', { class: 'btn ghost', onclick: function () { eventRoster(e); }, text: 'Players (' + (e.event_rosters || []).length + ')' }),
          h('button', { class: 'btn ghost', onclick: function () { eventSheet(e); }, text: 'Edit' }))));
      });
    });
  }
  function eventSheet(e) {
    sheet(function (box, close) {
      var nm = h('input', { type: 'text', value: e ? e.name : '' }), s1 = h('input', { type: 'date', value: e ? e.starts_on : '' }), s2 = h('input', { type: 'date', value: e && e.ends_on ? e.ends_on : '' }), loc = h('input', { type: 'text', value: e && e.location ? e.location : '', placeholder: 'Venue, city' });
      box.append(h('h2', { text: e ? 'Edit event' : 'Add event' }), field('Name', nm), field('Starts', s1), field('Ends (optional)', s2), field('Location', loc),
        h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: function () {
          if (!nm.value.trim() || !s1.value) { toast('Enter a name and start date'); return; }
          var row = { name: nm.value.trim(), starts_on: s1.value, ends_on: s2.value || null, location: loc.value.trim() || null };
          track(e ? sb.from('events').update(row).eq('id', e.id) : sb.from('events').insert(row)).then(function () { close(); renderDirector(); }, fail);
        }, text: 'Save' }), e ? h('button', { class: 'btn ghost', onclick: function () { var b = this; if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Tap again to delete'; return; } track(sb.from('events').delete().eq('id', e.id)).then(function () { close(); renderDirector(); }, fail); }, text: 'Delete' }) : null,
          h('button', { class: 'btn ghost', onclick: close, text: 'Cancel' })));
    });
  }
  function eventRoster(e) {
    Promise.all([S.dir.roster ? Promise.resolve() : loadRoster(), sb.from('event_rosters').select('*').eq('event_id', e.id)]).then(function (r) {
      var cur = {}; (r[1].data || []).forEach(function (x) { cur[x.player_id] = x; });
      sheet(function (box, close) {
        var gy = select([['', 'All classes']].concat(gradYears().map(function (y) { return [y, 'Class of ' + y]; })), ''), list = h('div', {});
        box.append(h('h2', { text: e.name }), h('p', { text: 'Check who’s playing. Team and jersey are optional; jersey defaults to their club number.' }), field('Show', gy), list,
          h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: saveR, text: 'Save players' }), h('button', { class: 'btn ghost', onclick: close, text: 'Cancel' })));
        gy.addEventListener('change', paint);
        var state = {};
        S.dir.roster.forEach(function (rr) { var c = cur[rr.p.id]; state[rr.p.id] = { on: !!c, team: c ? c.team_label || '' : '', jersey: c ? c.jersey || '' : (rr.pr.club_jersey || '') }; });
        function paint() {
          list.innerHTML = '';
          S.dir.roster.filter(function (rr) { return rr.p.status === 'active' && (!gy.value || rr.p.grad_year === +gy.value); }).forEach(function (rr) {
            var st = state[rr.p.id], cb = h('input', { type: 'checkbox', checked: st.on }), tm = h('input', { type: 'text', placeholder: 'Team', value: st.team }), js = h('input', { type: 'text', placeholder: '#', value: st.jersey, style: 'width:4.5em' });
            cb.addEventListener('change', function () { st.on = cb.checked; }); tm.addEventListener('input', function () { st.team = tm.value; }); js.addEventListener('input', function () { st.jersey = js.value; });
            list.appendChild(h('div', { class: 'evrow' }, h('label', {}, cb, ' ' + rr.p.first_name + ' ' + rr.p.last_name + ' · ' + rr.p.grad_year), tm, js));
          });
        }
        paint();
        function saveR() {
          var ups = [], dels = [];
          Object.keys(state).forEach(function (pid) { var st = state[pid]; if (st.on) ups.push({ event_id: e.id, player_id: pid, team_label: st.team.trim() || null, jersey: st.jersey.trim() || null }); else if (cur[pid]) dels.push(pid); });
          var jobs = []; if (ups.length) jobs.push(track(sb.from('event_rosters').upsert(ups))); if (dels.length) jobs.push(track(sb.from('event_rosters').delete().eq('event_id', e.id).in('player_id', dels)));
          Promise.all(jobs).then(function () { close(); toast('Saved'); renderDirector(); }, fail);
        }
      });
    }, fail);
  }

  // ---------------------------------------------------------------- director: meetings
  function dirMeetings(main) {
    main.appendChild(topbar('Meetings', 'Requests from families'));
    var body = h('div', { class: 'pad' }); main.appendChild(body);
    var list = h('div', { class: 'grid2' }, loading()); body.appendChild(list);
    sb.from('meeting_requests').select('*, players(first_name,last_name,grad_year)').order('created_at', { ascending: false }).limit(100).then(function (r) {
      if (r.data) r.data.sort(function (a, b) { return (a.status === 'Requested' ? 0 : 1) - (b.status === 'Requested' ? 0 : 1); });
      list.innerHTML = '';
      if (r.error) return fail(r.error);
      if (!r.data.length) { list.appendChild(h('div', { class: 'empty', text: 'No meeting requests yet.' })); return; }
      r.data.forEach(function (m) {
        var p = one(m.players) || {}, st = select(['Requested', 'Confirmed', 'Done', 'Cancelled'], m.status, { 'aria-label': 'Status' });
        st.addEventListener('change', function () { track(sb.from('meeting_requests').update({ status: st.value }).eq('id', m.id)).then(meetingBadge, fail); });
        list.appendChild(h('article', { class: 'sc' }, h('div', { class: 'sc-top' }, h('div', { class: 'meta' }, h('b', { class: 'sc-name', text: (p.first_name || '') + ' ' + (p.last_name || '') + ' · ' + (p.grad_year || '') }),
          h('div', { class: 'sc-loc', text: [m.format, m.requested_for].filter(Boolean).join(' · ') })), st),
          m.topic ? h('p', { class: 'note', text: m.topic }) : null, h('time', { class: 'stamp', text: 'Requested ' + stamp(m.created_at) })));
      });
    });
  }

  // ---------------------------------------------------------------- director: more
  function dirMore(main) {
    main.appendChild(topbar('More', S.user.email));
    var body = h('div', { class: 'pad' }); main.appendChild(body);
    var dirs = h('div', { class: 'list' }, loading()), newDir = h('input', { type: 'email', placeholder: 'name@teamillinoislax.com' });
    var years = h('div', { class: 'divrow' }), schoolsBox = h('div', {});
    body.append(
      h('section', {}, h('div', { class: 'sh' }, h('h2', { text: 'Directors' })), dirs,
        h('p', { class: 'note', text: 'To add a director: add their email here. They open the app, tap “First time here,” leave the invite code blank, and create a password.' }),
        h('div', { class: 'copybox', style: 'margin-top:8px' }, newDir, h('button', { class: 'btn ghost', onclick: function () {
          var e = newDir.value.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(e)) return;
          track(sb.from('director_emails').upsert({ email: e })).then(function () {
            return sb.from('members').select('id').ilike('email', e).maybeSingle().then(function (m) { if (m.data) return track(sb.from('members').update({ role: 'director' }).eq('id', m.data.id)); });
          }).then(function () { newDir.value = ''; loadDirs(); toast('Director added'); }, fail);
        }, text: 'Add' }))),
      h('section', {}, h('div', { class: 'sh' }, h('h2', { text: 'Grad classes' })), years,
        h('p', { class: 'note', text: 'Classes roll over automatically every August 1. Add a younger class early if you need it.' }),
        h('button', { class: 'btn ghost', onclick: function () { var y = gradYears()[gradYears().length - 1] + 1; track(sb.from('grad_classes').insert({ grad_year: y })).then(function () { gradExtra.push(y); toast('Added Class of ' + y); renderDirector(); }, fail); }, text: '+ Add next class' })),
      h('section', {}, h('div', { class: 'sh' }, h('h2', { text: 'Schools' })), schoolsBox),
      h('section', {}, h('div', { class: 'sh' }, h('h2', { text: 'Account' })), h('div', { class: 'list res' }, btnRow('Change password', 'Change', changePassword), btnRow('Sign out', 'Sign out', signOut))));
    gradYears().forEach(function (y) { years.appendChild(h('span', { class: 'fchip', text: 'Class of ' + y + ' · ' + gradeLabel(y) })); });
    function loadDirs() {
      Promise.all([sb.from('director_emails').select('*').order('email'), sb.from('members').select('email').eq('role', 'director')]).then(function (r) {
        var active = {}; (r[1].data || []).forEach(function (m) { if (m.email) active[m.email.toLowerCase()] = 1; });
        rows(dirs, (r[0].data || []).map(function (d) { return { s: d.email[0].toUpperCase(), n: d.email, t: active[d.email.toLowerCase()] ? 'Has a login' : 'No login yet', c: active[d.email.toLowerCase()] ? 'g' : 'w', p: active[d.email.toLowerCase()] ? 'Active' : 'Pending' }; }), '', '');
      });
    }
    loadDirs();
    loadSchools().then(function (sc) {
      var samples = sc.filter(function (s) { return s.is_sample; }).length;
      schoolsBox.append(h('p', { class: 'note', text: sc.length + ' schools in the list, ' + samples + ' still marked Sample. Families see the same list on their Schools tab.' }),
        h('button', { class: 'btn ghost', onclick: function () { var m = h('div', {}); main.innerHTML = ''; main.append(h('header', { class: 'mini pad' }, h('button', { class: 'back', onclick: function () { renderDirector(); }, text: '← More' })), m); viewSchools(m, null); }, text: 'Browse schools' }));
    });
  }

  // ================================================================ BOOT
  sb.auth.onAuthStateChange(function (event) {
    if (event === 'PASSWORD_RECOVERY') showSetPassword();
  });
  var recovering = /type=recovery/.test(location.hash);
  sb.auth.getSession().then(function (r) {
    if (recovering) { setTimeout(function () { if (!$('#boot').hidden) { if (r.data && r.data.session) showSetPassword(); else showAuth('signin', 'That reset link has expired. Request a new one.'); } }, 1500); return; }
    if (r.data && r.data.session) start(); else showAuth('signin');
  }, function () { showAuth('signin'); });
})();
