/* Team Illinois Recruiting — Fit engine (directors' guide, never shown to families).
   Pure functions: questionnaire answers + profile + school data in, plain-language findings out.
   Cost and admissions figures come from the federal College Scorecard (most recent release),
   so they are estimates for planning, not quotes. */
(function () {
  'use strict';
  var Q = window.TIR_Q;
  var BUDGET_MAX = { 'Under 10000': 10000, '10000 to 20000': 20000, '20001 to 30000': 30000, '30001 to 45000': 45000, '45001 to 60000': 60000, '60000 plus': Infinity };
  var COAST = ['CT', 'MA', 'ME', 'NH', 'RI', 'VT', 'NY', 'NJ', 'PA', 'DE', 'MD', 'DC', 'VA', 'NC', 'SC', 'GA', 'FL'];
  var ACADEMY_NAME = { 'Army, West Point': 'Army', 'Navy, Annapolis': 'Navy', 'Air Force': 'Air Force', 'Coast Guard': 'Coast Guard', 'Merchant Marine': 'Merchant Marine' };

  function money(n) { return n === null || n === undefined || !isFinite(n) ? '' : '$' + Math.round(n / 1000) + 'k'; }
  function arr(v) { if (Array.isArray(v)) return v; if (v === undefined || v === null || v === '') return []; return String(v).split(/\s*;\s*/).filter(Boolean); }
  function has(list, v) { return arr(list).indexOf(v) > -1; }

  // ---------------------------------------------------------------- location
  function homeLoc(zip) {
    var z = String(zip || '').replace(/[^0-9]/g, '').slice(0, 3);
    var t = window.TIR_ZIP3 && window.TIR_ZIP3[z];
    return t ? { lat: t[0], lon: t[1], state: t[2] } : null;
  }
  function miles(a, b) {
    if (!a || !b || a.lat === null || b.lat === null || a.lat === undefined || b.lat === undefined) return null;
    var R = 3959, toR = Math.PI / 180, dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
  }
  function distanceBand(mi) { if (mi === null) return null; return mi <= 150 ? 'Within 3 hours' : mi <= 500 ? 'Day’s drive' : 'Flight is fine'; }
  function distanceLabel(mi) { if (mi === null) return ''; return mi <= 150 ? 'about ' + mi + ' mi (drive)' : mi <= 500 ? 'about ' + mi + ' mi (day’s drive)' : 'about ' + mi + ' mi (flight)'; }

  // ---------------------------------------------------------------- school helpers
  function sizeBand(n) { if (!n) return null; return n < 4500 ? 'Small, under 4500' : n <= 9000 ? 'Medium, 4501 to 9000' : 'Large, 9000 plus'; }
  function settingAnswer(s) { return s === 'Small college town' ? 'College town' : s; }
  function stickerFor(school, homeState) {
    if (school.special === 'academy') return 0;
    var outOfState = school.control === 'Public' && homeState && school.state !== homeState;
    return outOfState ? (school.coa_out || school.coa) : school.coa;
  }
  function groupMatch(school, group) {
    var c = school.conference || '', d = school.division;
    if (group === 'Ivy League') return c === 'Ivy League';
    if (group === 'Patriot League') return c === 'Patriot League';
    if (group === 'NESCAC') return c === 'NESCAC';
    if (group === 'Centennial') return c === 'Centennial';
    if (group === 'Liberty League or UAA') return c === 'Liberty League';
    if (group === 'NCAC and Midwest D3') return c === 'NCAC' || (d === 'D3' && school.region === 'Midwest');
    if (group === 'Big Ten or ACC level D1') return c === 'Big Ten' || c === 'ACC';
    return false;
  }
  function regionMatch(school, picks) {
    picks = arr(picks); if (!picks.length || has(picks, 'Anywhere')) return true;
    return picks.some(function (r) { return r === 'East coast and New England' ? COAST.indexOf(school.state) > -1 : school.region === r; });
  }
  function divisionMatch(school, picks) {
    picks = arr(picks); if (!picks.length || has(picks, 'Open to anything')) return true;
    return has(picks, school.division);
  }

  // Accounting, finance and marketing are often concentrations inside a business degree, so a business major counts.
  var BUSINESS_PARTS = { acct: 1, fin: 1, mkt: 1 };
  function offers(school, key) {
    var m = school.majors || [];
    if (m.indexOf(key) > -1) return true;
    if (BUSINESS_PARTS[key] && m.indexOf('bus') > -1) return true;
    return false;
  }

  // ---------------------------------------------------------------- one school vs one family
  function schoolFit(school, a, profile) {
    a = a || {}; profile = profile || {};
    var home = homeLoc(a.home_zip || profile.home_zip), out = { name: school.short_name || school.name };
    // cost
    var B = BUDGET_MAX[a.budget], sticker = stickerFor(school, home && home.state), net = school.net_price;
    var publicOut = school.control === 'Public' && home && school.state !== home.state;
    if (school.special === 'academy') out.cost = { level: a.service_commitment === 'That stops us' ? 'stretch' : 'ok', text: 'No tuition. Graduates owe a service commitment.' };
    else if (!sticker) out.cost = { level: 'unknown', text: 'No federal cost data.' };
    else if (B === undefined) out.cost = { level: 'unknown', text: 'Sticker ' + money(sticker) + '/yr' + (net && !publicOut ? ', average after aid ' + money(net) : '') + '. Budget not given.' };
    else if (sticker <= B) out.cost = { level: 'ok', text: 'Fits even at full price (' + money(sticker) + '/yr' + (publicOut ? ' out of state' : '') + ').' };
    else if (net && !publicOut && net <= B) out.cost = { level: 'maybe', text: 'Sticker ' + money(sticker) + '; average family pays ' + money(net) + ' after aid. Depends on their aid. Run the net price calculator.' };
    else {
      var gap = sticker - B, why = school.athletic_aid === 'No' ? (school.special === 'ivy' ? 'Ivy League: no athletic or merit money, need-based aid only.' : 'D3: no athletic money; need-based or merit aid only.') : 'Needs about ' + money(gap) + '/yr in aid or athletic money.';
      out.cost = { level: 'stretch', text: 'Sticker ' + money(sticker) + '/yr' + (publicOut ? ' out of state' : '') + ' vs budget up to ' + money(B) + '. ' + why };
    }
    // academics
    var sat = +(a.sat || profile.sat) || null, act = +(a.act || profile.act) || null, ad = school.adm_rate;
    var lvl = null, txt = '';
    if (sat && school.sat25 && school.sat75) { lvl = sat < school.sat25 ? 'reach' : sat > school.sat75 ? 'strong' : 'fit'; txt = 'SAT ' + sat + ' vs their middle 50% ' + school.sat25 + '–' + school.sat75 + '.'; }
    else if (act && school.act25 && school.act75) { lvl = act < school.act25 ? 'reach' : act > school.act75 ? 'strong' : 'fit'; txt = 'ACT ' + act + ' vs their middle 50% ' + school.act25 + '–' + school.act75 + '.'; }
    if (ad !== null && ad !== undefined) {
      var pct = Math.round(ad * 100);
      if (!lvl) lvl = ad < 0.2 ? 'reach' : ad < 0.5 ? 'fit' : 'ok';
      txt += (txt ? ' ' : '') + 'Admits ' + pct + '% of applicants.';
      if (ad < 0.2) txt += ' Even with coach support, needs top grades and course rigor.';
    }
    out.academic = { level: lvl || 'unknown', text: txt || 'No federal admissions data.' };
    // distance
    var mi = home ? miles(home, { lat: school.lat, lon: school.lon }) : null;
    out.miles = mi;
    var pref = a.distance, band = distanceBand(mi);
    var order = ['Within 3 hours', 'Day’s drive', 'Flight is fine', 'No limit'];
    out.distanceOk = !pref || pref === 'No limit' || pref === 'Flight is fine' || mi === null ? true : order.indexOf(band) <= order.indexOf(pref);
    // preferences
    var majors = arr(a.majors).filter(function (m) { return Q.MAJOR_KEY[m]; });
    out.majorsMissing = majors.filter(function (m) { return !offers(school, Q.MAJOR_KEY[m]); });
    out.divisionOk = divisionMatch(school, a.divisions);
    out.regionOk = regionMatch(school, a.region);
    var sizes = arr(a.size); out.sizeOk = !sizes.length || has(sizes, 'No preference') || has(sizes, sizeBand(school.undergrads));
    var sets = arr(a.setting); out.settingOk = !sets.length || has(sets, 'No preference') || has(sets, settingAnswer(school.setting));
    return out;
  }

  // ---------------------------------------------------------------- priorities
  function priorities(a) {
    var vals = Q.SCALES.map(function (sc) { return { key: sc[0], label: sc[1], v: a && a[sc[0]] !== undefined && a[sc[0]] !== null && a[sc[0]] !== '' ? +a[sc[0]] : null }; });
    var set = vals.filter(function (x) { return x.v !== null; });
    var uniq = set.map(function (x) { return x.v; }).filter(function (v, i, s) { return s.indexOf(v) === i; });
    var tens = set.filter(function (x) { return x.v === 10; }).length;
    var sorted = set.slice().sort(function (x, y) { return y.v - x.v; });
    return { all: vals, top: sorted.slice(0, 3), bottom: sorted.slice(-3).reverse(), answered: set.length,
      unreliable: set.length >= 8 && uniq.length === 1 ? 'Every rating is ' + uniq[0] + '. Treat these as unanswered.' : tens >= 6 ? tens + ' of 11 rated 10. Hard to tell what really matters.' : null };
  }

  // ---------------------------------------------------------------- expectations to set
  function expectations(a, profile, saved, schools, gradYear) {
    a = a || {}; profile = profile || {}; saved = saved || []; var f = [];
    function add(level, text) { f.push({ level: level, text: text }); }
    var B = BUDGET_MAX[a.budget], groups = arr(a.academic_groups), divs = arr(a.divisions);
    var needMoney = a.d3_cost_reaction === 'Need merit or athletic money';
    if (has(groups, 'Ivy League') && (needMoney || (B !== undefined && B <= 30000) || a.budget === 'Still figuring it out'))
      add('talk', 'Wants the Ivy League' + (needMoney ? ' but said they need merit or athletic money' : B !== undefined ? ' with a budget up to ' + money(B) : ' with no budget worked out') + '. The Ivy League gives no athletic or merit aid; aid is need-based only.');
    var hiD3 = a.d3_academic === 'Top of list' || a.d3_academic === 'Yes' || has(groups, 'NESCAC') || has(groups, 'Centennial') || has(groups, 'Liberty League or UAA');
    if (hiD3 && (a.d3_cost_reaction === 'Need merit or athletic money' || a.d3_cost_reaction === 'Takes it off the list' || (B !== undefined && B < 60000 && a.d3_cost_reaction !== 'Still top, will make it work')))
      add('talk', 'Interested in high-academic D3, but their cost answer (' + (Q.labelFor('d3_cost_reaction', a.d3_cost_reaction) || 'no answer') + (B !== undefined ? '; budget up to ' + money(B) : '') + ') conflicts with roughly $96k a year at those schools without need-based aid.');
    if (a.d3_cost_reaction === 'Takes it off the list' && has(divs, 'D3')) add('watch', 'Said high-academic D3 cost takes that path off the list, yet still open to Division III. Clarify which D3 schools are realistic.');
    if (a.d3_timeline === 'Want to be settled sooner' && hiD3) add('talk', 'Wants to be settled early but is interested in high-academic D3, where many programs make no offers until July 1 before senior year.');
    if (divs.length === 1 && divs[0] === 'D1') add('watch', 'Open to Division I only. Discuss a backup plan and which D1 tiers are realistic.');
    if (a.academy_interest && a.academy_interest !== 'No') {
      if (a.service_commitment === 'That stops us') add('talk', 'Interested in a service academy but said the service commitment stops them. Resolve this before any nomination work.');
      if (a.service_commitment === 'Need more information') add('talk', 'Needs the service commitment explained (academy interest: ' + a.academy_interest + ').');
    }
    if (a.budget === 'Still figuring it out') add('talk', 'No budget worked out yet. Every cost conversation depends on this number.');
    if (a.npc === 'What is that' || a.npc === 'No') add('watch', a.npc === 'What is that' ? 'Has never heard of a net price calculator. Walk them through one.' : 'Has not run a net price calculator yet.');
    if (a.d3_cost_reaction === 'Need it explained') add('talk', 'Asked for the D3 cost and July 1 timeline to be explained.');
    if (a.pg_year === 'Explain') add('watch', 'Asked how a postgraduate (PG) year works.');
    var pr = priorities(a); if (pr.unreliable) add('watch', 'Priority ratings: ' + pr.unreliable);
    var g = gradYear ? 12 - (gradYear - (new Date().getMonth() >= 7 ? new Date().getFullYear() + 1 : new Date().getFullYear())) : null;
    if (g !== null && g >= 11 && (a.test_status === 'Nothing yet' || a.test_status === 'PSAT or practice only') && !a.test_plan) add('watch', 'Junior or older with no SAT/ACT taken or planned.');
    if (has(divs, 'MCLA')) add('info', 'Listed MCLA club. MCLA programs are not in the app’s school list.');
    // their school list vs their answers
    var list = saved.map(function (x) { return x.school; }).filter(Boolean);
    if (list.length) {
      var fits = list.map(function (s) { return { s: s, f: schoolFit(s, a, profile) }; });
      var stretch = fits.filter(function (x) { return x.f.cost.level === 'stretch'; });
      if (stretch.length && B !== undefined) add(stretch.length >= list.length / 2 ? 'talk' : 'watch', stretch.length + ' of ' + list.length + (list.length === 1 ? ' school on their list is' : ' schools on their list are') + ' a cost stretch at their budget: ' + stretch.slice(0, 6).map(function (x) { return x.f.name; }).join(', ') + (stretch.length > 6 ? '…' : '') + '.');
      var reach = fits.filter(function (x) { return x.f.academic.level === 'reach'; });
      if (reach.length >= 3 && reach.length >= list.length * 0.6) add('watch', reach.length + ' of ' + list.length + ' schools on their list are academic reaches (low admit rate or scores below their range). Make sure the list has some safer academic options.');
      var maj = {};
      fits.forEach(function (x) { x.f.majorsMissing.forEach(function (m) { (maj[m] = maj[m] || []).push(x.f.name); }); });
      var mk = Object.keys(maj).filter(function (m) { return m !== 'Undecided, and that is fine'; });
      if (mk.length) add('watch', 'Majors vs their list (federal data shows no bachelor’s degree): ' + mk.map(function (m) { return m + ' at ' + maj[m].length + ' (' + maj[m].slice(0, 4).join(', ') + (maj[m].length > 4 ? '…' : '') + ')'; }).join('; ') + '.');
      var far = fits.filter(function (x) { return !x.f.distanceOk; });
      if (far.length) add('watch', far.length + (far.length === 1 ? ' school is' : ' schools are') + ' farther than their "' + a.distance + '" preference: ' + far.slice(0, 5).map(function (x) { return x.f.name; }).join(', ') + '.');
      var offDiv = fits.filter(function (x) { return !x.f.divisionOk; });
      if (offDiv.length) add('info', offDiv.length + (offDiv.length === 1 ? ' school is' : ' schools are') + ' outside the divisions they chose: ' + offDiv.slice(0, 5).map(function (x) { return x.f.name; }).join(', ') + '.');
    }
    var order = { talk: 0, watch: 1, info: 2 };
    return f.sort(function (x, y) { return order[x.level] - order[y.level]; });
  }

  // ---------------------------------------------------------------- time-sensitive items for the director inbox
  function timeSensitive(a) {
    a = a || {}; var t = [];
    if (a.academy_interest && a.academy_interest !== 'No') t.push({ ref: 'academy', text: 'Service academy interest: ' + a.academy_interest + (arr(a.academies).length ? ' (' + arr(a.academies).map(function (x) { return ACADEMY_NAME[x] || x; }).join(', ') + ')' : '') + '. Nominations and fitness tests start early.' });
    if (a.tuition_exchange === 'Yes' || a.tuition_exchange === 'Not sure' || a.tuition_exchange === 'Maybe') t.push({ ref: 'te', text: 'Tuition exchange: ' + a.tuition_exchange + (a.te_school ? ' (' + a.te_school + ')' : '') + (a.te_program ? ', program: ' + a.te_program : '') + '.' });
    if (a.service_commitment === 'Need more information') t.push({ ref: 'service', text: 'Wants the service commitment explained.' });
    if (a.d3_cost_reaction === 'Need it explained') t.push({ ref: 'd3', text: 'Wants the D3 cost and July 1 timeline explained.' });
    if (a.pg_year === 'Explain') t.push({ ref: 'pg', text: 'Wants a PG year explained.' });
    if (a.npc === 'What is that') t.push({ ref: 'npc', text: 'Has never heard of a net price calculator.' });
    return t;
  }

  // ---------------------------------------------------------------- family-side helpers
  function filtersFromAnswers(a) {
    a = a || {}; var F = {};
    var divs = arr(a.divisions).filter(function (d) { return ['D1', 'D2', 'D3', 'NAIA', 'JUCO'].indexOf(d) > -1; });
    if (divs.length && !has(a.divisions, 'Open to anything')) F.div = divs;
    var reg = arr(a.region).filter(function (r) { return r !== 'Anywhere'; }).map(function (r) { return r === 'East coast and New England' ? 'New England' : r; });
    if (reg.length && !has(a.region, 'Anywhere')) { if (has(a.region, 'East coast and New England') && reg.indexOf('Mid-Atlantic') < 0) reg.push('Mid-Atlantic'); F.region = reg; }
    var sz = arr(a.size).filter(function (s) { return s !== 'No preference'; }); if (sz.length && !has(a.size, 'No preference')) F.size = sz;
    var st = arr(a.setting).filter(function (s) { return s !== 'No preference'; }).map(function (s) { return s === 'College town' ? 'Small college town' : s; }); if (st.length && !has(a.setting, 'No preference')) F.setting = st;
    var mj = arr(a.majors).filter(function (m) { return Q.MAJOR_KEY[m]; }); if (mj.length === 1) F.major = Q.MAJOR_KEY[mj[0]];
    return F;
  }
  function tasksFromAnswers(a) {
    a = a || {}; var t = [];
    if (a.npc === 'No' || a.npc === 'What is that') t.push(['q-npc', 'Run a net price calculator on 3 of your schools', 'Each school’s calculator is linked on its card in Schools. It’s far closer to your real cost than the sticker price.']);
    if (a.budget === 'Still figuring it out') t.push(['q-budget', 'Work out what your family can put toward college each year', 'It’s the single most useful number for your directors.']);
    if (a.academy_interest && a.academy_interest !== 'No') t.push(['q-academy', 'Start a service academy candidate questionnaire', 'Academies open their applications early, and nominations come from members of Congress. Ask your director about timing.']);
    if (a.tuition_exchange === 'Yes' || a.tuition_exchange === 'Not sure') t.push(['q-te', 'Ask the parent’s employer about Tuition Exchange, FACHEX or CIC-TEP', 'Check eligibility and the participating list at tuitionexchange.org.']);
    if ((a.test_status === 'Nothing yet' || a.test_status === 'PSAT or practice only') && !a.test_plan) t.push(['q-test', 'Pick an SAT or ACT date', 'Many of your schools look at scores even when they’re optional.']);
    if (!arr(a.visit_wishlist).length && !a.visit_wishlist) t.push(['q-visit', 'List the campuses you want to see next', 'Add them in your questionnaire under Campus visits.']);
    return t;
  }

  // ---------------------------------------------------------------- school name matching (imports, typed names)
  function norm(s) {
    return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/\bsaint\b/g, 'st').replace(/\bst\.?\s/g, 'st ').replace(/[’']/g, '')
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\b(the|of|at|university|college|univ|u)\b/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function lev(a, b) {
    var m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    var p = []; for (var j = 0; j <= n; j++) p[j] = j;
    for (var i = 1; i <= m; i++) { var c = [i]; for (j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
    return p[n];
  }
  function matchSchool(text, schools) {
    var t = String(text || '').replace(/^\s*(#?\d+[\.\)]?|[-•*])\s*/, '').replace(/\s*#\d+\s*$/, '').replace(/\(.*?\)/g, '').trim();
    if (!t) return null;
    var nt = norm(t); if (!nt) return null;
    var best = null, bestScore = 0;
    schools.forEach(function (s) {
      var names = [s.name, s.short_name].concat(s.aliases || []).filter(Boolean);
      names.forEach(function (nm) {
        var nn = norm(nm), score = 0;
        if (!nn) return;
        if (nm.toLowerCase() === t.toLowerCase()) score = 1;
        else if (nn === nt) score = 0.97;
        else {
          var d = lev(nn, nt), L = Math.max(nn.length, nt.length);
          score = 1 - d / L;
          if (L < 7) score = Math.min(score, 0.75); // short names: a typo match is only a guess
          var sh = nt.length < nn.length ? nt : nn, lg = nt.length < nn.length ? nn : nt;
          // Prefix match only on a whole word and when it covers most of the name ("Wash" must not become Washington College).
          if (sh.length >= 4 && lg.indexOf(sh) === 0 && (lg.length === sh.length || lg[sh.length] === ' ') && sh.length >= 0.6 * lg.length) score = Math.max(score, 0.86);
        }
        // Ties (e.g. two schools both called "Saint Joseph's") go to the larger program.
        if (score > bestScore + 1e-9 || (Math.abs(score - bestScore) < 1e-9 && best && (s.undergrads || 0) > (best.undergrads || 0))) { bestScore = score; best = s; }
      });
    });
    return bestScore >= 0.8 ? { school: best, score: bestScore, text: t } : { school: null, score: bestScore, text: t, guess: bestScore >= 0.6 ? best : null };
  }

  window.TIR_FIT = { BUDGET_MAX: BUDGET_MAX, homeLoc: homeLoc, miles: miles, distanceLabel: distanceLabel, sizeBand: sizeBand, stickerFor: stickerFor,
    schoolFit: schoolFit, priorities: priorities, expectations: expectations, timeSensitive: timeSensitive, filtersFromAnswers: filtersFromAnswers,
    tasksFromAnswers: tasksFromAnswers, matchSchool: matchSchool, groupMatch: groupMatch, money: money, arr: arr };
})();
