/* =========================================================
   AHNAF MIFTAHU AL MUNTASIB — interactions + Three.js
   Interactive 3D color particle FOUNTAIN background.
   ========================================================= */
(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(max-width: 900px)").matches;

  /* ------------------------------------------------------------------
     1. THREE.JS  —  3D particle fountain
        Thousands of points erupt from a central jet, arc under gravity
        and fall back into a glowing pool. Tinted across a warm-to-cool
        palette (amber · coral · violet · teal). Drifts with the mouse.
  ------------------------------------------------------------------ */
  function initThree() {
    if (!window.THREE) return;
    const canvas = document.getElementById("bg-canvas");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0810, 0.045);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 4.5, 15);
    camera.lookAt(0, 3, 0);

    // --- palette ---
    const palette = [
      new THREE.Color(0xffb347), // amber
      new THREE.Color(0xff6a88), // coral
      new THREE.Color(0x8a6cff), // violet
      new THREE.Color(0x3ad6c5), // teal
      new THREE.Color(0xf5f2ee), // ink highlight
    ];

    // --- particle buffers ---
    const N = isTouch ? 1100 : 2400;
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const vel = new Float32Array(N * 3); // velocity per particle
    const life = new Float32Array(N);    // seconds alive
    const maxLife = new Float32Array(N);

    const GRAV = -11.0;
    const GROUND = 0;

    // launch a particle from the jet at the origin
    function spawn(k, prewarm) {
      positions[k * 3] = (Math.random() - 0.5) * 0.4;
      positions[k * 3 + 1] = 0.1;
      positions[k * 3 + 2] = (Math.random() - 0.5) * 0.4;

      const angle = Math.random() * Math.PI * 2;
      const spread = Math.pow(Math.random(), 0.7) * 2.6; // outward speed
      const up = 6.5 + Math.random() * 4.0;              // upward speed
      vel[k * 3] = Math.cos(angle) * spread;
      vel[k * 3 + 1] = up;
      vel[k * 3 + 2] = Math.sin(angle) * spread;

      life[k] = prewarm ? Math.random() * 1.8 : 0;
      maxLife[k] = 1.6 + Math.random() * 1.2;

      // warm hues at the base, cooler picks toward the crest
      const c = up > 9 ? palette[2 + Math.floor(Math.random() * 3)]
                       : palette[Math.floor(Math.random() * 5)];
      colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
    }
    for (let k = 0; k < N; k++) spawn(k, true);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // soft round sprite so points glow instead of being hard squares
    const sprite = (function () {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d");
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.35, "rgba(255,255,255,0.65)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();

    const mat = new THREE.PointsMaterial({
      size: isTouch ? 0.22 : 0.17,
      map: sprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const fountain = new THREE.Points(geom, mat);
    scene.add(fountain);

    // faint glowing pool disc at the base
    const poolGeo = new THREE.RingGeometry(0.15, 5.5, 64);
    const poolMat = new THREE.MeshBasicMaterial({
      color: 0x8a6cff, transparent: true, opacity: 0.06,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.02;
    scene.add(pool);

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

    function animate() {
      const dt = Math.min(clock.getDelta(), 0.033);
      const t = clock.getElapsedTime();

      // integrate the fountain
      for (let k = 0; k < N; k++) {
        life[k] += dt;
        vel[k * 3 + 1] += GRAV * dt;
        positions[k * 3]     += vel[k * 3]     * dt;
        positions[k * 3 + 1] += vel[k * 3 + 1] * dt;
        positions[k * 3 + 2] += vel[k * 3 + 2] * dt;

        // recycle when it falls back to the pool or its life runs out
        if (positions[k * 3 + 1] <= GROUND && vel[k * 3 + 1] < 0) spawn(k, false);
        else if (life[k] > maxLife[k]) spawn(k, false);
      }
      posAttr.needsUpdate = true;

      // pool shimmer
      pool.material.opacity = 0.05 + Math.sin(t * 1.6) * 0.02;

      // ease pointer + gentle auto-rotate for the 3D read
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      fountain.rotation.y = mouse.x * 0.6 + t * 0.12;
      pool.rotation.z = t * 0.05;
      camera.position.x = mouse.x * 5;
      camera.position.y = 4.5 - mouse.y * 2.2 - scrollY * 0.0016;
      camera.lookAt(0, 3, 0);

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
