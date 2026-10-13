(function () {
  var STYLE = [
    "#rita-subir{position:fixed;right:22px;bottom:22px;z-index:99999;width:48px;height:48px;border:0;border-radius:50%;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#b64ed8;color:#fff;box-shadow:0 8px 20px rgba(17,24,33,.22);opacity:0;visibility:hidden;transform:translateY(12px);transition:opacity .2s ease,visibility .2s ease,transform .2s ease}",
    "#rita-subir.rita-subir-visible{opacity:1;visibility:visible;transform:translateY(0)}",
    "#rita-subir:hover{background:#9a3bc0}",
    "#rita-subir:focus-visible{outline:2px solid #111821;outline-offset:3px}",
    "#rita-subir svg{width:22px;height:22px;display:block}",
    "@media (prefers-reduced-motion:reduce){#rita-subir{transition:none}}"
  ].join("");

  function ensureStyle() {
    if (document.getElementById("rita-subir-estilo")) return;
    var style = document.createElement("style");
    style.id = "rita-subir-estilo";
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function goTop() {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  function start() {
    ensureStyle();
    if (document.getElementById("rita-subir")) return;
    var button = document.createElement("button");
    button.id = "rita-subir";
    button.type = "button";
    button.setAttribute("aria-label", "Subir");
    button.setAttribute("title", "Subir");
    button.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 5.5l7 7-1.4 1.4L13 9.3V19h-2V9.3L6.4 13.9 5 12.5l7-7z"/></svg>';
    button.addEventListener("click", goTop);
    document.body.appendChild(button);

    var ticking = false;
    function update() {
      ticking = false;
      if (window.scrollY > 320) button.classList.add("rita-subir-visible");
      else button.classList.remove("rita-subir-visible");
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
