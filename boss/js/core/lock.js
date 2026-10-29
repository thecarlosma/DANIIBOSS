/* DANI BOSS — bloqueo con Face ID / Touch ID (WebAuthn, autenticador del propio dispositivo).
   Es un candado de la interfaz en este dispositivo; los datos en la nube siguen protegidos por el login y RLS. */
(function (root) {
  const DOS = (root.DOS = root.DOS || {});
  const KEY = 'danios.lock';
  const RELOCK_MS = 60 * 1000;

  const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
  const isApple = /iPhone|iPad|Macintosh/.test(navigator.userAgent);
  const isIOS = /iPhone|iPad/.test(navigator.userAgent);
  const bioName = () => (isIOS ? 'Face ID' : isApple ? 'Touch ID' : 'tu huella');

  let overlay = null;
  let hiddenAt = 0;
  let pending = null;

  async function verify(id) {
    const cred = await navigator.credentials.get({ publicKey: {
      challenge: rand(32),
      allowCredentials: [{ type: 'public-key', id: unb64u(id), transports: ['internal', 'hybrid'] }],
      userVerification: 'required',
      timeout: 60000,
    } });
    // Bit UV de authenticatorData: confirma que se usó biometría/código, no solo presencia
    const flags = new Uint8Array(cred.response.authenticatorData)[32];
    if (!(flags & 0x04)) throw new Error('No se verificó tu identidad.');
    return true;
  }

  function show() {
    if (overlay) return pending;
    pending = new Promise((resolve) => {
      overlay = document.createElement('div');
      overlay.className = 'lock-screen';
      overlay.innerHTML = `
        <div class="lock-box">
          <img src="assets/avatar.png" alt="" class="lock-avatar">
          <h2>DANI BOSS</h2>
          <p class="muted">Bloqueado. Usa ${bioName()} para entrar.</p>
          <button class="btn btn-primary" data-lock-go>${DOS.icon ? DOS.icon('shield') : ''}Desbloquear con ${bioName()}</button>
          <p class="lock-msg" data-lock-msg></p>
          <form data-lock-pass hidden>
            <input type="password" class="input" placeholder="Contraseña de tu cuenta" autocomplete="current-password" required>
            <button class="btn btn-secondary" type="submit">Entrar con contraseña</button>
          </form>
          <button class="btn btn-ghost lock-alt" data-lock-alt>Usar la contraseña de la cuenta</button>
        </div>`;
      document.body.appendChild(overlay);
      document.documentElement.classList.add('is-locked');
      const msg = overlay.querySelector('[data-lock-msg]');
      const done = () => {
        overlay.remove(); overlay = null; pending = null;
        document.documentElement.classList.remove('is-locked', 'is-veiled');
        resolve();
      };
      const go = async (auto) => {
        msg.textContent = '';
        try { await verify(read().id); done(); }
        catch (e) { if (!auto) msg.textContent = e.name === 'NotAllowedError' ? 'Cancelado. Inténtalo de nuevo.' : (e.message || 'No se pudo verificar.'); }
      };
      overlay.querySelector('[data-lock-go]').addEventListener('click', () => go(false));
      overlay.querySelector('[data-lock-alt]').addEventListener('click', (e) => { e.target.hidden = true; const f = overlay.querySelector('[data-lock-pass]'); f.hidden = false; f.querySelector('input').focus(); });
      overlay.querySelector('[data-lock-pass]').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = e.target.querySelector('input').value;
        msg.textContent = 'Comprobando…';
        try {
          const c = DOS.cloud;
          if (!c || !c.enabled()) throw new Error('Sin cuenta en la nube: usa ' + bioName() + '.');
          if (!c.client) c.init();
          const { data } = await c.client.auth.getSession();
          const email = data.session && data.session.user.email;
          if (!email) throw new Error('No hay sesión guardada.');
          const { error } = await c.client.auth.signInWithPassword({ email, password });
          if (error) throw new Error('Contraseña incorrecta.');
          done();
        } catch (err) { msg.textContent = err.message; }
      });
      // Safari suele exigir un toque; en Chrome/Mac lanza Touch ID directamente
      if (!isIOS) go(true);
    });
    return pending;
  }

  const lock = {
    bioName,
    enabled: () => !!(read() && read().id),
    async available() {
      try { return !!(root.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
      catch (e) { return false; }
    },
    async enable() {
      const cred = await navigator.credentials.create({ publicKey: {
        rp: { name: 'DANI BOSS' },
        user: { id: rand(16), name: 'DANI BOSS', displayName: 'DANI BOSS' },
        challenge: rand(32),
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60000,
      } });
      localStorage.setItem(KEY, JSON.stringify({ id: b64u(cred.rawId), created: new Date().toISOString() }));
    },
    async disable() {
      await verify(read().id);
      localStorage.removeItem(KEY);
    },
    gate() { return lock.enabled() ? show() : Promise.resolve(); },
  };

  // Al salir de la app se oculta el contenido (vista de multitarea) y, tras 1 minuto fuera, se vuelve a bloquear
  document.addEventListener('visibilitychange', () => {
    if (!lock.enabled()) return;
    if (document.hidden) { hiddenAt = Date.now(); document.documentElement.classList.add('is-veiled'); return; }
    if (hiddenAt && Date.now() - hiddenAt > RELOCK_MS) show();
    else document.documentElement.classList.remove('is-veiled');
  });

  DOS.lock = lock;
})(window);
