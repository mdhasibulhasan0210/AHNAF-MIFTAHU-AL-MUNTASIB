/* =========================================================
   AHNAF MIFTAHU AL MUNTASIB — interactions + Three.js
   Interactive multi-color particle-wave background.
   ========================================================= */
(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(max-width: 900px)").matches;

  /* ------------------------------------------------------------------
     1. THREE.JS  —  interactive color particle wave
        A grid of points rippling on a sine field, drifting with the
        mouse. Particles are tinted across a warm-to-cool palette
        (amber · coral · violet · teal) that shifts with the crests.
  ------------------------------------------------------------------ */
  function initThree() {
    if (!window.THREE) return;
    const canvas = document.getElementById("bg-canvas");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0810, 0.05);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 4.2, 14);
    camera.lookAt(0, 0, 0);

    // --- build the point grid ---
    const COLS = isTouch ? 60 : 110;
    const ROWS = isTouch ? 60 : 110;
    const SPAN = 34;
    const count = COLS * ROWS;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const base = new Float32Array(count * 2); // x,z home for each point

    // rich palette — points sample across these hues
    const palette = [
      new THREE.Color(0xffb347), // amber
      new THREE.Color(0xff6a88), // coral
      new THREE.Color(0x8a6cff), // violet
      new THREE.Color(0x3ad6c5), // teal
      new THREE.Color(0xf5f2ee), // ink (sparse highlights)
    ];

    let i = 0;
    for (let x = 0; x < COLS; x++) {
      for (let z = 0; z < ROWS; z++) {
        const px = (x / (COLS - 1) - 0.5) * SPAN;
        const pz = (z / (ROWS - 1) - 0.5) * SPAN;
        positions[i * 3] = px;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = pz;
        base[i * 2] = px;
        base[i * 2 + 1] = pz;

        // pick a hue by distance so color forms concentric bands,
        // with a scattered few pushed to bright ink highlights
        const d = Math.sqrt(px * px + pz * pz);
        let c;
        if (Math.random() > 0.92) {
          c = palette[4];
        } else {
          const band = Math.floor((d * 0.14 + x * 0.03 + z * 0.02)) % 4;
          c = palette[band];
        }
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
        i++;
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // soft round sprite so points aren't hard squares
    const sprite = (function () {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d");
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.4, "rgba(255,255,255,0.6)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c);
      return t;
    })();

    const mat = new THREE.PointsMaterial({
      size: isTouch ? 0.17 : 0.14,
      map: sprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geom, mat);
    scene.add(points);

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
      const t = clock.getElapsedTime();

      // ripple the height field
      for (let k = 0; k < count; k++) {
        const bx = base[k * 2];
        const bz = base[k * 2 + 1];
        const d = Math.sqrt(bx * bx + bz * bz);
        const y =
          Math.sin(d * 0.5 - t * 1.1) * 0.9 * Math.exp(-d * 0.05) +
          Math.sin(bx * 0.32 + t * 0.7) * 0.35 +
          Math.cos(bz * 0.3 - t * 0.6) * 0.35;
        posAttr.array[k * 3 + 1] = y;
      }
      posAttr.needsUpdate = true;

      // ease pointer + gentle auto-drift
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      points.rotation.y = mouse.x * 0.5 + t * 0.02;
      camera.position.x = mouse.x * 5;
      camera.position.y = 4.2 - mouse.y * 2.5 - scrollY * 0.002;
      camera.lookAt(0, 0, 0);

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
