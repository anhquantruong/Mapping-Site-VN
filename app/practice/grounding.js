// =========================================================
// PRACTICE — GROUNDING 5–4–3–2–1
// =========================================================


// =========================================================
// ELEMENTS
// =========================================================

const openGrounding =
  document.getElementById('openGrounding');

const practicePage =
  document.querySelector('.practice-page');

const groundingExercise =
  document.getElementById('groundingExercise');

const groundingStart =
  document.getElementById('groundingStart');

const groundingIntro =
  document.getElementById('groundingIntro');

const groundingSession =
  document.getElementById('groundingSession');

const groundingComplete =
  document.getElementById('groundingComplete');

const groundingTimer =
  document.getElementById('groundingTimer');

const groundingStep =
  document.getElementById('groundingStep');

const groundingProgressBar =
  document.getElementById('groundingProgressBar');

const groundingNumber =
  document.getElementById('groundingNumber');

const groundingSense =
  document.getElementById('groundingSense');

const groundingTitle =
  document.getElementById('groundingTitle');

const groundingInstruction =
  document.getElementById('groundingInstruction');

const groundingRestart =
  document.getElementById('groundingRestart');

const groundingExit =
  document.getElementById('groundingExit');


// =========================================================
// COMPLETION SOUND
// =========================================================

// THAY URL NÀY BẰNG URL AUDIO CỦA BẠN

const groundingCompleteSound = new Audio(
  'https://www.myinstants.com/en/instant/duolingo-completed-lesson-48481/?utm_source=copy&utm_medium=share'
);

groundingCompleteSound.preload = 'auto';
groundingCompleteSound.volume = 0.5;


// =========================================================
// EXERCISE DATA
// =========================================================

const groundingSteps = [

  {
    number: 5,

    senseVi: 'NHÌN THẤY',
    senseEn: 'SEE',

    titleVi: 'Tìm 5 thứ bạn có thể nhìn thấy.',
    titleEn: 'Find 5 things you can see.',

    instructionVi:
      'Quan sát chậm xung quanh bạn và chú ý đến màu sắc, hình dạng hoặc những chi tiết nhỏ.',

    instructionEn:
      'Slowly look around you and notice colors, shapes, or small details.'
  },

  {
    number: 4,

    senseVi: 'CHẠM',
    senseEn: 'TOUCH',

    titleVi: 'Tìm 4 thứ bạn có thể chạm vào.',
    titleEn: 'Notice 4 things you can touch.',

    instructionVi:
      'Cảm nhận bề mặt, nhiệt độ hoặc kết cấu của những vật ở gần bạn.',

    instructionEn:
      'Notice the texture, temperature, or surface of things around you.'
  },

  {
    number: 3,

    senseVi: 'NGHE',
    senseEn: 'HEAR',

    titleVi: 'Tìm 3 âm thanh bạn có thể nghe.',
    titleEn: 'Notice 3 sounds you can hear.',

    instructionVi:
      'Lắng nghe những âm thanh gần và xa mà bạn có thể nhận ra.',

    instructionEn:
      'Listen for sounds near and far that you can notice.'
  },

  {
    number: 2,

    senseVi: 'NGỬI',
    senseEn: 'SMELL',

    titleVi: 'Tìm 2 thứ bạn có thể ngửi thấy.',
    titleEn: 'Notice 2 things you can smell.',

    instructionVi:
      'Nhẹ nhàng chú ý đến những mùi hương xung quanh bạn.',

    instructionEn:
      'Gently notice the scents and smells around you.'
  },

  {
    number: 1,

    senseVi: 'NẾM',
    senseEn: 'TASTE',

    titleVi: 'Nhận biết 1 vị bạn có thể nếm.',
    titleEn: 'Notice 1 taste you can experience.',

    instructionVi:
      'Nếu có thể, hãy chú ý đến một vị đang có trong miệng. Không cần ăn hoặc uống thêm bất cứ thứ gì.',

    instructionEn:
      'If possible, notice a taste that is already present. You do not need to eat or drink anything.'
  }

];


// =========================================================
// TIMER
// =========================================================

let groundingCurrentStep = 0;

let groundingTimerId = null;

let groundingEndTime = null;

let groundingReturnTimeout = null;

const GROUNDING_STEP_DURATION = 2 * 1000;


// =========================================================
// OPEN GROUNDING FROM CARD
// =========================================================

if (openGrounding && groundingExercise) {

  openGrounding.addEventListener('click', () => {

    if (practicePage) {
      practicePage.classList.add('hidden');
    }

    groundingExercise.classList.remove('hidden');

    groundingIntro.classList.remove('hidden');

    groundingSession.classList.add('hidden');

    groundingComplete.classList.add('hidden');

    groundingCurrentStep = 0;

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  });

}


