'use strict';
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const ICONS = {
  star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  book: '<path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z"/>',
  code: '<path d="m7 7-5 5 5 5m10-10 5 5-5 5M14 4l-4 16"/>',
  test: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 11l2 2 4-4m-6 8h6"/>',
  chart: '<path d="M4 3v18h17M8 16v-4m5 4V8m5 8V5"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="m8 14-2 8 6-3 6 3-2-8"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>'
};
function icon(name) { return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.code}</svg>`; }
const NAV = [['home', 'Главная', 'home'], ['lessons', 'Уроки', 'book'], ['tasks', 'Задания', 'code'], ['tests', 'Тесты', 'test'], ['progress', 'Мой прогресс', 'chart'], ['certificate', 'Сертификат', 'award'], ['practice', 'Практика', 'code'], ['about', 'Об авторе', 'user']];
const STORAGE_KEY = 'davcode.v1';
const freshState = () => ({ lessons: {}, tasks: {}, tests: {}, profile: { surname: '', name: '', className: '' }, theme: 'light', lastLesson: null, issued: {}, version: 2, favorites: [], projects: {}, achievements: {}, expanded: false });
let storageAvailable = true;
function loadState() {
  const result = freshState();
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return result;
    LESSONS.forEach(l => { if (['started', 'done'].includes(raw.lessons?.[l.id])) result.lessons[l.id] = raw.lessons[l.id]; });
    TASKS.forEach(t => { if (raw.tasks?.[t.id] === true) result.tasks[t.id] = true; });
    Object.keys(COURSES).forEach(c => {
      if (Number.isFinite(raw.tests?.[c]) && raw.tests[c] >= 0 && raw.tests[c] <= 100) result.tests[c] = raw.tests[c];
      if (typeof raw.issued?.[c] === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(raw.issued[c])) result.issued[c] = raw.issued[c];
    });
    Object.keys(result.profile).forEach(k => { if (typeof raw.profile?.[k] === 'string') result.profile[k] = raw.profile[k].slice(0, k === 'className' ? 30 : 160); });
    result.favorites = Array.isArray(raw.favorites) ? [...new Set(raw.favorites.filter(id=>LESSONS.some(l=>l.id===id)))] : [];
    result.expanded = raw.expanded === true || (raw.version !== 2 && (Object.keys(result.lessons).length>0 || Object.keys(result.tasks).length>0 || Object.keys(result.tests).length>0));
    if(raw.achievements && typeof raw.achievements === 'object') Object.keys(raw.achievements).forEach(id=>{if(raw.achievements[id]===true && /^[a-z-]+$/.test(id)) result.achievements[id]=true;});
    PROJECTS.forEach(p=>{const old=raw.projects?.[p.id];if(old && typeof old==='object') result.projects[p.id]={done:old.done===true,checks:Array.isArray(old.checks)?[...new Set(old.checks.filter(i=>Number.isInteger(i)&&i>=0&&i<p.checklist.length))]:[]};});
    if (raw.theme === 'dark') result.theme = 'dark';
    if (LESSONS.some(l => l.id === raw.lastLesson)) result.lastLesson = raw.lastLesson;
  } catch { storageAvailable = false; }
  return result;
}
let state = loadState();
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { storageAvailable = false; }
}
const countLessons = course => LESSONS.filter(l => (!course || l.course === course) && state.lessons[l.id] === 'done').length;
const countTasks = () => TASKS.filter(t => state.tasks[t.id]).length;
const passedTests = () => Object.keys(COURSES).filter(c => state.tests[c] >= 70).length;
const totalItems = () => LESSONS.length + TASKS.length + Object.keys(TESTS).length;
const totalPercent = () => Math.round((countLessons() + countTasks() + passedTests()) / totalItems() * 100);
const courseReady = course => Boolean(state.issued[course]) || (countLessons(course) === COURSES[course].count && state.tests[course] >= 70);
function statusHtml(id) {
  const status = state.lessons[id];
  return `<span class="status">${icon(status === 'done' ? 'check' : status === 'started' ? 'clock' : 'circle')}${status === 'done' ? 'Пройден' : status === 'started' ? 'В процессе' : 'Не начат'}</span>`;
}
function statsHtml() {
  return `<div class="stats"><div class="stat"><span class="icon-box">${icon('book')}</span><div><b>${countLessons()} <small>/ ${LESSONS.length}</small></b><p>уроков пройдено</p></div></div><div class="stat"><span class="icon-box purple">${icon('code')}</span><div><b>${countTasks()} <small>/ ${TASKS.length}</small></b><p>заданий решено</p></div></div><div class="stat"><span class="icon-box gold">${icon('test')}</span><div><b>${passedTests()} <small>/ ${Object.keys(TESTS).length}</small></b><p>тестов сдано</p></div></div></div>`;
}
function progressBar(percent, label = 'Прогресс') { return `<div class="progress-track" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div>`; }
function heading(title, text) { return `<h1>${title}</h1><p class="intro">${text}</p>`; }
function homePage() {
  return `<section class="hero"><div><span class="eyebrow">✦ МАЛЕНЬКИЕ ШАГИ. БОЛЬШИЕ ВОЗМОЖНОСТИ.</span><h1>Твой первый шаг<br>в <span>программирование</span></h1><p>Изучай Python, создавай первые страницы и проверяй знания.</p><div class="hero-actions"><a class="button" href="#lessons/1">Начать обучение ${icon('arrow')}</a><small>С нуля. Без сложных слов.</small></div></div><div class="code-art" aria-label="Пример первой программы на Python"><div class="code-window"><div class="code-title"><i></i><i></i><i></i><span>первая_программа.py</span></div><div class="code-body"><div class="code-line"><span class="ln">1</span><span class="code-comment"># Всё начинается с приветствия</span></div><div class="code-line"><span class="ln">2</span><span>name = <span class="code-green">"Будущий разработчик"</span></span></div><div class="code-line"><span class="ln">3</span><span><span class="code-purple">print</span>(<span class="code-green">"Привет, мир!"</span>)</span></div><div class="code-line"><span class="ln">4</span><span><span class="code-purple">print</span>(<span class="code-green">"У меня всё получится!"</span>)</span></div></div><div class="code-output">› Привет, мир!<br>› У меня всё получится!</div></div><div class="float-badge top">${icon('code')} Пишем первую строку</div><div class="float-badge bottom">${icon('check')} Первая программа готова!</div></div></section>
  ${nextStepHtml()}
  ${statsHtml()}<div class="section-head"><div><h2>Что будем изучать?</h2><p>Выбери направление и создай что-то своё.</p></div><a class="text-link" href="#lessons">Все уроки ${icon('arrow')}</a></div>
  <div class="grid-two">${Object.keys(COURSES).map(courseCard).join('')}</div>
  <div class="path-note"><span class="icon-box gold">${icon('award')}</span><div><h3>От первой строки — к первому сертификату</h3><p>Пройди уроки направления и сдай тест, чтобы отметить свой успех.</p></div><a class="text-link" href="#certificate">Подробнее ${icon('arrow')}</a></div>`;
}
function courseCard(course) {
  const c = COURSES[course], items = LESSONS.filter(l => l.course === course);
  const done = countLessons(course), started = items.some(l => state.lessons[l.id]);
  const complete = done === items.length, next = items.find(l => state.lessons[l.id] !== 'done') || items[0];
  return `<article class="card"><div class="course-banner ${course === 'python' || course === 'daily' ? '' : 'web'}"><span class="course-symbol">${c.symbol || (course === 'python' ? 'Py.' : '&lt;/&gt;')}</span><span class="course-label">${icon(complete ? 'check' : started ? 'clock' : 'circle')} ${complete ? 'Завершён' : started ? 'В процессе' : 'Не начат'}</span></div><div class="card-body"><h3>${c.title}</h3><p>${c.description || (course === 'python' ? 'От первого print() до собственных функций: понятный старт в программировании.' : 'Создай первую страницу с HTML и добавь оформление с помощью CSS.')}</p><div class="tags">${(c.tags || [course === 'python' ? 'Python' : 'HTML / CSS','Для начинающих']).map(t => `<span class="tag">${t}</span>`).join('')}</div><p>Пройдено ${done} из ${items.length}</p>${progressBar(done / items.length * 100, c.title)}<div class="course-bottom"><span>${items.length} уроков · ~${c.minutes} мин</span><a class="text-link" href="#lessons/${course}">К курсу ${icon('arrow')}</a></div><a class="button secondary course-action" href="#lessons/${next.id}">${complete ? 'Повторить' : started ? 'Продолжить' : 'Начать'}</a></div></article>`;
}
function filtersHtml(active) {
  return `<div class="filters" role="group" aria-label="Фильтр по направлению">${[['all','Все направления'],...Object.entries(COURSES).map(([id,c]) => [id,c.title])].map(([id,label]) => `<button type="button" data-filter="${id}" class="${active === id ? 'selected' : ''}" aria-pressed="${active === id}">${label}</button>`).join('')}</div>`;
}
function lessonsPage(filter = 'all') {
  const favorites = filter === 'favorites';
  const list = LESSONS.filter(l => favorites ? state.favorites.includes(l.id) : filter === 'all' || l.course === filter);
  const title = favorites ? 'Избранные уроки' : COURSES[filter]?.title || 'Уроки';
  return heading(title, 'Читай, разбирай примеры и проверяй себя. Прежние результаты сохранены.') + `<div class="actions"><a class="button secondary" href="#lessons">Все курсы</a><a class="button secondary" href="#lessons/favorites">${icon('star')} Избранное (${state.favorites.length})</a></div>` + (filter === 'all' ? `<div class="grid-two course-grid">${Object.keys(COURSES).map(courseCard).join('')}</div><h2>Все уроки</h2>` : '') + (favorites ? '' : filtersHtml(filter)) + `<div class="lesson-grid">${list.map(l => `<article class="card"><div class="lesson-banner ${state.lessons[l.id] || ''}"><span>${icon(l.course === 'python' || l.course === 'daily' ? 'book' : 'code')} Урок ${LESSONS.filter(x=>x.course===l.course).indexOf(l)+1}</span>${statusHtml(l.id)}</div><div class="card-body"><span class="tag">${COURSES[l.course].title}</span><h3>${l.title}</h3><p>${l.subtitle}</p><div class="lesson-meta"><span>${icon('clock')} ${l.minutes} мин</span><a class="text-link" href="#lessons/${l.id}">Открыть ${icon('arrow')}</a></div><button class="ghost favorite-button" data-favorite="${l.id}" aria-pressed="${state.favorites.includes(l.id)}">${icon('star')} ${state.favorites.includes(l.id) ? 'В избранном' : 'В избранное'}</button></div></article>`).join('')}</div>${!list.length ? '<p class="locked">Нажми «В избранное» в нужном уроке — он появится здесь.</p>' : ''}`;
}
function answerFields(q, prefix) {
  if (q.options) return `<div class="options">${q.options.map((option, index) => `<label class="option"><input type="radio" name="answer" value="${escapeHtml(option)}" id="${prefix}-${index}"><span>${escapeHtml(option)}</span></label>`).join('')}</div>`;
  return `<label class="input-label" for="${prefix}-answer">Твой ответ<input type="text" name="answer" id="${prefix}-answer" autocomplete="off" maxlength="300" placeholder="Введи ответ"></label>`;
}
function questionForm(q, type, id) {
  return `<form data-question="${type}" data-id="${id}" novalidate><fieldset><legend>${escapeHtml(q.question)}</legend>${q.code ? `<pre><code>${escapeHtml(q.code)}</code></pre>` : ''}${answerFields(q, `${type}-${id}`)}</fieldset><div class="actions"><button type="submit">Проверить ${icon('check')}</button><button type="button" class="ghost" data-hint>Подсказка</button><button type="button" class="ghost" data-retry>Ещё раз</button></div><p class="hint" hidden>${escapeHtml(q.hint)}</p><div class="feedback" role="status" aria-live="polite"></div></form>`;
}
function lessonPage(id) {
  const l = LESSONS.find(item => item.id === id);
  if (!l) return notFound();
  if (!state.lessons[id]) state.lessons[id] = 'started';
  state.lastLesson = id; saveState();
  const courseLessons = LESSONS.filter(x=>x.course===l.course), position = courseLessons.indexOf(l), next = courseLessons[position+1];
  return `<article class="reading"><a class="text-link" href="#lessons/${l.course}">← К курсу «${COURSES[l.course].title}»</a><div class="test-top"><span>Урок ${position+1} из ${courseLessons.length} · ${l.minutes} минут</span><span id="lesson-status">${statusHtml(id)}</span></div><h1>${l.title}</h1><button class="ghost favorite-button" data-favorite="${id}" aria-pressed="${state.favorites.includes(id)}">${icon('star')} ${state.favorites.includes(id) ? 'В избранном' : 'В избранное'}</button><p class="lead">${l.text}</p><h2>Разберём на примерах</h2>${l.examples.map(([code,explanation],i)=>`<div class="example"><h3>Пример ${i+1}</h3><pre><code>${escapeHtml(code)}</code></pre><p>${explanation}</p></div>`).join('')}<section class="question"><span class="eyebrow">ЗАКРЕПИМ ЗНАНИЯ</span>${questionForm(l.check,'lesson',id)}</section><div class="actions"><a class="button secondary" href="#lessons/${l.course}">К курсу</a><a class="button" href="${next ? '#lessons/'+next.id : '#tests/'+l.course}">${next ? 'Следующий урок' : 'Перейти к тесту'} ${icon('arrow')}</a></div></article>`;
}
function tasksPage(filter = 'all') {
  return heading('Практика делает увереннее', `${TASKS.length} небольших заданий. Можно ошибаться, брать подсказки и пробовать снова.`) + filtersHtml(filter) + `<div class="task-grid">${TASKS.filter(t => filter === 'all' || t.course === filter).map(t => `<article class="question"><div class="task-head"><span>${COURSES[t.course].title} · Задание ${t.id}</span><span data-task-status="${t.id}" class="${state.tasks[t.id] ? 'solved' : ''}">${state.tasks[t.id] ? '✓ Решено' : '○ Не решено'}</span></div><h3>${t.title}</h3>${questionForm(t, 'task', t.id)}</article>`).join('')}</div>`;
}
function testsPage() {
  return heading('Проверь свои знания', 'Без таймера и спешки. Для успешного прохождения нужно набрать от 70%.') + `<div class="grid-two">${Object.entries(COURSES).map(([id,c]) => `<article class="card test-card"><span class="icon-box ${id === 'web' ? 'purple' : ''}">${icon('test')}</span><h2>${c.testTitle}</h2><p>${TESTS[id].length} вопросов · 4 варианта ответа<br>Разбор ошибок после завершения</p><p>Лучший результат: <b>${state.tests[id] === undefined ? 'ещё нет' : state.tests[id] + '%'}</b> ${state.tests[id] >= 70 ? '✓ Тест сдан' : ''}</p><a class="button" href="#tests/${id}">Начать тест ${icon('arrow')}</a></article>`).join('')}</div>`;
}
let attempt = null;
function testPage(course) {
  if (!COURSES[course]) return notFound();
  if (!attempt || attempt.course !== course) attempt = { course, answers: [], index: 0, complete: false };
  if (attempt.complete) return testResult();
  const questions = TESTS[course], q = questions[attempt.index];
  return `<section class="reading"><a class="text-link" href="#tests">← К списку тестов</a><h1 style="margin-top:25px">${COURSES[course].testTitle}</h1><div class="test-top"><span>Вопрос ${attempt.index + 1} из ${questions.length}</span><span>Без ограничения времени</span></div>${progressBar(attempt.index / questions.length * 100, 'Пройденные вопросы')}<div class="question"><form id="test-form" novalidate><fieldset><legend>${escapeHtml(q[0])}</legend><div class="options">${q[1].map((answer,index) => `<label class="option"><input type="radio" name="answer" value="${index}"><span>${escapeHtml(answer)}</span></label>`).join('')}</div></fieldset><button type="submit">${attempt.index === questions.length - 1 ? 'Завершить тест' : 'Следующий вопрос'} ${icon('arrow')}</button><div class="feedback" role="status"></div></form></div><p class="hint">Ответы и пояснения появятся после последнего вопроса.</p></section>`;
}
function finishTest() {
  const qs = TESTS[attempt.course];
  attempt.correct = qs.filter((q,i) => q[2] === attempt.answers[i]).length;
  attempt.percent = Math.round(attempt.correct / qs.length * 100);
  attempt.complete = true;
  const wasReady = courseReady(attempt.course);
  state.tests[attempt.course] = Math.max(state.tests[attempt.course] ?? 0, attempt.percent);
  studyFeedback(attempt.percent >= 70 ? 'test' : 'wrong', attempt.course, wasReady);
}
function testResult() {
  const qs = TESTS[attempt.course];
  const errors = qs.map((q,i) => ({ q, i })).filter(({ q,i }) => q[2] !== attempt.answers[i]);
  return `<section class="reading"><a class="text-link" href="#tests">← Все тесты</a><div class="card test-card" style="margin-top:25px"><span class="eyebrow">${COURSES[attempt.course].testTitle}</span><h1>${attempt.percent >= 70 ? 'Отличная работа, тест сдан!' : 'Ещё немного практики'}</h1><div class="result-score">${attempt.percent}%</div><p>Правильных ответов: ${attempt.correct} из ${qs.length}. Проходной результат — 70%.</p><p>Лучший результат: ${state.tests[attempt.course]}%. Он сохранится, даже если следующая попытка будет хуже.</p><div class="actions"><button data-restart="${attempt.course}">Пройти ещё раз</button><a class="button secondary" href="#${courseReady(attempt.course) ? 'certificate/' + attempt.course : 'lessons/' + attempt.course}">${courseReady(attempt.course) ? 'Получить сертификат' : 'Повторить уроки'}</a></div></div><h2 style="margin-top:28px">${errors.length ? 'Разбор ошибок' : 'Все ответы верные'}</h2>${errors.map(({q,i}) => `<article class="review-item"><b>${i + 1}. ${escapeHtml(q[0])}</b><p>Твой ответ: ${escapeHtml(q[1][attempt.answers[i]])}</p><p>Правильный ответ: <strong>${escapeHtml(q[1][q[2]])}</strong></p><p>${escapeHtml(q[3])}</p></article>`).join('')}${errors.length ? '' : '<p class="muted">Ты уверенно разобрался с основами. Продолжай практиковаться!</p>'}</section>`;
}
function readinessHtml(course, action = true) {
  const c = COURSES[course], done = countLessons(course), ready = courseReady(course);
  return `<article class="card readiness"><h3>${c.title}</h3><ul><li>${done === c.count ? '✓' : '○'} Пройдено уроков: ${done} из ${c.count}${done < c.count ? ` — осталось ${c.count - done}` : ''}</li><li>${state.tests[course] >= 70 ? '✓' : '○'} Тест от 70%: ${state.tests[course] === undefined ? 'ещё не пройден' : `лучший результат ${state.tests[course]}%`}</li></ul><p class="${ready ? 'ready' : 'muted'}">${ready ? '✓ Сертификат доступен!' : 'Пройди все уроки направления и сдай тест.'}</p>${action ? `<a class="text-link" href="#${ready ? 'certificate/' + course : done < c.count ? 'lessons/' + course : 'tests/' + course}">${ready ? 'Получить сертификат' : done < c.count ? 'К урокам' : 'К тесту'} ${icon('arrow')}</a>` : ''}</article>`;
}
function progressPage() {
  return heading('Твой путь в программировании','Каждый урок и решённое задание — шаг вперёд.') + (state.expanded ? '<p class="feedback">Добавлены новые материалы — ваши прежние результаты сохранены. Общая программа теперь больше, поэтому общий процент может быть ниже.</p>' : '') + `<div class="card test-card"><div class="section-head"><h2>Общий прогресс</h2><b class="accent">${totalPercent()}%</b></div>${progressBar(totalPercent())}<p>(${countLessons()} уроков + ${countTasks()} заданий + ${passedTests()} тестов) / ${totalItems()} × 100%, с округлением.</p><p>Мини-проекты отмечаются по самопроверке и не влияют на процент или сертификаты.</p></div>` + statsHtml() + `<h2>Твои достижения</h2><div class="achievement-grid">${achievementDefinitions().map(([id,title,earned,desc])=>`<div class="achievement ${state.achievements[id] || earned ? 'earned' : ''}"><span class="icon-box ${state.achievements[id] || earned ? 'gold' : ''}">${icon(state.achievements[id] || earned ? 'award' : 'lock')}</span><div><b>${state.achievements[id] || earned ? '✓ ' : ''}${title}</b><small>${desc}</small></div></div>`).join('')}</div><h2>Результаты тестов и сертификаты</h2><div class="grid-two">${Object.keys(COURSES).map(c=>readinessHtml(c)).join('')}</div><p class="muted">${storageAvailable ? 'Прогресс сохраняется только в этом браузере для этого адреса сайта.' : 'Сохранение недоступно. Данные останутся только в текущем сеансе.'}</p><button class="secondary" id="reset-progress">Сбросить прогресс</button>`;
}
let certificateCourse = 'python';
function certificatePage(course) {
  if (COURSES[course]) certificateCourse = course;
  const ready = courseReady(certificateCourse);
  return heading('Твой первый сертификат', 'Отметь свой успех: пройди уроки направления и сдай тест с результатом от 70%.') + `<div class="grid-two">${Object.keys(COURSES).map(c=>readinessHtml(c)).join('')}</div><p class="muted">Решать дополнительные задания для получения сертификата не обязательно.</p><form id="certificate-form" class="card profile-form" novalidate><h2>На чьё имя оформить?</h2><p class="intro">Данные остаются в твоём браузере. Заполни все три поля.</p><div class="profile-fields">${[['surname','Фамилия','Твоя фамилия'],['name','Имя','Твоё имя'],['className','Класс','Например, 11А']].map(([key,label,placeholder]) => `<label class="input-label" for="profile-${key}">${label}<input id="profile-${key}" name="${key}" type="text" value="${escapeHtml(state.profile[key])}" maxlength="${key === 'className' ? 30 : 160}" placeholder="${placeholder}" autocomplete="${key === 'surname' ? 'family-name' : key === 'name' ? 'given-name' : 'off'}" required></label>`).join('')}</div><label class="input-label" for="certificate-course" style="margin-top:20px">Направление<select id="certificate-course" name="course">${Object.entries(COURSES).map(([id,c])=>`<option value="${id}" ${certificateCourse===id?'selected':''}>${c.title}</option>`).join('')}</select></label><div class="actions"><button type="submit" ${ready ? '' : 'disabled'}>Предварительный просмотр ${icon('award')}</button></div><div class="feedback" role="status"></div></form><div id="certificate-output">${ready ? '<div class="locked">Всё готово! Заполни данные и создай предварительный просмотр.</div>' : '<div class="locked">' + icon('lock') + ' Сертификат этого направления откроется после выполнения условий выше.</div>'}</div><p class="hint">Это учебный сертификат школьного проекта, а не официальный документ об образовании.</p>`;
}
function aboutPage() {
  return heading('Об авторе', 'Школьный проект, с которого тоже начинается путь.') + `<article class="card author"><div class="author-avatar">ДР</div><span class="eyebrow">АВТОР ПРОЕКТА DAVCODE</span><h2>Русинов Давид</h2><p>Ученик 11А класса</p><p>DavCode — учебный сайт для знакомства с программированием. Название связано с именем автора — Давид.</p><blockquote>Цель проекта — помочь школьникам познакомиться с программированием через короткие уроки, практику и тесты.</blockquote><div class="actions"><a class="button" href="#lessons">Начать учиться ${icon('arrow')}</a></div></article>`;
}
function notFound() { return heading('Такой страницы нет', 'Возможно, в адресе опечатка.') + '<a class="button" href="#home">На главную</a>'; }
let currentSection = '';
function render() {
  const [section = 'home', detail] = (location.hash.slice(1) || 'home').split('/');
  if (section === 'main') { $('#main').focus(); return; }
  if (currentSection === 'tests' && section !== 'tests') attempt = null;
  currentSection = section;
  let html;
  if (section === 'home') html = homePage();
  else if (section === 'lessons') html = detail && /^\d+$/.test(detail) ? lessonPage(Number(detail)) : (!detail || ['all','favorites',...Object.keys(COURSES)].includes(detail) ? lessonsPage(detail || 'all') : notFound());
  else if (section === 'tasks') html = !detail || ['all',...Object.keys(COURSES)].includes(detail) ? tasksPage(detail || 'all') : notFound();
  else if (section === 'tests') { if (!detail) attempt = null; html = detail ? testPage(detail) : testsPage(); }
  else if (section === 'progress') html = progressPage();
  else if (section === 'certificate') html = certificatePage(detail);
  else if (section === 'about') html = aboutPage();
  else if (section === 'practice') html = practicePage(detail || 'projects');
  else html = notFound();
  $('#main').innerHTML = `<div class="page">${html}</div>`;
  $('#breadcrumb').textContent = NAV.find(n => n[0] === section)?.[1] || 'Страница не найдена';
  document.querySelectorAll('#nav a').forEach(link => {
    const active = link.getAttribute('href') === '#' + section;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  $('#sidebar').classList.remove('open'); $('#menu-toggle').setAttribute('aria-expanded', 'false');
  $('#main').focus({ preventScroll: true }); window.scrollTo(0, 0);
}
function normalizeAnswer(value) { return String(value).trim().normalize('NFC').replace(/\s+/g, ' '); }
function isCorrect(q, value) { const answer = normalizeAnswer(value); return answer !== '' && q.answers.some(a => normalizeAnswer(a) === answer); }
function feedback(form, message, kind = '') { const el = form.querySelector('.feedback'); el.textContent = message; el.className = 'feedback ' + kind; }
let toastTimer;
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible'); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4500); }
function celebrate() { setTimeout(() => { toast('Направление завершено! Твой сертификат уже доступен.'); $('#main .page')?.classList.add('celebrate'); }, 30); }
function checkQuestion(form) {
  const type = form.dataset.question, id = Number(form.dataset.id);
  const item = (type === 'lesson' ? LESSONS : TASKS).find(x => x.id === id);
  const q = type === 'lesson' ? item.check : item;
  const answer = new FormData(form).get('answer') || '';
  if (!normalizeAnswer(answer)) { feedback(form, 'Сначала введи или выбери ответ.', 'error'); return; }
  if (!isCorrect(q, answer)) { feedback(form, 'Пока не получилось. ' + q.hint + ' Измени ответ и проверь ещё раз.', 'error'); window.DavSound?.play('wrong'); return; }
  const wasReady = courseReady(item.course);
  const newlyDone = type === 'lesson' ? state.lessons[id] !== 'done' : !state.tasks[id];
  if (type === 'lesson') { state.lessons[id] = 'done'; $('#lesson-status').innerHTML = statusHtml(id); }
  else { state.tasks[id] = true; const label = $(`[data-task-status="${id}"]`); label.textContent = '✓ Решено'; label.className = 'solved'; }
  saveState(); feedback(form, 'Верно! ' + q.explanation, 'success');
  studyFeedback(type === 'lesson' && newlyDone ? 'lesson' : 'correct', item.course, wasReady);
}
function createPreview(form) {
  if (!courseReady(certificateCourse)) { feedback(form, 'Сначала выполни условия направления.', 'error'); return; }
  for (const key of ['surname','name','className']) {
    const input = form.elements.namedItem(key);
    if (!input.value.trim()) { feedback(form, 'Заполни фамилию, имя и класс. Пробелы не считаются ответом.', 'error'); input.focus(); return; }
    state.profile[key] = input.value.trim();
  }
  if (!state.issued[certificateCourse]) state.issued[certificateCourse] = new Date().toLocaleDateString('ru-RU');
  saveState();
  $('#certificate-output').innerHTML = '<div class="certificate-preview"><canvas id="certificate-canvas" role="img" aria-label="Предварительный просмотр сертификата"></canvas></div><div class="actions"><button data-download="png">Скачать PNG</button><button data-download="pdf" class="secondary">Скачать PDF</button></div><div class="feedback" id="export-feedback" role="status"></div>';
  drawCertificate($('#certificate-canvas'), state.profile, COURSES[certificateCourse].title, state.tests[certificateCourse], state.issued[certificateCourse]);
  $('#certificate-canvas').setAttribute('aria-label', `Сертификат: ${state.profile.surname} ${state.profile.name}, класс ${state.profile.className}. ${COURSES[certificateCourse].title}. Результат ${state.tests[certificateCourse]}%. Дата ${state.issued[certificateCourse]}. Автор проекта: Русинов Давид, 11А класс. Учебный сертификат школьного проекта.`);
  feedback(form, 'Предварительный просмотр готов. Проверь имя перед скачиванием.', 'success');
}
function applyTheme() {
  document.body.classList.toggle('dark', state.theme === 'dark');
  $('#theme-toggle').innerHTML = icon(state.theme === 'dark' ? 'sun' : 'moon') + (state.theme === 'dark' ? 'Светлая тема' : 'Тёмная тема');
}
function achievementDefinitions() {
  return [
    ['first-lesson','Первый урок',countLessons()>=1,'Пройти проверку в одном уроке'],
    ['five-tasks','Пять решённых заданий',countTasks()>=5,'Закрепить знания на практике'],
    ['first-test','Первый сданный тест',passedTests()>=1,'Набрать от 70% в любом тесте'],
    ['fifteen-tasks','Пятнадцать заданий',countTasks()>=15,'Решить 15 разных заданий'],
    ...NEW_COURSES.map(c=>['course-'+c,COURSES[c].title,countLessons(c)===4,'Пройти все четыре урока курса']),
    ['new-tests','Три новых вершины',NEW_COURSES.every(c=>state.tests[c]>=70),'Сдать все три новых теста']
  ];
}
function awardAchievements() {
  const added=[];
  achievementDefinitions().forEach(([id,title,earned])=>{ if(earned && !state.achievements[id]) {state.achievements[id]=true;added.push(title);} });
  return added;
}
function studyFeedback(kind, course, wasReady) {
  const added=awardAchievements(); saveState();
  if(!wasReady && courseReady(course)) { celebrate(); window.DavSound?.play('certificate'); }
  else if(added.length) { toast('Новое достижение: '+added.join(' · ')); window.DavSound?.play('achievement'); }
  else window.DavSound?.play(kind);
}
function nextStepHtml() {
  const last=LESSONS.find(l=>l.id===state.lastLesson && state.lessons[l.id]!=='done');
  const next=last || LESSONS.find(l=>state.lessons[l.id]==='started') || LESSONS.find(l=>state.lessons[l.id]!=='done');
  return `<div class="continue"><div><b>Следующий шаг</b><small>${next ? escapeHtml(next.title) : 'Все уроки пройдены — попробуй мини-проект!'}</small></div><a class="text-link" href="${next ? '#lessons/'+next.id : '#practice/projects'}">${next && state.lessons[next.id] ? 'Продолжить' : next ? 'Начать урок' : 'К проектам'} ${icon('arrow')}</a></div>`;
}
function practiceTabs(active) {
  return `<div class="actions"><a class="button ${active==='projects'?'':'secondary'}" href="#practice/projects">Мини-проекты</a><a class="button ${active==='reference'?'':'secondary'}" href="#practice/reference">Справочник</a><a class="button secondary" href="#tasks">Задания с проверкой</a></div>`;
}
function practicePage(detail='projects') {
  if(detail==='reference') return heading('Справочник','Короткие примеры под рукой. Ищи по названию, языку или ключевым словам.')+practiceTabs('reference')+`<label class="input-label reference-search" for="reference-search">Поиск<input id="reference-search" type="search" placeholder="Например: циклы, кнопка, отступы" autocomplete="off"></label><p id="reference-count" class="muted" role="status"></p><div id="reference-results">${referenceHtml('')}</div>`;
  const project=PROJECTS.find(p=>p.id===detail);
  if(project) return projectPage(project);
  if(detail!=='projects') return notFound();
  return heading('Практика: собираем свой проект','Здесь ты пишешь код самостоятельно. Отметка о завершении — твоя самопроверка.')+practiceTabs('projects')+`<div class="grid-two course-grid">${PROJECTS.map(p=>`<article class="card test-card"><span class="icon-box">${icon('code')}</span><h2>${p.title}</h2><p>${p.goal}</p><p>${state.projects[p.id]?.done?'✓ Выполнено по самопроверке':'○ Ещё не отмечено'}</p><a class="button" href="#practice/${p.id}">Открыть проект ${icon('arrow')}</a></article>`).join('')}</div>`;
}
function referenceHtml(query) {
  const terms=query.toLocaleLowerCase('ru').trim().split(/\s+/).filter(Boolean);
  const items=REFERENCE.filter(row=>terms.every(term=>row.join(' ').toLocaleLowerCase('ru').includes(term)));
  return `<p class="hint">Найдено: ${items.length}</p><div class="grid-two">${items.map(([language,title,keys,code,text])=>`<article class="question"><span class="tag">${language}</span><h2>${title}</h2><p>${text}</p><pre><code>${escapeHtml(code)}</code></pre></article>`).join('')}</div>${items.length?'':'<p class="locked">Ничего не найдено. Попробуй другое слово.</p>'}`;
}
function projectPage(p) {
  const saved=state.projects[p.id] || {checks:[],done:false};
  return `<article class="reading"><a class="text-link" href="#practice/projects">← Все проекты</a><h1>${p.title}</h1><p class="lead">${p.goal}</p><section class="question"><h2>Где писать и запускать</h2><p>${p.where}</p></section>${p.steps.map(([title,text,code],i)=>`<section class="example"><h2>Шаг ${i+1}. ${title}</h2><p>${text}</p><pre><code>${escapeHtml(code)}</code></pre></section>`).join('')}<section class="question"><h2>Чек-лист самопроверки</h2><p>Запусти проект у себя и отметь пункты. Сайт не выполняет и не проверяет твой код автоматически.</p>${p.checklist.map((text,i)=>`<label class="option"><input type="checkbox" data-project-check="${p.id}" data-index="${i}" ${saved.checks.includes(i)?'checked':''}>${text}</label>`).join('')}<label class="option project-done"><input type="checkbox" data-project-done="${p.id}" ${saved.done?'checked':''}><strong>Я проверил(а) проект и отмечаю его выполненным</strong></label><p class="hint" id="project-save-status" role="status">Отметка самостоятельная; на сертификат не влияет.</p></section><details class="solution"><summary>Показать решение</summary><p>Сравни со своим вариантом. Несколько разных решений могут быть правильными.</p><pre><code>${escapeHtml(p.solution)}</code></pre></details><a class="button secondary" href="#lessons/${p.course}">Повторить курс</a></article>`;
}
// Дополнительные действия используют то же хранилище, не создавая отдельного прогресса.
$('#main').addEventListener('click', event=>{
  const button=event.target.closest('[data-favorite]'); if(!button)return;
  const id=Number(button.dataset.favorite), present=state.favorites.includes(id);
  state.favorites=present?state.favorites.filter(x=>x!==id):[...state.favorites,id];saveState();
  button.setAttribute('aria-pressed',String(!present));button.innerHTML=icon('star')+(present?' В избранное':' В избранном');
  toast(present?'Урок удалён из избранного':'Урок добавлен в избранное');
  if(location.hash==='#lessons/favorites') render();
});
$('#main').addEventListener('change',event=>{
  const id=event.target.dataset.projectCheck || event.target.dataset.projectDone;
  const project=PROJECTS.find(p=>p.id===id);if(!project)return;
  const entry=state.projects[id] || {done:false,checks:[]};
  if(event.target.dataset.projectCheck){ const i=Number(event.target.dataset.index);entry.checks=event.target.checked?[...new Set([...entry.checks,i])]:entry.checks.filter(x=>x!==i); }
  else entry.done=event.target.checked;
  state.projects[id]=entry;saveState();$('#project-save-status').textContent=storageAvailable?'Самопроверка сохранена.':'Отметка сохранена в текущем сеансе.';
});
// При миграции старые достижения фиксируются без повторного уведомления и звука.
awardAchievements();
$('#nav').innerHTML = NAV.map(([id,label,i]) => `<a href="#${id}">${icon(i)}${label}</a>`).join('');
$('#menu-toggle').innerHTML = icon('menu');
$('#menu-toggle').addEventListener('click', () => { const open = $('#sidebar').classList.toggle('open'); $('#menu-toggle').setAttribute('aria-expanded', String(open)); });
$('#theme-toggle').addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; applyTheme(); saveState(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { $('#sidebar').classList.remove('open'); $('#menu-toggle').setAttribute('aria-expanded', 'false'); } });
$('#main').addEventListener('submit', event => {
  event.preventDefault(); const form = event.target;
  if (form.dataset.question) checkQuestion(form);
  else if (form.id === 'test-form') {
    const answer = new FormData(form).get('answer');
    if (answer === null) { feedback(form, 'Выбери один ответ, чтобы продолжить.', 'error'); return; }
    attempt.answers.push(Number(answer)); attempt.index++;
    if (attempt.index === TESTS[attempt.course].length) finishTest();
    render();
  } else if (form.id === 'certificate-form') createPreview(form);
});
$('#main').addEventListener('input', event => {
  if(event.target.id==='reference-search') { $('#reference-results').innerHTML=referenceHtml(event.target.value); $('#reference-count').textContent='Поиск обновлён'; }
  if (event.target.closest('#certificate-form') && ['surname','name','className'].includes(event.target.name)) {
    state.profile[event.target.name] = event.target.value; saveState();
    $('#certificate-output').innerHTML = '<div class="locked">Данные изменены. Обнови предварительный просмотр.</div>';
  }
});
$('#main').addEventListener('change', event => { if (event.target.id === 'certificate-course') { certificateCourse = event.target.value; location.hash = '#certificate/' + certificateCourse; } });
$('#main').addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.filter) location.hash = '#' + currentSection + '/' + button.dataset.filter;
  else if (button.hasAttribute('data-hint')) { const hint = button.closest('form').querySelector('.hint'); hint.hidden = !hint.hidden; button.textContent = hint.hidden ? 'Подсказка' : 'Скрыть подсказку'; }
  else if (button.hasAttribute('data-retry')) { const form = button.closest('form'); form.reset(); feedback(form, 'Попробуй ещё раз. Уже заработанный прогресс сохранится.'); form.querySelector('input')?.focus(); }
  else if (button.dataset.restart) { attempt = null; render(); }
  else if (button.id === 'reset-progress') $('#reset-dialog').showModal();
  else if (button.dataset.download) {
    const canvas = $('#certificate-canvas'); if (!canvas || !courseReady(certificateCourse)) return;
    const format = button.dataset.download;
    try {
      const blob = format === 'pdf' ? certificatePdf(canvas) : await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const safeName = `${state.profile.surname}-${state.profile.name}`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').slice(0, 100);
      downloadCertificate(blob, `DavCode-${certificateCourse}-${safeName}.${format}`);
      $('#export-feedback').textContent = `Файл ${format.toUpperCase()} подготовлен. Он появится в загрузках браузера.`;
    } catch { $('#export-feedback').textContent = 'Не удалось создать файл. Попробуй ещё раз в современном браузере.'; }
  }
});
$('#cancel-reset').addEventListener('click', () => $('#reset-dialog').close());
$('#confirm-reset').addEventListener('click', () => {
  const { profile, theme, favorites } = state; state = freshState(); state.profile = profile; state.theme = theme; state.favorites = favorites; attempt = null;
  saveState(); $('#reset-dialog').close(); render(); toast('Прогресс сброшен. Можно начать заново.');
});
window.addEventListener('hashchange', render);
applyTheme(); render();
if (!storageAvailable) toast('Сохранение недоступно. Сайт продолжит работать в текущем сеансе.');
