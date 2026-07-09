/* =========================================================
   AHNAF MIFTAHU AL MUNTASIB — interactions + Three.js
   Interactive 3D color particle FOUNTAIN background.
   ========================================================= */
(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(max-width: 900px)").matches;

  /* ------------------------------------------------------------------
     1. THREE.JS  —  rolling ocean tide (Gerstner waves)
        A field of glowing points forms a real ocean surface: several
        Gerstner waves sum into sharp warm-foam crests over deep
        periwinkle water, rolling toward the camera like an incoming
        tide. Reacts to mouse + scroll.
  ------------------------------------------------------------------ */
  function initThree() {
    if (!window.THREE) return;
    const canvas = document.getElementById("bg-canvas");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050506, 0.03);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 130);
    camera.position.set(0, 7, 20);
    camera.lookAt(0, -1.5, -8);

    // --- grid of surface points ---
    const COLS = isTouch ? 74 : 122;
    const ROWS = isTouch ? 74 : 122;
    const SPAN = 52;
    const count = COLS * ROWS;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const base = new Float32Array(count * 2); // home x,z

    let i = 0;
    for (let x = 0; x < COLS; x++) {
      for (let z = 0; z < ROWS; z++) {
        const px = (x / (COLS - 1) - 0.5) * SPAN;
        const pz = (z / (ROWS - 1) - 0.5) * SPAN - 6; // push field toward horizon
        base[i * 2] = px;
        base[i * 2 + 1] = pz;
        positions[i * 3] = px;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = pz;
        i++;
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // --- Gerstner wave set (direction, wavelength, amplitude, steepness) ---
    function makeWave(dx, dz, L, A, Q) {
      const len = Math.hypot(dx, dz) || 1;
      const k = (2 * Math.PI) / L;
      const speed = Math.sqrt(9.8 / k) * 0.34; // phase speed, tuned
      return { dx: dx / len, dz: dz / len, k, A, Q, w: speed * k };
    }
    const waves = [
      makeWave(0.2, 1.0, 22, 2.1, 0.82),  // massive tidal swell rolling in
      makeWave(0.55, 0.85, 12, 1.15, 0.72),
      makeWave(-0.4, 0.95, 7, 0.6, 0.6),
      makeWave(0.15, 1.0, 4.2, 0.32, 0.5),
      makeWave(-0.6, 0.7, 2.6, 0.16, 0.42), // fine chop on the crests
    ];
    let totalA = 0;
    for (const wv of waves) totalA += wv.A;

    // near-black water -> white foam (raw channels for speed)
    const deep = { r: 0.09, g: 0.10, b: 0.12 }; // deep dark sea
    const foam = { r: 1.0, g: 1.0, b: 1.0 };     // white crest foam

    // soft round sprite so points glow instead of being hard squares
    const sprite = (function () {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d");
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.35, "rgba(255,255,255,0.6)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();

    const mat = new THREE.PointsMaterial({
      size: isTouch ? 0.22 : 0.16,
      map: sprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const ocean = new THREE.Points(geom, mat);
    scene.add(ocean);

    // --- pointer parallax ---
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener("pointermove", (e) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5);
      mouse.ty = (e.clientY / window.innerHeight - 0.5);
    });

    let scrollY = 0;
    window.addEventListener("scroll", () => { scrollY = window.scrollY; }, { passive: true });

    const clock = new THREE.Clock();
    const posAttr = geom.attributes.position;
    const colAttr = geom.attributes.color;

    function animate() {
      const t = clock.getElapsedTime();

      // sum the Gerstner waves into a rolling tide
      for (let k = 0; k < count; k++) {
        const bx = base[k * 2];
        const bz = base[k * 2 + 1];
        let px = bx, pz = bz, py = 0;

        for (let wi = 0; wi < waves.length; wi++) {
          const wv = waves[wi];
          const phase = wv.k * (wv.dx * bx + wv.dz * bz) - wv.w * t;
          const cosf = Math.cos(phase);
          const sinf = Math.sin(phase);
          const qa = wv.Q * wv.A;
          px += qa * wv.dx * cosf;
          pz += qa * wv.dz * cosf;
          py += wv.A * sinf;
        }

        posAttr.array[k * 3] = px;
        posAttr.array[k * 3 + 1] = py;
        posAttr.array[k * 3 + 2] = pz;

        // color by crest height: deep water -> warm foam
        let h = (py + totalA) / (2 * totalA); // 0..1
        h = h < 0 ? 0 : h > 1 ? 1 : h;
        const f = h * h * h * h; // sharpen so only crest tips foam white
        colAttr.array[k * 3]     = deep.r + (foam.r - deep.r) * f;
        colAttr.array[k * 3 + 1] = deep.g + (foam.g - deep.g) * f;
        colAttr.array[k * 3 + 2] = deep.b + (foam.b - deep.b) * f;
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;

      // ease pointer drift
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      camera.position.x = mouse.x * 5;
      camera.position.y = 7 - mouse.y * 2.4 - scrollY * 0.0016;
      camera.lookAt(mouse.x * 1.5, -1.5, -8);

      renderer.render(scene, camera);
      if (!prefersReduced) requestAnimationFrame(animate);
    }
    animate();
    if (prefersReduced) renderer.render(scene, camera);

    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /* ------------------------------------------------------------------
     2. PRELOADER
  ------------------------------------------------------------------ */
  function initPreloader() {
    const pre = document.querySelector("[data-preloader]");
    const bar = document.querySelector("[data-preloader-bar]");
    const countEl = document.querySelector("[data-preloader-count]");
    if (!pre) return;
    let p = 0;
    const tick = () => {
      p += Math.random() * 12 + 4;
      if (p >= 100) p = 100;
      bar.style.width = p + "%";
      countEl.textContent = Math.floor(p);
      if (p < 100) {
        setTimeout(tick, 120);
      } else {
        setTimeout(() => {
          pre.classList.add("is-done");
          document.body.classList.add("loaded");
        }, 400);
      }
    };
    setTimeout(tick, 300);
  }

  /* ------------------------------------------------------------------
     3. CUSTOM CURSOR + magnetic buttons
  ------------------------------------------------------------------ */
  function initCursor() {
    if (isTouch) return;
    const ring = document.querySelector("[data-cursor]");
    const dot = document.querySelector("[data-cursor-dot]");
    if (!ring) return;
    let mx = 0, my = 0, rx = 0, ry = 0;
    window.addEventListener("pointermove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    });
    (function loop() {
      rx += (mx - rx) * 0.15;
      ry += (my - ry) * 0.15;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    })();

    const hoverables = document.querySelectorAll("a, button, [data-lightbox], [data-magnetic]");
    hoverables.forEach((el) => {
      el.addEventListener("mouseenter", () => ring.classList.add("is-hover"));
      el.addEventListener("mouseleave", () => ring.classList.remove("is-hover"));
    });

    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  /* ------------------------------------------------------------------
     4. SCROLL REVEAL + counters
  ------------------------------------------------------------------ */
  function initReveal() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          if (en.target.hasAttribute("data-count")) countUp(en.target);
          const counters = en.target.querySelectorAll("[data-count]");
          counters.forEach(countUp);
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.18 });

    document.querySelectorAll("[data-reveal], [data-reveal-lines]").forEach((el) => io.observe(el));
  }

  function countUp(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = "1";
    const target = parseInt(el.dataset.count, 10) || 0;
    const pad = el.dataset.count.length;
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 40));
    const tick = () => {
      cur = Math.min(target, cur + step);
      el.textContent = String(cur).padStart(pad, "0");
      if (cur < target) requestAnimationFrame(tick);
    };
    tick();
  }

  /* ------------------------------------------------------------------
     5. MOBILE NAV
  ------------------------------------------------------------------ */
  function initNav() {
    const nav = document.querySelector("[data-nav]");
    const toggle = document.querySelector("[data-menu-toggle]");
    const menu = document.querySelector("[data-menu]");
    if (!toggle) return;
    const close = () => { nav.classList.remove("is-open"); menu.classList.remove("is-open"); };
    toggle.addEventListener("click", () => {
      nav.classList.toggle("is-open");
      menu.classList.toggle("is-open");
    });
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
  }

  /* ------------------------------------------------------------------
     6. LIGHTBOX
  ------------------------------------------------------------------ */
  function initLightbox() {
    const items = Array.from(document.querySelectorAll("[data-lightbox]"));
    const lb = document.querySelector("[data-lb]");
    if (!lb || !items.length) return;
    const img = lb.querySelector("[data-lb-img]");
    const cap = lb.querySelector("[data-lb-caption]");
    const btnClose = lb.querySelector("[data-lb-close]");
    const btnPrev = lb.querySelector("[data-lb-prev]");
    const btnNext = lb.querySelector("[data-lb-next]");
    let idx = 0;

    const render = () => {
      const el = items[idx];
      const src = el.getAttribute("data-lightbox");
      const fig = el.querySelector("figcaption");
      img.src = src;
      cap.textContent = fig ? fig.textContent.replace(/\s+/g, " ").trim() : "";
    };
    const open = (i) => {
      idx = i;
      render();
      lb.hidden = false;
      requestAnimationFrame(() => lb.classList.add("is-open"));
      document.body.style.overflow = "hidden";
    };
    const close = () => {
      lb.classList.remove("is-open");
      document.body.style.overflow = "";
      setTimeout(() => { lb.hidden = true; }, 500);
    };
    const go = (dir) => { idx = (idx + dir + items.length) % items.length; render(); };

    items.forEach((el, i) => el.addEventListener("click", () => open(i)));
    btnClose.addEventListener("click", close);
    btnPrev.addEventListener("click", () => go(-1));
    btnNext.addEventListener("click", () => go(1));
    lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
    window.addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    });
  }

  /* ------------------------------------------------------------------
     boot
  ------------------------------------------------------------------ */
  window.addEventListener("DOMContentLoaded", () => {
    initThree();
    initPreloader();
    initCursor();
    initReveal();
    initNav();
    initLightbox();
  });
})();
