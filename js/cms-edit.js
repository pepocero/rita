(function () {
  var STYLE = [
    "#rita-cms-bar{position:fixed;top:0;left:0;right:0;z-index:100000;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:10px 14px;background:#1f1b28;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.28);font-family:Segoe UI,Arial,sans-serif}",
    "#rita-cms-bar .rita-cms-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    "#rita-cms-bar button,#rita-cms-bar a.rita-cms-btn{appearance:none;border:0;border-radius:999px;padding:8px 14px;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px}",
    "#rita-cms-bar .rita-cms-primary{background:#b64ed8;color:#fff}",
    "#rita-cms-bar .rita-cms-secondary{background:rgba(255,255,255,.12);color:#fff}",
    "#rita-cms-bar .rita-cms-danger{background:#e35d6a;color:#fff}",
    "#rita-cms-bar .rita-cms-status{font-size:13px;opacity:.9;margin-right:8px}",
    "body.rita-cms-editing{padding-top:var(--rita-cms-bar-h,58px)}",
    "body.rita-cms-editing #main-header,body.rita-cms-editing #main-header.et-fixed-header{top:var(--rita-cms-bar-h,58px)!important}",
    "[data-rita-block].rita-cms-editable{outline:2px dashed rgba(182,78,216,.55);outline-offset:3px;min-height:1em}",
    "[data-rita-block].rita-cms-editable:focus{outline:2px solid #b64ed8}",
    ".rita-cms-link-wrap{display:inline-flex;align-items:center;vertical-align:middle;margin-left:6px;user-select:none}",
    ".rita-cms-open-link{appearance:none;position:relative;z-index:100002;width:26px;height:26px;margin:0;padding:0;border:0;border-radius:999px;background:#b64ed8;color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.2);opacity:.92;flex:0 0 auto}",
    ".rita-cms-open-link:hover,.rita-cms-open-link:focus{opacity:1;outline:2px solid #fff;outline-offset:1px}",
    ".rita-cms-open-link svg{width:14px;height:14px;display:block}",
    "#rita-cms-modal-bg{position:fixed;inset:0;background:rgba(10,8,14,.55);z-index:100001;display:none;align-items:center;justify-content:center;padding:16px}",
    "#rita-cms-modal-bg.rita-cms-open{display:flex}",
    "#rita-cms-modal{width:min(520px,100%);background:#fff;color:#333;border-radius:14px;padding:20px;max-height:90vh;overflow:auto}",
    "#rita-cms-modal h2{margin:0 0 12px;font-size:1.2rem}",
    "#rita-cms-modal label{display:block;font-size:.85rem;margin:10px 0 4px}",
    "#rita-cms-modal input,#rita-cms-modal select,#rita-cms-modal textarea{width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font:inherit}",
    "#rita-cms-modal textarea{min-height:110px}",
    "#rita-cms-modal .rita-cms-row{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}",
    "@media (max-width:700px){#rita-cms-bar{align-items:flex-start}}"
  ].join("");

  var OPEN_LINK_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z"/>' +
    '<path fill="currentColor" d="M5 5h6v2H7v10h10v-4h2v6H5V5z"/>' +
    "</svg>";

  var state = {
    user: null,
    dirty: false,
    saving: false
  };

  function ensureStyle() {
    if (document.getElementById("rita-cms-edit-estilo")) return;
    var style = document.createElement("style");
    style.id = "rita-cms-edit-estilo";
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function setStatus(text) {
    var el = document.getElementById("rita-cms-status");
    if (el) el.textContent = text || "";
  }

  function collectBlocks() {
    var blocks = [];
    document.querySelectorAll("[data-rita-block]").forEach(function (el) {
      var clone = el.cloneNode(true);
      clone.querySelectorAll(".rita-cms-link-wrap,.rita-cms-open-link").forEach(function (node) {
        node.parentNode.removeChild(node);
      });
      blocks.push({
        block_key: el.getAttribute("data-rita-block"),
        html: clone.innerHTML
      });
    });
    return blocks;
  }

  function isNavigableHref(href) {
    if (!href) return false;
    var value = String(href).trim();
    if (!value || value === "#" || value.indexOf("javascript:") === 0) return false;
    return true;
  }

  function openEditableLink(anchor) {
    if (!anchor || !anchor.href) return;
    window.location.href = anchor.href;
  }

  function attachOpenLinkControls() {
    document.querySelectorAll("[data-rita-block].rita-cms-editable a[href]").forEach(function (anchor) {
      if (!isNavigableHref(anchor.getAttribute("href"))) return;
      if (anchor.dataset.ritaCmsLinkReady === "1") return;
      anchor.dataset.ritaCmsLinkReady = "1";
      anchor.title = (anchor.title ? anchor.title + " · " : "") + "Ctrl/Cmd o Alt + clic para abrir";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rita-cms-open-link";
      btn.setAttribute("aria-label", "Abrir enlace para revisar o editar");
      btn.title = "Abrir enlace";
      btn.innerHTML = OPEN_LINK_ICON;
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        openEditableLink(anchor);
      });

      // contentEditable=false: el botón no se edita; collectBlocks lo elimina al guardar.
      var wrap = document.createElement("span");
      wrap.className = "rita-cms-link-wrap";
      wrap.contentEditable = "false";
      wrap.appendChild(btn);
      if (anchor.nextSibling) anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
      else anchor.parentNode.appendChild(wrap);
    });
  }

  function enableLinkNavigation() {
    document.addEventListener(
      "click",
      function (ev) {
        if (!document.body.classList.contains("rita-cms-editing")) return;
        var anchor = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
        if (!anchor || !anchor.closest("[data-rita-block].rita-cms-editable")) return;
        if (!isNavigableHref(anchor.getAttribute("href"))) return;
        if (!(ev.ctrlKey || ev.metaKey || ev.altKey)) return;
        ev.preventDefault();
        ev.stopPropagation();
        openEditableLink(anchor);
      },
      true
    );

    document.addEventListener("auxclick", function (ev) {
      if (!document.body.classList.contains("rita-cms-editing")) return;
      if (ev.button !== 1) return;
      var anchor = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
      if (!anchor || !anchor.closest("[data-rita-block].rita-cms-editable")) return;
      if (!isNavigableHref(anchor.getAttribute("href"))) return;
      ev.preventDefault();
      openEditableLink(anchor);
    });
  }

  function enableEditing() {
    document.body.classList.add("rita-cms-editing");
    document.querySelectorAll("[data-rita-block]").forEach(function (el) {
      el.setAttribute("contenteditable", "true");
      el.classList.add("rita-cms-editable");
      el.addEventListener("input", function () {
        state.dirty = true;
        setStatus("Cambios sin guardar");
      });
    });
    attachOpenLinkControls();
    enableLinkNavigation();
  }

  function saveBlocks() {
    if (state.saving) return;
    state.saving = true;
    setStatus("Guardando…");
    var path = (window.RitaCMS && window.RitaCMS.pagePath) ? window.RitaCMS.pagePath() : "/";
    fetch("/api/content", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ page_path: path, blocks: collectBlocks() })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.ok) throw new Error((res.j && res.j.error) || "Error al guardar");
        state.dirty = false;
        setStatus("Guardado (" + (res.j.saved || []).length + " bloques)");
      })
      .catch(function (err) {
        setStatus(err.message || "No se pudo guardar");
      })
      .finally(function () { state.saving = false; });
  }

  function logout() {
    fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
      .finally(function () {
        try { sessionStorage.removeItem("rita_cms_edit"); } catch (e) {}
        window.location.href = "/admin/";
      });
  }

  function openEntryModal() {
    var service = (window.RitaCMS && window.RitaCMS.detectService && window.RitaCMS.detectService()) || "musica";
    var bg = document.getElementById("rita-cms-modal-bg");
    if (!bg) return;
    document.getElementById("rita-entry-service").value = service;
    bg.classList.add("rita-cms-open");
  }

  function closeEntryModal() {
    var bg = document.getElementById("rita-cms-modal-bg");
    if (bg) bg.classList.remove("rita-cms-open");
  }

  function syncBarOffset() {
    var bar = document.getElementById("rita-cms-bar");
    if (!bar) return;
    document.documentElement.style.setProperty("--rita-cms-bar-h", bar.offsetHeight + "px");
  }

  function createBar() {
    if (document.getElementById("rita-cms-bar")) return;
    var bar = document.createElement("div");
    bar.id = "rita-cms-bar";
    bar.innerHTML =
      '<div><strong>Modo edición</strong> · <span id="rita-cms-user"></span> · <span class="rita-cms-status" id="rita-cms-status"></span></div>' +
      '<div class="rita-cms-actions">' +
      '<button type="button" class="rita-cms-primary" id="rita-cms-save">Guardar textos</button>' +
      '<button type="button" class="rita-cms-secondary" id="rita-cms-add">Añadir contenido</button>' +
      '<a class="rita-cms-btn rita-cms-secondary" href="/admin/">Admin</a>' +
      '<button type="button" class="rita-cms-danger" id="rita-cms-logout">Salir</button>' +
      "</div>";
    document.body.appendChild(bar);
    document.getElementById("rita-cms-user").textContent = state.user.username;
    document.getElementById("rita-cms-save").addEventListener("click", saveBlocks);
    document.getElementById("rita-cms-add").addEventListener("click", openEntryModal);
    document.getElementById("rita-cms-logout").addEventListener("click", logout);
    syncBarOffset();
    window.addEventListener("resize", syncBarOffset);
  }

  function createModal() {
    if (document.getElementById("rita-cms-modal-bg")) return;
    var bg = document.createElement("div");
    bg.id = "rita-cms-modal-bg";
    bg.innerHTML =
      '<div id="rita-cms-modal" role="dialog" aria-modal="true" aria-labelledby="rita-cms-modal-title">' +
      '<h2 id="rita-cms-modal-title">Añadir contenido</h2>' +
      '<label for="rita-entry-title">Título</label>' +
      '<input id="rita-entry-title" type="text" maxlength="200" />' +
      '<label for="rita-entry-service">Servicio</label>' +
      '<select id="rita-entry-service">' +
      '<option value="musica">Música</option>' +
      '<option value="radio">Radio</option>' +
      '<option value="escritos">Escritos</option>' +
      '<option value="formacion">Formación</option>' +
      '<option value="terapias">Terapias</option>' +
      "</select>" +
      '<label for="rita-entry-type">Tipo</label>' +
      '<select id="rita-entry-type">' +
      '<option value="texto">Texto</option>' +
      '<option value="video">Vídeo</option>' +
      '<option value="enlace">Enlace</option>' +
      "</select>" +
      '<label for="rita-entry-media">URL (YouTube, Spotify u otro enlace)</label>' +
      '<input id="rita-entry-media" type="url" placeholder="https://" />' +
      '<label for="rita-entry-thumb">URL miniatura (opcional)</label>' +
      '<input id="rita-entry-thumb" type="url" placeholder="https://" />' +
      '<label for="rita-entry-summary">Resumen</label>' +
      '<textarea id="rita-entry-summary"></textarea>' +
      '<label for="rita-entry-body">Contenido HTML</label>' +
      '<textarea id="rita-entry-body"></textarea>' +
      '<label><input id="rita-entry-published" type="checkbox" checked /> Publicar ahora</label>' +
      '<div class="rita-cms-row">' +
      '<button type="button" class="rita-cms-secondary" id="rita-entry-cancel">Cancelar</button>' +
      '<button type="button" class="rita-cms-primary" id="rita-entry-save">Crear</button>' +
      "</div>" +
      '<p id="rita-entry-msg" class="rita-cms-status"></p>' +
      "</div>";
    document.body.appendChild(bg);
    // Reuse bar button colors inside modal via inline styles
    bg.querySelector("#rita-entry-cancel").style.cssText =
      "border:0;border-radius:999px;padding:8px 14px;background:#eee;cursor:pointer;font-weight:600";
    bg.querySelector("#rita-entry-save").style.cssText =
      "border:0;border-radius:999px;padding:8px 14px;background:#b64ed8;color:#fff;cursor:pointer;font-weight:600";

    document.getElementById("rita-entry-cancel").addEventListener("click", closeEntryModal);
    bg.addEventListener("click", function (ev) {
      if (ev.target === bg) closeEntryModal();
    });
    document.getElementById("rita-entry-save").addEventListener("click", function () {
      var msg = document.getElementById("rita-entry-msg");
      msg.textContent = "Creando…";
      fetch("/api/entries", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: document.getElementById("rita-entry-title").value,
          service: document.getElementById("rita-entry-service").value,
          type: document.getElementById("rita-entry-type").value,
          media_url: document.getElementById("rita-entry-media").value,
          thumb_url: document.getElementById("rita-entry-thumb").value,
          summary: document.getElementById("rita-entry-summary").value,
          body_html: document.getElementById("rita-entry-body").value,
          published: document.getElementById("rita-entry-published").checked
        })
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.j.ok) throw new Error((res.j && res.j.error) || "No se pudo crear");
          msg.textContent = "Creado. Abriendo…";
          window.location.href = "/entrada/" + encodeURIComponent(res.j.entry.slug);
        })
        .catch(function (err) {
          msg.textContent = err.message || "Error";
        });
    });
  }

  function startEditMode() {
    ensureStyle();
    createBar();
    createModal();
    enableEditing();
    setStatus("Listo · clic en ↗ o Ctrl/Alt+clic para abrir enlaces");
  }

  function maybeStart() {
    var wantEdit = false;
    try { wantEdit = sessionStorage.getItem("rita_cms_edit") === "1"; } catch (e) {}
    if (!wantEdit && !/([?&])edit=1(?:&|$)/.test(window.location.search)) return;

    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.user) return;
        state.user = res.j.user;
        try { sessionStorage.setItem("rita_cms_edit", "1"); } catch (e) {}
        startEditMode();
      })
      .catch(function () {});
  }

  window.addEventListener("beforeunload", function (ev) {
    if (!state.dirty) return;
    ev.preventDefault();
    ev.returnValue = "";
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", maybeStart);
  else maybeStart();
})();
