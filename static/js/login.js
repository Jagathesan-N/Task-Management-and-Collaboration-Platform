/* ===================================================
   login.js  –  UI logic for the login page
   Place at: static/js/login.js
=================================================== */

/* ── Password visibility toggle ── */
const togglePw = document.getElementById('togglePw');
const pwInput  = document.getElementById('id_password');

togglePw.addEventListener('click', () => {
    const isText = pwInput.type === 'text';
    pwInput.type = isText ? 'password' : 'text';
    togglePw.querySelector('i').className = isText
        ? 'fa-regular fa-eye'
        : 'fa-regular fa-eye-slash';
});