  const body = document.body;

  /* ---------- Nav settings ---------- */
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const lightBtn = document.getElementById('lightBtn');
  const darkBtn = document.getElementById('darkBtn');
  const sizeBtns = document.querySelectorAll('.size-btn');
  const viBtn = document.getElementById('viBtn');
  const enBtn = document.getElementById('enBtn');

  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = settingsPanel.classList.toggle('open');
    settingsBtn.setAttribute('aria-expanded', isOpen);
  });
  document.addEventListener('click', (e) => {
    if(!settingsPanel.contains(e.target) && e.target !== settingsBtn){
      settingsPanel.classList.remove('open');
      settingsBtn.setAttribute('aria-expanded', 'false');
    }
  });

  function setTheme(theme){
    body.setAttribute('data-theme', theme);
    lightBtn.classList.toggle('active', theme === 'light');
    darkBtn.classList.toggle('active', theme === 'dark');
  }
  lightBtn.addEventListener('click', () => setTheme('light'));
  darkBtn.addEventListener('click', () => setTheme('dark'));

  sizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sizeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.documentElement.style.setProperty('--font-scale', btn.dataset.scale);
    });
  });

  /* ---------- Hero typing animation ---------- */
  const HERO_TYPING_TEXT = {
    vi: 'Không gian tìm kiếm sự hỗ trợ tâm lý an toàn bằng AI.',
    en: 'A safe, respectful space to find mental health support through AI.',
  };
  const heroTypingVi = document.getElementById('heroTypingVi');
  const heroTypingEn = document.getElementById('heroTypingEn');
  let heroTypingTimer = null;

  function stopHeroTyping(){
    if(heroTypingTimer){
      clearInterval(heroTypingTimer);
      heroTypingTimer = null;
    }
    document.querySelectorAll('.typing-cursor').forEach(c => c.classList.remove('is-active'));
  }

  function typeHeroTitle(lang, instant){
    stopHeroTyping();
    const text = HERO_TYPING_TEXT[lang];
    const target = lang === 'vi' ? heroTypingVi : heroTypingEn;
    const other = lang === 'vi' ? heroTypingEn : heroTypingVi;
    const cursor = target.parentElement.querySelector('.typing-cursor');

    other.textContent = '';
    target.textContent = '';

    if(instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      target.textContent = text;
      return;
    }

    cursor.classList.add('is-active');
    let i = 0;
    const speed = lang === 'vi' ? 42 : 34;

    heroTypingTimer = setInterval(() => {
      if(i < text.length){
        target.textContent += text.charAt(i);
        i++;
      } else {
        stopHeroTyping();
      }
    }, speed);
  }

  function setLang(lang){
    body.setAttribute('data-lang', lang);
    viBtn.classList.toggle('active', lang === 'vi');
    enBtn.classList.toggle('active', lang === 'en');
    if(!pageHome.classList.contains('hidden')) typeHeroTitle(lang);
  }
  viBtn.addEventListener('click', () => setLang('vi'));
  enBtn.addEventListener('click', () => setLang('en'));
  typeHeroTitle(body.getAttribute('data-lang') || 'vi');

  /* ---------- Page switching (Trang chủ / Giới thiệu) ---------- */
  const navHome = document.getElementById('navHome');
  const navAbout = document.getElementById('navAbout');
  const pageHome = document.getElementById('pageHome');
  const pageAbout = document.getElementById('pageAbout');

  function showPage(page){
    pageHome.classList.toggle('hidden', page !== 'home');
    pageAbout.classList.toggle('hidden', page !== 'about');
    navHome.classList.toggle('active', page === 'home');
    navAbout.classList.toggle('active', page === 'about');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if(page === 'home') typeHeroTitle(body.getAttribute('data-lang') || 'vi');
  }
  navHome.addEventListener('click', () => showPage('home'));
  navAbout.addEventListener('click', () => showPage('about'));

  /* ---------- Notification popup ----------
     Nội dung để trống, chỉnh trực tiếp trong khối
     <div class="notice-overlay" id="noticeOverlay"> ở phần HTML phía trên.
     Popup tự mở khi tải trang, đóng khi bấm nút "X". */
  const noticeOverlay = document.getElementById('noticeOverlay');
  const noticeClose = document.getElementById('noticeClose');

  function openNotice(){ noticeOverlay.classList.add('open'); }
  function closeNotice(){ noticeOverlay.classList.remove('open'); }

  noticeClose.addEventListener('click', closeNotice);
  noticeOverlay.addEventListener('click', (e) => {
    if(e.target === noticeOverlay) closeNotice();
  });

  openNotice(); 
  let answers = {};
  let cursor = 0;

  function activeSteps(){
    return steps.filter(s => !s.showIf || s.showIf(answers));
  }
  function lang(){ return body.getAttribute('data-lang'); }
  function t(obj){ return obj[lang()]; }

  const overlay = document.getElementById('wizardOverlay');
  const wizardBody = document.getElementById('wizardBody');
  const progressBar = document.getElementById('progressBar');
  const wfBack = document.getElementById('wfBack');
  const wfNext = document.getElementById('wfNext');
  const wizardFooter = document.getElementById('wizardFooter');

  function openWizard(){
    answers = {};
    cursor = 0;
    overlay.classList.add('open');
    render();
  }
  function closeWizard(){ overlay.classList.remove('open'); }
  document.getElementById('startBtn').addEventListener('click', openWizard);
  document.getElementById('wizardClose').addEventListener('click', closeWizard);

  function isAnswered(step){
    if(!step.required) return true;
    const v = answers[step.key];
    if(step.type === 'multi') return Array.isArray(v) && v.length > 0;
    if(step.type === 'text') return typeof v === 'string' && v.trim().length > 0;
    if(step.type === 'cascade') return v && v.province !== undefined && v.ward !== undefined;
    if(step.type === 'single') return v !== undefined;
    return true;
  }

  function render(){
    const list = activeSteps();
    if(cursor >= list.length) cursor = list.length - 1;
    const step = list[cursor];
    const total = list.length - 2; // exclude lang gate + done from the count shown to user
    const posInQuestions = list.slice(0, cursor).filter(s => s.type !== 'lang' && s.type !== 'done').length;

    progressBar.style.width = (step.type === 'lang') ? '0%'
      : (step.type === 'done') ? '100%'
      : Math.round(((posInQuestions + 1) / total) * 100) + '%';

    wizardFooter.style.display = (step.type === 'lang' || step.type === 'done') ? 'none' : 'flex';
    wfBack.disabled = cursor === 0;

    let html = '';

    if(step.type === 'lang'){
      html = `
        <div class="lang-gate">
          <div class="wizard-question" style="margin-bottom:16px;">Vui lòng chọn ngôn ngữ / Please select your language</div>
          <button class="lang-gate-btn" data-lang-pick="vi">Tiếng Việt <small>Vietnamese</small></button>
          <button class="lang-gate-btn" data-lang-pick="en">English <small>Tiếng Anh</small></button>
        </div>`;
    } else if(step.type === 'done'){
      html = `
        <div style="text-align:center; padding: 10px 0 18px;">
          <div class="done-icon">✓</div>
          <div class="wizard-question">${t({vi:'Cảm ơn bạn đã chia sẻ',en:'Thank you for sharing'})}</div>
          <p class="wizard-hint">${t({vi:'Hệ thống sẽ dùng thông tin này để gợi ý cơ sở tham vấn phù hợp nhất. Bước kết quả sẽ được kết nối riêng.',en:'This information will be used to recommend the best-fitting facility. The results step will be connected separately.'})}</p>
        </div>`;
    } else {
      const stepNumLabel = t({vi:`Câu ${posInQuestions + 1} / ${total}`, en:`Question ${posInQuestions + 1} of ${total}`});
      html += `<div class="wizard-step-label">${stepNumLabel}</div>`;
      html += `<div class="wizard-question">${t(step.q)}</div>`;
      if(step.hint) html += `<div class="wizard-hint">${t(step.hint)}</div>`;
      else html += `<div class="wizard-hint" style="visibility:hidden">.</div>`;

      if(step.type === 'single' || step.type === 'multi'){
        const selected = answers[step.key];
        html += `<div class="option-list ${step.grid ? 'grid' : ''}">`;
        step.options.forEach((opt, i) => {
          const isSel = step.type === 'single' ? selected === i : Array.isArray(selected) && selected.includes(i);
          html += `<button type="button" class="option-card ${isSel ? 'selected' : ''}" data-opt="${i}">
            <span class="option-check"></span><span>${t(opt)}</span></button>`;
        });
        html += `</div>`;
      }

      if(step.type === 'text'){
        const val = answers[step.key] || '';
        html += `<input class="text-input" id="textField" type="text" value="${val.replace(/"/g,'&quot;')}" placeholder="${t(step.placeholder)}">`;
      }

      if(step.type === 'cascade'){
        html += `<div class="sample-note">${t({vi:'(Phạm vi hiện tại: TP. Hồ Chí Minh, sau sáp nhập 01/07/2025)'})}</div>`;

        if(locationsState.status !== 'ready'){
          if(locationsState.status === 'idle') ensureLocationsLoaded(render);
          if(locationsState.status === 'error'){
            html += `<div class="wizard-hint" style="color:var(--coral)">${t({vi:'Không tải được danh sách Tỉnh/Phường. ', en:'Could not load the Province/Ward list. '})}</div>
              <button type="button" class="wf-btn wf-back" id="retryLocations">${t({vi:'Thử lại', en:'Retry'})}</button>`;
          } else {
            html += `<div class="wizard-hint">${t({vi:'Đang tải danh sách Phường…', en:'Loading the Ward list…'})}</div>`;
          }
        } else {
          const cur = answers[step.key] || {};
          const provinces = locationsState.provinces;
          html += `<select class="select-input" id="provinceSelect">
            <option value="">${t({vi:'-- Chọn Tỉnh/Thành --', en:'-- Select Province/City --'})}</option>`;
          provinces.forEach((p, i) => {
            html += `<option value="${i}" ${cur.province === i ? 'selected' : ''}>${t(p)}</option>`;
          });
          html += `</select>`;
          html += `<select class="select-input" id="wardSelect" ${cur.province === undefined ? 'disabled' : ''}>
            <option value="">${t({vi:'-- Chọn Phường --', en:'-- Select Ward --'})}</option>`;
          if(cur.province !== undefined){
            provinces[cur.province].wards.forEach((w, i) => {
              html += `<option value="${i}" ${cur.ward === i ? 'selected' : ''}>${t(w)}</option>`;
            });
          }
          html += `</select>`;
        }
      }
    }

    wizardBody.innerHTML = html;
    bindStepEvents(step);
    wfNext.disabled = !isAnswered(step);
    wfNext.innerHTML = (cursor === list.length - 2 && list[list.length-1].type === 'done')
      ? `<span lang-el="vi">Hoàn tất</span><span lang-el="en">Finish</span>`
      : `<span lang-el="vi">Tiếp theo</span><span lang-el="en">Next</span>`;
    applyLangAttrs();
  }

  function applyLangAttrs(){
  }

  function bindStepEvents(step){
    if(step.type === 'lang'){
      wizardBody.querySelectorAll('[data-lang-pick]').forEach(btn => {
        btn.addEventListener('click', () => {
          setLang(btn.dataset.langPick);
          goNext();
        });
      });
      return;
    }
    if(step.type === 'single'){
      wizardBody.querySelectorAll('.option-card').forEach(btn => {
        btn.addEventListener('click', () => {
          answers[step.key] = parseInt(btn.dataset.opt);
          render();
        });
      });
    }
    if(step.type === 'multi'){
      wizardBody.querySelectorAll('.option-card').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = parseInt(btn.dataset.opt);
          const arr = Array.isArray(answers[step.key]) ? answers[step.key].slice() : [];
          const idx = arr.indexOf(i);
          if(idx === -1) arr.push(i); else arr.splice(idx, 1);
          answers[step.key] = arr;
          render();
        });
      });
    }
    if(step.type === 'text'){
      const field = document.getElementById('textField');
      field.addEventListener('input', () => {
        answers[step.key] = field.value;
        wfNext.disabled = !isAnswered(step);
      });
    }
    if(step.type === 'cascade'){
      const retryBtn = document.getElementById('retryLocations');
      if(retryBtn){
        retryBtn.addEventListener('click', () => {
          locationsState.status = 'idle';
          ensureLocationsLoaded(render);
        });
      }
      const provinceSelect = document.getElementById('provinceSelect');
      const wardSelect = document.getElementById('wardSelect');
      if(provinceSelect){
        provinceSelect.addEventListener('change', () => {
          const pi = provinceSelect.value === '' ? undefined : parseInt(provinceSelect.value);
          answers[step.key] = { province: pi, ward: undefined };
          render();
        });
      }
      if(wardSelect){
        wardSelect.addEventListener('change', () => {
          const cur = answers[step.key] || {};
          const wi = wardSelect.value === '' ? undefined : parseInt(wardSelect.value);
          answers[step.key] = { ...cur, ward: wi };
          wfNext.disabled = !isAnswered(step);
        });
      }
    }
  }

  function goNext(){
    const list = activeSteps();
    if(cursor < list.length - 1){
      cursor++;
      render();
    }
  }
  function goBack(){
    if(cursor > 0){
      cursor--;
      render();
    }
  }
  wfNext.addEventListener('click', () => {
    const list = activeSteps();
    const step = list[cursor];
    if(step.type === 'done'){ closeWizard(); return; }
    if(cursor === list.length - 1){ closeWizard(); return; }
    goNext();
  });
  wfBack.addEventListener('click', goBack);
