(() => {
  'use strict';
  const client = window.nabdSupabase;
  const form = document.querySelector('#authForm');
  const fields = document.querySelector('#signupFields');
  const title = document.querySelector('#authTitle');
  const subtitle = document.querySelector('#authSubtitle');
  const submit = document.querySelector('#authSubmit');
  const message = document.querySelector('#authMessage');
  const toggle = document.querySelector('#authModeToggle');
  const switchText = document.querySelector('#authSwitchText');
  let signupMode = true;

  const setMessage = (text, success = false) => { message.textContent = text; message.className = `auth-message${success ? ' success' : ''}`; };
  const setMode = mode => {
    signupMode = mode;
    fields.hidden = !signupMode;
    fields.querySelectorAll('input,select').forEach(input => { input.required = signupMode; });
    title.textContent = signupMode ? 'إنشاء حساب الطالب' : 'تسجيل الدخول';
    subtitle.textContent = signupMode ? 'ابدأ بإنشاء حسابك ثم أكمل بياناتك الدراسية.' : 'أدخل بريدك الإلكتروني وكلمة السر للوصول إلى ملفك.';
    submit.innerHTML = signupMode ? '<i class="fa-solid fa-user-plus"></i> إنشاء الحساب' : '<i class="fa-solid fa-right-to-bracket"></i> تسجيل الدخول';
    switchText.textContent = signupMode ? 'لديك حساب بالفعل؟' : 'ليس لديك حساب؟';
    toggle.textContent = signupMode ? 'تسجيل الدخول' : 'إنشاء حساب جديد';
    setMessage('');
  };
  toggle.addEventListener('click', () => setMode(!signupMode));
  form.addEventListener('submit', async event => {
    event.preventDefault(); setMessage(''); submit.disabled = true;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      if (signupMode) {
        const { data: result, error } = await client.auth.signUp({ email: data.email.trim(), password: data.password, options: { data: { first_name: data.first_name.trim(), father_name: data.father_name.trim(), family_name: data.family_name.trim(), study_stage: data.study_stage } } });
        if (error) throw error;
        if (!result.session) { setMessage('تم إنشاء الحساب. تحقق من بريدك الإلكتروني ثم سجّل الدخول.', true); setMode(false); form.email.value = data.email; return; }
        await saveProfile(result.user, data);
        window.location.replace('index.html');
      } else {
        const { data: result, error } = await client.auth.signInWithPassword({ email: data.email.trim(), password: data.password });
        if (error) throw error;
        if (result.user) window.location.replace('index.html');
      }
    } catch (error) { setMessage(error.message || 'تعذر إتمام العملية. تحقق من البيانات وحاول مرة أخرى.'); }
    finally { submit.disabled = false; }
  });
  async function saveProfile(user, data) {
    const profile = { user_id: user.id, first_name: data.first_name.trim(), father_name: data.father_name.trim(), family_name: data.family_name.trim(), study_stage: data.study_stage, email: user.email };
    const { error } = await client.from('student_profiles').upsert(profile, { onConflict: 'user_id' });
    if (error) throw error;
  }
  client.auth.getSession().then(({ data }) => { if (data.session) window.location.replace('index.html'); });
})();
