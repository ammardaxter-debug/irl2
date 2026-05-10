// ==========================================
//  IRL Login Page — Client-Side Logic
// ==========================================

(function() {
  'use strict';

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const loginBtn = document.getElementById('login-btn');
  const btnText = document.getElementById('btn-text');
  const btnSpinner = document.getElementById('btn-spinner');
  const card = document.getElementById('login-card');
  const errorMsg = document.getElementById('error-msg');
  const errorText = document.getElementById('error-text');
  const togglePwd = document.getElementById('toggle-pwd');
  const eyeOpen = document.getElementById('eye-open');
  const eyeClosed = document.getElementById('eye-closed');
  const lockoutOverlay = document.getElementById('lockout-overlay');
  const lockoutTimer = document.getElementById('lockout-timer');
  const lockoutBar = document.getElementById('lockout-bar');

  // Check if already logged in
  (async function checkSession() {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          window.location.href = '/';
          return;
        }
      }
    } catch(e) {}
  })();

  // Password toggle
  togglePwd.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    eyeOpen.style.display = isPassword ? 'none' : 'block';
    eyeClosed.style.display = isPassword ? 'block' : 'none';
  });

  // Clear errors on input
  emailInput.addEventListener('input', clearError);
  passwordInput.addEventListener('input', clearError);

  function clearError() {
    errorMsg.style.display = 'none';
    document.getElementById('email-group').classList.remove('error');
    document.getElementById('password-group').classList.remove('error');
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorMsg.style.display = 'flex';
    card.classList.add('shake');
    document.getElementById('email-group').classList.add('error');
    document.getElementById('password-group').classList.add('error');
    setTimeout(() => card.classList.remove('shake'), 500);
  }

  function setLoading(loading) {
    loginBtn.disabled = loading;
    btnText.style.display = loading ? 'none' : 'inline';
    btnSpinner.style.display = loading ? 'flex' : 'none';
  }

  // Lockout countdown
  function showLockout(secondsRemaining) {
    lockoutOverlay.style.display = 'flex';
    const totalSeconds = 15 * 60; // 15 minutes

    const interval = setInterval(() => {
      secondsRemaining--;
      if (secondsRemaining <= 0) {
        clearInterval(interval);
        lockoutOverlay.style.display = 'none';
        return;
      }
      const mins = Math.floor(secondsRemaining / 60);
      const secs = secondsRemaining % 60;
      lockoutTimer.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
      lockoutBar.style.width = `${(secondsRemaining / totalSeconds) * 100}%`;
    }, 1000);
  }

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        setLoading(false);

        if (res.status === 429 && data.lockout_seconds) {
          showLockout(data.lockout_seconds);
          return;
        }

        const attempts = data.remaining_attempts;
        let msg = data.error || 'Invalid credentials';
        if (attempts !== undefined && attempts > 0) {
          msg += ` (${attempts} attempt${attempts !== 1 ? 's' : ''} remaining)`;
        }
        showError(msg);
        return;
      }

      // Success! Smooth transition
      card.classList.add('success');
      setTimeout(() => {
        window.location.href = data.redirect || '/';
      }, 700);

    } catch (err) {
      setLoading(false);
      showError('Network error. Please check your connection.');
    }
  });
})();