// =========================================================
// UPDATE STEP
// =========================================================

function updateGroundingStep() {

  const step =
    groundingSteps[groundingCurrentStep];

  if (!step) return;


  groundingStep.textContent =
    `${groundingCurrentStep + 1} / ${groundingSteps.length}`;


  groundingNumber.textContent =
    step.number;


  groundingSense.innerHTML = `
    <span lang-el="vi">${step.senseVi}</span>
    <span lang-el="en">${step.senseEn}</span>
  `;


  groundingTitle.innerHTML = `
    <span lang-el="vi">${step.titleVi}</span>
    <span lang-el="en">${step.titleEn}</span>
  `;


  groundingInstruction.innerHTML = `
    <span lang-el="vi">${step.instructionVi}</span>
    <span lang-el="en">${step.instructionEn}</span>
  `;


  groundingProgressBar.style.width =
    `${(groundingCurrentStep / groundingSteps.length) * 100}%`;


  startGroundingTimer();

}


// =========================================================
// START TIMER
// =========================================================

function startGroundingTimer() {

  clearInterval(groundingTimerId);


  groundingEndTime =
    Date.now() + GROUNDING_STEP_DURATION;


  function updateTimer() {

    const remaining =
      Math.max(
        0,
        groundingEndTime - Date.now()
      );


    const totalSeconds =
      Math.ceil(remaining / 1000);


    const minutes =
      Math.floor(totalSeconds / 60);


    const seconds =
      totalSeconds % 60;


    groundingTimer.textContent =
      `${minutes}:${String(seconds).padStart(2, '0')}`;


    // =====================================================
    // TIME IS UP
    // =====================================================

    if (remaining <= 0) {

      clearInterval(groundingTimerId);


      groundingTimer.textContent =
        '0:00';


      // ---------------------------------------------------
      // LAST STEP
      // ---------------------------------------------------

      if (
        groundingCurrentStep >=
        groundingSteps.length - 1
      ) {

        finishGrounding();

        return;

      }


      // ---------------------------------------------------
      // NEXT STEP
      // ---------------------------------------------------

      groundingCurrentStep++;

      updateGroundingStep();

    }

  }


  updateTimer();


  groundingTimerId =
    setInterval(updateTimer, 250);

}


// =========================================================
// START ACTUAL EXERCISE
// =========================================================

if (groundingStart) {

  groundingStart.addEventListener('click', () => {

    clearInterval(groundingTimerId);


    groundingCurrentStep = 0;


    groundingIntro.classList.add('hidden');

    groundingComplete.classList.add('hidden');

    groundingSession.classList.remove('hidden');


    updateGroundingStep();


    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  });

}


// =========================================================
// COMPLETE EXERCISE
// =========================================================

function finishGrounding() {

  clearInterval(groundingTimerId);


  // -------------------------------------------------------
  // PLAY COMPLETION SOUND
  // -------------------------------------------------------

  groundingCompleteSound.currentTime = 0;

  groundingCompleteSound.play().catch(error => {

    console.log(
      'Completion sound could not play:',
      error
    );

  });


  // -------------------------------------------------------
  // SHOW COMPLETION PAGE
  // -------------------------------------------------------

  groundingSession.classList.add('hidden');

  groundingComplete.classList.remove('hidden');


  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });


  // -------------------------------------------------------
  // RETURN TO PRACTICE AFTER 3 SECONDS
  // -------------------------------------------------------

  clearTimeout(groundingReturnTimeout);


  groundingReturnTimeout =
    setTimeout(() => {

      groundingComplete.classList.add('hidden');

      groundingExercise.classList.add('hidden');


      if (practicePage) {
        practicePage.classList.remove('hidden');
      }


      groundingCurrentStep = 0;


      groundingIntro.classList.remove('hidden');


      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });


    }, 3000);

}


// =========================================================
// EXIT EXERCISE
// =========================================================

if (groundingExit) {

  groundingExit.addEventListener('click', () => {

    clearInterval(groundingTimerId);

    clearTimeout(groundingReturnTimeout);


    groundingCurrentStep = 0;


    groundingExercise.classList.add('hidden');

    groundingSession.classList.add('hidden');

    groundingComplete.classList.add('hidden');

    groundingIntro.classList.remove('hidden');


    if (practicePage) {
      practicePage.classList.remove('hidden');
    }


    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  });

}


// =========================================================
// RESTART
// =========================================================

if (groundingRestart) {

  groundingRestart.addEventListener('click', () => {

    clearInterval(groundingTimerId);

    clearTimeout(groundingReturnTimeout);


    groundingCurrentStep = 0;


    groundingComplete.classList.add('hidden');

    groundingIntro.classList.remove('hidden');

    groundingSession.classList.add('hidden');


    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  });

}