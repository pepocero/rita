(function () {
  function pagePath() {
    var path = window.location.pathname || "/";
    path = path.replace(/\/index\.html$/i, "/");
    if (path.indexOf(".") !== -1 && !/\/$/.test(path)) {
      // file-like path without trailing slash
    } else if (!/\/$/.test(path)) {
      path += "/";
    }
    if (path === "") path = "/";
    return path;
  }

  function detectService() {
    var m = (window.location.pathname || "").match(/\/(musica|radio|escritos|formacion|terapias)(?:\/|$)/i);
    return m ? m[1].toLowerCase() : "";
  }

  function applyBlocks(blocks) {
    if (!blocks) return;
    Object.keys(blocks).forEach(function (key) {
      var el = document.querySelector('[data-rita-block="' + key.replace(/"/g, '\\"') + '"]');
      if (!el) return;
      el.innerHTML = blocks[key];
    });
  }

  function renderEntries(entries, service) {
    var host = document.getElementById("rita-entries-" + service);
    if (!host) return;
    if (!entries || !entries.length) {
      host.innerHTML = "";
      return;
    }
    var html = '<div class="rita-entries-grid">';
    entries.forEach(function (entry) {
      var href = "/entrada/" + encodeURIComponent(entry.slug);
      var thumb = entry.thumb_url
        ? '<img src="' + entry.thumb_url.replace(/"/g, "&quot;") + '" alt="" loading="lazy" />'
        : "";
      html +=
        '<article class="rita-entry-card">' +
        '<a href="' + href + '">' +
        thumb +
        "<h3>" +
        (entry.title || "").replace(/</g, "&lt;") +
        "</h3>" +
        "</a>" +
        (entry.summary
          ? "<p>" + String(entry.summary).replace(/<[^>]+>/g, "").replace(/</g, "&lt;") + "</p>"
          : "") +
        "</article>";
    });
    html += "</div>";
    host.innerHTML = html;
  }

  function ensureEntriesStyle() {
    if (document.getElementById("rita-entries-estilo")) return;
    var style = document.createElement("style");
    style.id = "rita-entries-estilo";
    style.textContent = [
      ".rita-entries-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:22px;margin:28px 0 10px}",
      ".rita-entry-card{text-align:left}",
      ".rita-entry-card img{width:100%;height:160px;object-fit:cover;border-radius:6px;display:block;margin-bottom:10px}",
      ".rita-entry-card h3{font-size:1.05rem;margin:0 0 6px;color:#333}",
      ".rita-entry-card a{text-decoration:none;color:inherit}",
      ".rita-entry-card p{margin:0;color:#666;font-size:.92rem}"
    ].join("");
    document.head.appendChild(style);
  }

  function start() {
    var path = pagePath();
    fetch("/api/content?path=" + encodeURIComponent(path), { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.ok) applyBlocks(data.blocks || {});
      })
      .catch(function () {});

    var service = detectService();
    if (service) {
      ensureEntriesStyle();
      fetch("/api/entries?service=" + encodeURIComponent(service), { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data && data.ok) renderEntries(data.entries || [], service);
        })
        .catch(function () {});
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.RitaCMS = window.RitaCMS || {};
  window.RitaCMS.pagePath = pagePath;
  window.RitaCMS.detectService = detectService;
})();
