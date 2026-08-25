(() => {
  'use strict';

  window.nabdNativeReady?.();
  const client = window.nabdSupabase;
  const form = document.querySelector('#authForm');
  const signupFields = document.querySelector('#signupFields');
  const loginFields = document.querySelector('#loginFields');
  const steps = [...document.querySelectorAll('[data-auth-step]')];
  const title = document.querySelector('#authTitle');
  const subtitle = document.querySelector('#authSubtitle');
  const kicker = document.querySelector('#authKicker');
  const progress = document.querySelector('#authProgress');
  const progressLabel = document.querySelector('#authStepLabel');
  const progressValue = document.querySelector('#authProgressValue');
  const progressBar = document.querySelector('#authProgressBar');
  const back = document.querySelector('#authBack');
  const next = document.querySelector('#authNext');
  const submit = document.querySelector('#authSubmit');
  const message = document.querySelector('#authMessage');
  const toggle = document.querySelector('#authModeToggle');
  const switchText = document.querySelector('#authSwitchText');
  let signupMode = true;
  let currentStep = 0;

  const signupCopy = [
    { title: 'أنشئ حسابك', subtitle: 'ابدأ بمعلوماتك الأساسية، وأكمل حسابك بخطوات قصيرة.' },
    { title: 'حسابك أصبح أقرب', subtitle: 'أخبرنا عن دراستك لنرتب لك تجربة تناسب مرحلتك.' },
    { title: 'خطوتك الأخيرة', subtitle: 'أنشئ بيانات الدخول وابدأ رحلتك مع نبض التفوق.' }
  ];

  const setMessage = (text, success = false) => {
    message.textContent = text;
    message.className = `auth-message${success ? ' success' : ''}`;
  };

  const friendlyError = error => {
    const raw = String(error?.message || '').trim();
    const normalized = raw.toLowerCase();
    if (/invalid login credentials|invalid credentials/.test(normalized)) return 'البريد الإلكتروني أو كلمة السر غير صحيحة.';
    if (/user already registered|already been registered/.test(normalized)) return 'هذا البريد مسجل مسبقًا. جرّب تسجيل الدخول.';
    if (/password.*(6|characters)|at least/.test(normalized)) return 'يجب أن تتكون كلمة السر من 6 محارف على الأقل.';
    if (/email/.test(normalized) && /valid|invalid/.test(normalized)) return 'أدخل بريدًا إلكترونيًا صحيحًا.';
    if (/failed to fetch|network|fetch/.test(normalized)) return 'تعذر الاتصال حاليًا. تحقق من الإنترنت وحاول مرة أخرى.';
    return raw || 'تعذر إتمام العملية. تحقق من البيانات وحاول مرة أخرى.';
  };

  const activeStepInputs = () => steps[currentStep]?.querySelectorAll('input, select') || [];
  const updateProgress = () => {
    const percent = Math.round(((currentStep + 1) / steps.length) * 100);
    progressLabel.textContent = `الخطوة ${currentStep + 1} من ${steps.length}`;
    progressValue.textContent = `${percent}%`;
    progressBar.style.width = `${percent}%`;
  };

  const showStep = (stepIndex, direction = 'forward') => {
    currentStep = Math.max(0, Math.min(stepIndex, steps.length - 1));
    steps.forEach((step, index) => {
      const active = index === currentStep;
      step.hidden = !active;
      step.classList.toggle('is-active', active);
      if (active) {
        step.dataset.transition = direction;
        window.setTimeout(() => step.querySelector('input, select')?.focus(), 80);
      }
    });
    const copy = signupCopy[currentStep];
    title.textContent = copy.title;
    subtitle.textContent = copy.subtitle;
    updateProgress();
    back.hidden = currentStep === 0;
    next.hidden = currentStep === steps.length - 1;
    submit.hidden = currentStep !== steps.length - 1;
  };

  const validateCurrentStep = () => {
    for (const input of activeStepInputs()) {
      if (!input.checkValidity()) {
        input.reportValidity();
        setMessage(input.validationMessage || 'أكمل الحقلين قبل المتابعة.');
        return false;
      }
    }
    setMessage('');
    return true;
  };

  const setMode = mode => {
    signupMode = mode;
    currentStep = 0;
    signupFields.hidden = !signupMode;
    loginFields.hidden = signupMode;
    progress.hidden = !signupMode;
    steps.forEach(step => step.hidden = !signupMode || step.dataset.authStep !== '0');
    signupFields.querySelectorAll('input,select').forEach(input => {
      input.required = signupMode;
      input.disabled = !signupMode;
    });
    loginFields.querySelectorAll('input').forEach(input => {
      input.required = !signupMode;
      input.disabled = signupMode;
    });
    kicker.textContent = signupMode ? 'إنشاء حساب جديد' : 'تسجيل الدخول';
    title.textContent = signupMode ? signupCopy[0].title : 'مرحبًا بعودتك';
    subtitle.textContent = signupMode ? signupCopy[0].subtitle : 'أدخل بياناتك للوصول إلى مساحتك الدراسية.';
    switchText.textContent = signupMode ? 'لديك حساب بالفعل؟' : 'ليس لديك حساب؟';
    toggle.textContent = signupMode ? 'تسجيل الدخول' : 'إنشاء حساب جديد';
    submit.innerHTML = signupMode ? '<i class="fa-solid fa-user-plus"></i><span>إنشاء الحساب</span>' : '<i class="fa-solid fa-right-to-bracket"></i><span>تسجيل الدخول</span>';
    next.hidden = !signupMode;
    submit.hidden = signupMode;
    back.hidden = true;
    setMessage('');
    if (signupMode) showStep(0, 'forward');
  };

  toggle?.addEventListener('click', () => setMode(!signupMode));
  next?.addEventListener('click', () => {
    if (!validateCurrentStep()) return;
    showStep(currentStep + 1, 'forward');
  });
  back?.addEventListener('click', () => showStep(currentStep - 1, 'back'));

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (signupMode && currentStep < steps.length - 1) {
      if (validateCurrentStep()) showStep(currentStep + 1, 'forward');
      return;
    }
    if (!client) { setMessage('تعذر الاتصال بخدمة الحسابات حاليًا.'); return; }
    if (signupMode && !validateCurrentStep()) return;
    const data = signupMode ? {
      first_name: form.elements.signup_first_name.value.trim(),
      father_name: form.elements.signup_father_name.value.trim(),
      family_name: form.elements.signup_family_name.value.trim(),
      study_stage: form.elements.signup_study_stage.value,
      email: form.elements.signup_email.value.trim(),
      password: form.elements.signup_password.value
    } : {
      email: form.elements.login_email.value.trim(),
      password: form.elements.login_password.value
    };
    setMessage('');
    const activeButton = submit;
    activeButton.disabled = true;
    activeButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>جارٍ التحقق...</span>';
    try {
      if (signupMode) {
        const { data: result, error } = await client.auth.signUp({ email: data.email, password: data.password, options: { data: { first_name: data.first_name, father_name: data.father_name, family_name: data.family_name, study_stage: data.study_stage } } });
        if (error) throw error;
        if (!result.session) {
          setMessage('تم إنشاء الحساب. تحقق من بريدك إن طُلب ذلك، ثم سجّل الدخول.', true);
          setMode(false);
          form.elements.login_email.value = data.email;
          return;
        }
        await saveProfile(result.user, data);
        window.location.replace('index.html');
      } else {
        const { data: result, error } = await client.auth.signInWithPassword({ email: data.email, password: data.password });
        if (error) throw error;
        if (result.user) window.location.replace('index.html');
      }
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      activeButton.disabled = false;
      activeButton.innerHTML = signupMode ? '<i class="fa-solid fa-user-plus"></i><span>إنشاء الحساب</span>' : '<i class="fa-solid fa-right-to-bracket"></i><span>تسجيل الدخول</span>';
    }
  });

  async function saveProfile(user, data) {
    const profile = { user_id: user.id, first_name: data.first_name, father_name: data.father_name, family_name: data.family_name, study_stage: data.study_stage, email: user.email };
    const { error } = await client.from('student_profiles').upsert(profile, { onConflict: 'user_id' });
    if (error) throw error;
  }

  if (client?.auth?.getSession) {
    client.auth.getSession().then(({ data }) => { if (data.session) window.location.replace('index.html'); }).catch(() => {});
  }
  setMode(true);
  window.setTimeout(() => window.nabdNativeReady?.(), 700);
})();
