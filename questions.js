/* Team Illinois College Questionnaire — exact wording from the club's website form.
   Stored values match the website export, so imported answers drop straight in.
   [value, label]: value is what's saved, label is what families see. */
(function () {
  'use strict';
  function o(list) { return list.map(function (x) { return Array.isArray(x) ? x : [x, x]; }); }
  var SHOWCASES = o(['Team IL Fall', 'Team IL Summer', 'NLF Uncommitted', 'One Percent', 'Main Stage', 'Juniors Open', 'Maverik Showtime', 'The Show Best in Class', 'Other']);
  var MAJORS = o(['Accounting', 'Aerospace or aviation', 'Agriculture or animal science', 'Architecture', 'Art and design', 'Biology or pre-med',
    'Business administration', 'Communications or media', 'Computer science', 'Criminal justice', 'Data science or analytics', 'Economics', 'Education',
    'Engineering, civil', 'Engineering, electrical or computer', 'Engineering, mechanical', 'English or writing', 'Environmental science',
    'Exercise science or kinesiology', 'Finance', 'History', 'Hospitality or event management', 'International relations', 'Journalism', 'Marketing',
    'Mathematics', 'Music', 'Nursing or pre-health', 'Physical therapy or athletic training', 'Political science or pre-law', 'Psychology',
    'Sport management', 'Undecided, and that is fine']);
  // Questionnaire major -> key used in the federal majors data on each school
  var MAJOR_KEY = { 'Accounting': 'acct', 'Aerospace or aviation': 'aero', 'Agriculture or animal science': 'ag', 'Architecture': 'arch', 'Art and design': 'art',
    'Biology or pre-med': 'bio', 'Business administration': 'bus', 'Communications or media': 'comm', 'Computer science': 'cs', 'Criminal justice': 'cj',
    'Data science or analytics': 'data', 'Economics': 'econ', 'Education': 'edu', 'Engineering, civil': 'civ', 'Engineering, electrical or computer': 'ee',
    'Engineering, mechanical': 'me', 'English or writing': 'eng', 'Environmental science': 'env', 'Exercise science or kinesiology': 'kin', 'Finance': 'fin',
    'History': 'hist', 'Hospitality or event management': 'hosp', 'International relations': 'ir', 'Journalism': 'journ', 'Marketing': 'mkt', 'Mathematics': 'math',
    'Music': 'music', 'Nursing or pre-health': 'nurse', 'Physical therapy or athletic training': 'pt', 'Political science or pre-law': 'poli', 'Psychology': 'psych',
    'Sport management': 'sport' };
  var SCALES = [
    ['p_d1', 'Playing Division I, or the highest ranked program that recruits me'],
    ['p_minutes', 'Playing significant minutes early in my career'],
    ['p_academics', 'Attending a highly selective academic school'],
    ['p_position', 'Playing my preferred position'],
    ['p_championship', 'Competing for a conference championship'],
    ['p_espn', 'Playing on ESPN'],
    ['p_cost', 'Total cost, and the aid or scholarship money on offer'],
    ['p_close', 'Being close enough that family can watch me play'],
    ['p_culture', 'The head coach and the culture of the program'],
    ['p_career', 'Where that degree takes me after lacrosse ends'],
    ['p_campus', 'Campus life, the student body, and game day atmosphere']
  ];
  var D3_COST = 'These schools cost roughly $96,000 a year, all in, for 2026-27: Williams $95,960, Amherst $96,360, and Tufts $97,152. There are no athletic scholarships in Division III, and there is little merit money at schools like these, so aid is mostly need-based. If your family does not qualify on need, that is often close to the real number. Worth knowing too: most of these programs recruit Division I-level talent only, so the bar on the field is every bit as high as the bar in the classroom. They also recruit on a much slower clock than everyone else, and often make no offers at all until July 1 between junior and senior year. Knowing all of that, where does this path sit for you?';

  var SECTIONS = [
    { id: 's1', n: 1, title: 'Who is filling this out', intro: 'Start here so we can match your answers to you.', items: [
      { key: 'answered_by', label: 'Who is answering', type: 'single', options: o([['Player', 'The player'], ['Parent', 'A parent'], ['Together', 'Both, together']]), directorOption: ['Director', 'A director, in a meeting with the family'] },
      { key: 'email', label: 'Best email for recruiting mail', type: 'email', profile: 'player_email' },
      { key: 'phone', label: 'Player cell (optional)', type: 'tel', profile: 'player_cell', optional: true },
      { key: 'high_school', label: 'High school', type: 'text', profile: 'high_school' },
      { key: 'home_zip', label: 'Home ZIP code', type: 'zip', profile: 'home_zip', appOnly: true, help: 'So we can tell how far each school is from home.' },
      { key: 'position', label: 'Position you expect to be recruited at', type: 'text', profile: 'position' },
      { key: 'position_flex', label: 'Would you switch positions to get a better school', type: 'single', options: o([['Yes', 'Yes, put me where they need me'], ['Depends', 'Depends on the school'], ['No', 'No, I want to play my position']]) }
    ] },
    { id: 's2', n: 2, title: 'Academics', intro: 'Grades open more doors than film does at this stage. Rough numbers are fine, and we do not share any of this outside the staff.', items: [
      { key: 'gpa', label: 'Current GPA', type: 'decimal', profile: 'gpa' },
      { key: 'gpa_scale', label: 'GPA scale', type: 'select', profile: 'gpa_scale', options: o(['4.0 unweighted', '4.0 weighted', '5.0 weighted', '100 point', 'Not sure']) },
      { key: 'course_rigor', label: 'Honors, AP, or IB courses taken or scheduled', type: 'textarea' },
      { key: 'class_rank', label: 'Class rank, if your school reports it', type: 'text', optional: true },
      { key: 'test_status', label: 'Testing so far', type: 'single', options: o([['Nothing yet', 'Nothing taken yet'], ['PSAT or practice only', 'PSAT or a practice test only'], ['SAT taken', 'SAT taken'], ['ACT taken', 'ACT taken'], ['Both taken', 'Both taken']]) },
      { key: 'sat', label: 'SAT total, if you have one', type: 'int', min: 400, max: 1600, profile: 'sat', optional: true, showIf: function (a) { return a.test_status === 'SAT taken' || a.test_status === 'Both taken' || a.sat; } },
      { key: 'act', label: 'ACT composite, if you have one', type: 'int', min: 1, max: 36, profile: 'act', optional: true, showIf: function (a) { return a.test_status === 'ACT taken' || a.test_status === 'Both taken' || a.act; } },
      { key: 'test_plan', label: 'Next test date you have planned', type: 'text', optional: true },
      { key: 'academic_note', label: 'Anything we should know academically', type: 'textarea', optional: true }
    ] },
    { id: 's3', n: 3, title: 'Service academies and ROTC', intro: 'These recruit on a different calendar than everyone else, with nominations, fitness tests, and medical screening that start early. If there is any interest at all, we need to know now.', items: [
      { key: 'academy_interest', label: 'Interested in a service academy', type: 'single', options: o([['Yes, strongly', 'Yes, strongly'], ['Yes, worth exploring', 'Yes, worth exploring'], ['Not sure', 'Not sure, tell me more'], ['No', 'No']]) },
      { key: 'academies', label: 'Which ones', help: 'Tick any that interest you.', type: 'multi', options: o(['Army, West Point', 'Navy, Annapolis', 'Air Force', 'Coast Guard', 'Merchant Marine']), optional: true, showIf: function (a) { return a.academy_interest && a.academy_interest !== 'No'; } },
      { key: 'service_commitment', label: 'The service commitment after graduation', type: 'single', options: o([['Understood, fine with it', 'We understand it and we are fine with it'], ['Need more information', 'We need someone to walk us through it'], ['That stops us', 'That is the part that stops us'], ['Not applicable', 'Not applicable']]) }
    ] },
    { id: 's4', n: 4, title: 'Academic selectivity', intro: 'The most selective lacrosse schools in the country are mostly Division III and the Ivy League. Strong grades plus our relationships are what open those doors.', items: [
      { key: 'd3_academic', label: 'Interested in a high academic Division III school', help: 'Williams, Tufts, Amherst, Swarthmore, Middlebury, Bowdoin, Hamilton, Haverford, and the like.', type: 'single', options: o([['Top of list', 'Yes, that is the top of my list'], ['Yes', 'Yes, interested'], ['Not sure', 'Not sure yet'], ['No', 'No, I want to play higher']]) },
      { key: 'd3_cost_reaction', label: 'Now the part nobody tells you early enough', help: D3_COST, type: 'single', options: o([['Still top, will make it work', 'Still the top of the list, we will find a way to make it work'], ['Interested if aid works out', 'Still interested, but only if the financial aid comes through'], ['Need merit or athletic money', 'That pushes us toward schools with merit or athletic money'], ['Takes it off the list', 'That takes this path off our list'], ['Need it explained', 'We need someone to walk us through this before we answer']]) },
      { key: 'd3_timeline', label: 'The July 1 timeline', type: 'single', options: o([['Fine with waiting', 'We are fine waiting that long for an answer'], ['Hard but worth it', 'Hard, but worth it for the right school'], ['Want to be settled sooner', 'We would rather be settled sooner than that']]) },
      { key: 'academic_groups', label: 'Conferences and groups you want us to work on', type: 'multi', options: o([['Ivy League', 'Ivy League'], ['Patriot League', 'Patriot League'], ['NESCAC', 'NESCAC, the New England academic D3'], ['Centennial', 'Centennial Conference'], ['Liberty League or UAA', 'Liberty League or UAA'], ['NCAC and Midwest D3', 'NCAC and Midwest D3'], ['Big Ten or ACC level D1', 'Big Ten or ACC level D1'], ['Do not know these yet', 'I do not know these yet']]) },
      { key: 'divisions', label: 'Divisions you are open to', type: 'multi', options: o([['D1', 'Division I'], ['D2', 'Division II'], ['D3', 'Division III'], ['NAIA', 'NAIA'], ['MCLA', 'MCLA club'], ['JUCO', 'Junior college'], ['Open to anything', 'Open to anything that fits']]) },
      { key: 'pg_year', label: 'Open to a postgraduate year after high school', help: 'A PG year is an extra year at a prep school before college. It is a normal route for some players, and a bad fit for others, so it is worth knowing early.', type: 'single', options: o([['Yes', 'Yes, we would consider it'], ['Maybe', 'Maybe, depending on where things stand'], ['No', 'No'], ['Explain', 'Explain how that works']]) }
    ] },
    { id: 's5', n: 5, title: 'The school itself', intro: 'Tick everything that would work. Ticking more is not a bad answer, it just tells us how wide to cast.', items: [
      { key: 'size', label: 'Size of the student body', type: 'multi', options: o([['Small, under 4500', 'Small, under 4,500 students'], ['Medium, 4501 to 9000', 'Medium, 4,501 to 9,000'], ['Large, 9000 plus', 'Large, 9,000 and up'], ['No preference', 'No preference']]) },
      { key: 'setting', label: 'Campus setting', type: 'multi', options: o([['Urban', 'Urban, in a city'], ['Suburban', 'Suburban'], ['College town', 'Small college town'], ['Rural', 'Rural'], ['No preference', 'No preference']]) },
      { key: 'region', label: 'Part of the country', type: 'multi', options: o([['West', 'West'], ['Midwest', 'Midwest'], ['South', 'South'], ['Mid-Atlantic', 'Mid-Atlantic'], ['East coast and New England', 'East coast and New England'], ['Anywhere', 'Anywhere, the school matters more']]) },
      { key: 'distance', label: 'How far from home', type: 'single', options: o([['Within 3 hours', 'Within about 3 hours, family at every home game'], ['Day’s drive', 'Within a day’s drive'], ['Flight is fine', 'A flight each way is fine'], ['No limit', 'No limit at all']]) },
      { key: 'school_other', label: 'Anything else about the school that matters', type: 'textarea', optional: true },
      { key: 'legacy', label: 'Family ties to any school', type: 'textarea', optional: true },
      { key: 'faith', label: 'Does a school’s religious affiliation matter to you', type: 'single', options: o(['Yes', 'No']) },
      { key: 'faith_note', label: 'If yes, tell us more', type: 'textarea', optional: true, showIf: function (a) { return a.faith === 'Yes'; } }
    ] },
    { id: 's6', n: 6, title: 'What you want to study', intro: 'Pick up to five. Some majors genuinely narrow the list, so this matters more than people expect at 15.', items: [
      { key: 'majors', label: 'Majors that interest you', type: 'multi', max: 5, options: MAJORS }
    ] },
    { id: 's7', n: 7, title: 'What matters most', intro: 'On a scale of 1 to 10, how important is each one to you. Be honest rather than diplomatic, since spreading tens across everything tells us nothing.', items: [
      { key: 'scales', type: 'scales', scales: SCALES },
      { key: 'tradeoff', label: 'If you had to give one of those up to get another, which would it be', type: 'textarea' }
    ] },
    { id: 's8', n: 8, title: 'What college can cost', intro: 'This is the single most useful thing you can tell us, and it stays with the staff. Knowing the number early keeps us from steering you toward schools that were never going to work, and points us at the ones with real money to give. We will always fight for every scholarship dollar regardless of how you answer this question.', items: [
      { key: 'budget', label: 'What your family can put toward each year, after any aid', type: 'single', options: o([['Under 10000', 'Under $10,000 a year'], ['10000 to 20000', '$10,000 to $20,000'], ['20001 to 30000', '$20,001 to $30,000'], ['30001 to 45000', '$30,001 to $45,000'], ['45001 to 60000', '$45,001 to $60,000'], ['60000 plus', '$60,000 and up, full price is workable'], ['Still figuring it out', 'We have not worked that out yet']]) },
      { key: 'npc', label: 'Have you run a Net Price Calculator on any school', help: 'Every college has one on its own site, and it gives you a far better estimate than the sticker price. Most families never run one.', type: 'single', options: o([['Yes, several', 'Yes, on several schools'], ['Yes, one', 'Yes, on one'], ['No', 'No, not yet'], ['What is that', 'We have never heard of it']]) }
    ] },
    { id: 's9', n: 9, title: 'Tuition exchange', intro: 'If a parent works at a college or university, your tuition at hundreds of other schools may be free or close to it. Families miss this every year. The participating list is at tuitionexchange.org under School List.', items: [
      { key: 'tuition_exchange', label: 'Does a parent or guardian work at a college or university', type: 'single', options: o(['Yes', 'No', 'Not sure']) },
      { key: 'te_school', label: 'Which institution', type: 'text', optional: true, showIf: function (a) { return a.tuition_exchange === 'Yes' || a.tuition_exchange === 'Not sure'; } },
      { key: 'te_program', label: 'Do they take part in Tuition Exchange, FACHEX, or CIC-TEP', type: 'select', optional: true, options: o([['Tuition Exchange', 'Yes, Tuition Exchange'], ['FACHEX', 'Yes, FACHEX'], ['CIC-TEP', 'Yes, CIC-TEP'], ['More than one', 'Yes, more than one of those'], ['No', 'No'], ['Not sure', 'Not sure, we will check']]), showIf: function (a) { return a.tuition_exchange === 'Yes' || a.tuition_exchange === 'Not sure'; } }
    ] },
    { id: 's10', n: 10, title: 'Showcases', intro: 'So we are not sending you somewhere you have already been, or missing the one event that fits your list.', items: [
      { key: 'showcases_past', label: 'Attended in the past 12 months', type: 'multi', options: SHOWCASES, optional: true },
      { key: 'showcases_past_other', label: 'Any others you have attended', type: 'text', optional: true },
      { key: 'showcases_next', label: 'Planning to attend in the next 12 months', type: 'multi', options: SHOWCASES, optional: true },
      { key: 'showcases_next_other', label: 'Anything else already booked', type: 'text', optional: true }
    ] },
    { id: 's11', n: 11, title: 'Prospect days and college camps', intro: 'A prospect day is run by one school’s staff on their own campus. List the school and roughly when, one per line.', items: [
      { key: 'prospect_past', label: 'Prospect days in the past 12 months', type: 'textarea', optional: true },
      { key: 'prospect_next', label: 'Prospect days you plan to attend', type: 'textarea', optional: true }
    ] },
    { id: 's12', n: 12, title: 'Campus visits', intro: 'Any campus at all, whether it was a lacrosse trip or a family holiday detour. What you liked and hated is usually the fastest way to work out what you want.', items: [
      { key: 'visits', label: 'Every campus you have visited', type: 'textarea', optional: true },
      { key: 'visit_favorites', label: 'Your favourites so far, and why', type: 'textarea', optional: true },
      { key: 'visit_dislikes', label: 'What did you not like', help: 'The ones that were wrong for you, and what it was. Too big, too remote, too quiet, the wrong feel on the tour, the facilities, whatever it was. This is often more useful to us than the favourites.', type: 'textarea', optional: true },
      { key: 'visit_wishlist', label: 'Campuses you want to see next', type: 'textarea', optional: true }
    ] },
    { id: 's13', n: 13, title: 'Schools you want us to work on', intro: 'This is the part we act on. Name the schools and we will start building the relationships now, long before anyone is allowed to call you back.', items: [
      { key: 'target_schools', label: 'Up to ten schools you would like us to call on your behalf', help: 'One per line. Dream schools belong on this list, so do the ones you think are realistic.', type: 'schools', max: 10 },
      { key: 'other_sports', label: 'Other sports you play, or plan to keep playing', type: 'text', optional: true }
    ] },
    { id: 's14', n: 14, title: 'Anything else', intro: '', items: [
      { key: 'thoughts', label: 'Your thoughts, in your own words', help: 'What you are excited about, what worries you, what you want help with, what you would change about how this is going.', type: 'textarea', optional: true },
      { key: 'questions', label: 'Questions for the staff', help: 'Anything you want answered, from how the timeline works to what a coach is really asking when they call.', type: 'textarea', optional: true },
      { key: 'dream_school', label: 'If everything lined up, where would you go', type: 'text', optional: true }
    ] }
  ];
  var INTRO = 'This tells us what you are actually looking for in a school, so the staff can point you at the right programs, make the right calls on your behalf, and stop wasting your summer on showcases that do not serve you. Answer it with your parents. Nothing here is a commitment, and you can send it again any time your thinking changes. About 10 minutes.';

  var ALL = {};
  SECTIONS.forEach(function (s) { s.items.forEach(function (it) { ALL[it.key] = it; }); });
  SCALES.forEach(function (sc) { ALL[sc[0]] = { key: sc[0], label: sc[1], type: 'scale' }; });

  function labelFor(key, value) {
    var it = ALL[key]; if (!it || !it.options) return value;
    var f = function (v) { var m = it.options.filter(function (x) { return x[0] === v; })[0]; return m ? m[1] : v; };
    return Array.isArray(value) ? value.map(f) : f(value);
  }
  function answered(it, a) {
    if (it.type === 'scales') return it.scales.every(function (sc) { return a[sc[0]] !== undefined && a[sc[0]] !== null && a[sc[0]] !== ''; });
    var v = a[it.key];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && String(v).trim() !== '';
  }
  function sectionDone(sec, a) {
    var live = sec.items.filter(function (it) { return !(it.showIf && !it.showIf(a)); });
    var req = live.filter(function (it) { return !it.optional; });
    // A section with nothing required counts as done only once something in it is answered.
    if (!req.length) return live.some(function (it) { return answered(it, a); });
    return req.every(function (it) { return answered(it, a); });
  }
  function progress(a) {
    a = a || {};
    var done = SECTIONS.filter(function (s) { return sectionDone(s, a); }).length;
    return { done: done, total: SECTIONS.length, pct: Math.round(done / SECTIONS.length * 100) };
  }

  window.TIR_Q = { SECTIONS: SECTIONS, SCALES: SCALES, MAJORS: MAJORS, MAJOR_KEY: MAJOR_KEY, INTRO: INTRO, ALL: ALL,
    labelFor: labelFor, answered: answered, sectionDone: sectionDone, progress: progress, version: '2029 questionnaire, Nov 2026' };
})();
