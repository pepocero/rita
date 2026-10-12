(function () {
  var STYLE = [
    ".rita-busqueda{max-width:820px;margin:48px auto 72px;padding:0 24px;font-family:Hind,Helvetica,Arial,sans-serif;color:#666;line-height:1.7}",
    ".rita-busqueda h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;font-size:48px;line-height:1.1;color:#111821;margin:0 0 12px}",
    ".rita-busqueda .rita-busqueda-resumen{margin:0 0 28px;font-size:16px}",
    ".rita-busqueda article{padding:18px 0;border-top:1px solid #eadfce}",
    ".rita-busqueda h2{font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;font-size:28px;line-height:1.2;margin:0 0 6px}",
    ".rita-busqueda a{color:#b64ed8;text-decoration:none}",
    ".rita-busqueda a:hover{text-decoration:underline}",
    ".rita-busqueda p{margin:0;font-size:16px}"
  ].join("");

  function fold(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sitePath() {
    var path = decodeURIComponent(location.pathname).replace(/\\/g, "/");
    var marker = "/sitio/";
    var at = path.toLowerCase().lastIndexOf(marker);
    if (at >= 0) path = path.slice(at + marker.length - 1);
    path = path.replace(/\/index\.html$/i, "/");
    if (/\.html$/i.test(path)) path = path.slice(0, path.lastIndexOf("/") + 1);
    return path;
  }

  function prefix() {
    var depth = sitePath().split("/").filter(Boolean).length;
    return depth ? "../".repeat(depth) : "./";
  }

  function snippet(text, foldedText, words) {
    var at = -1;
    for (var i = 0; i < words.length; i += 1) {
      at = foldedText.indexOf(words[i]);
      if (at >= 0) break;
    }
    if (at < 0) return text.slice(0, 180);
    var start = Math.max(0, at - 70);
    var end = Math.min(text.length, at + 140);
    var piece = text.slice(start, end).trim();
    return (start > 0 ? "…" : "") + piece + (end < text.length ? "…" : "");
  }

  function search(query) {
    var words = fold(query).split(/\s+/).filter(Boolean);
    var index = window.RITA_INDICE || [];
    var found = [];
    for (var i = 0; i < index.length; i += 1) {
      var item = index[i];
      var title = fold(item.titulo);
      var body = fold(item.texto);
      var haystack = title + " " + body;
      var matches = true;
      var titleHits = 0;
      for (var w = 0; w < words.length; w += 1) {
        if (haystack.indexOf(words[w]) < 0) {
          matches = false;
          break;
        }
        if (title.indexOf(words[w]) >= 0) titleHits += 1;
      }
      if (!matches) continue;
      found.push({
        item: item,
        score: titleHits * 20 + (titleHits === words.length ? 40 : 0),
        words: words,
        folded: body
      });
    }
    found.sort(function (a, b) {
      return b.score - a.score || a.item.titulo.localeCompare(b.item.titulo, "es");
    });
    return found.slice(0, 40);
  }

  function render(query) {
    var main = document.getElementById("main-content");
    if (!main) return;
    if (!document.getElementById("rita-busqueda-estilo")) {
      var style = document.createElement("style");
      style.id = "rita-busqueda-estilo";
      style.textContent = STYLE;
      document.head.appendChild(style);
    }
    var trimmed = query.trim();
    var html = '<div class="rita-busqueda"><h1>Búsqueda</h1>';
    if (!trimmed) {
      html += "<p class=\"rita-busqueda-resumen\">Escribe una palabra en el buscador.</p></div>";
      main.innerHTML = html;
      return;
    }
    var results = search(trimmed);
    html += "<p class=\"rita-busqueda-resumen\">" + results.length + " resultados para «" + escapeHtml(trimmed) + "»</p>";
    if (!results.length) {
      html += "<p>No hay páginas que contengan esa búsqueda.</p></div>";
      main.innerHTML = html;
      return;
    }
    var base = prefix();
    for (var i = 0; i < results.length; i += 1) {
      var result = results[i];
      html += "<article><h2><a href=\"" + escapeHtml(base + result.item.ruta) + "\">" + escapeHtml(result.item.titulo) + "</a></h2>";
      html += "<p>" + escapeHtml(snippet(result.item.texto, result.folded, result.words)) + "</p></article>";
    }
    html += "</div>";
    main.innerHTML = html;
    document.title = "Búsqueda: " + trimmed + " | Rita Valero";
  }

  function onSubmit(event) {
    event.preventDefault();
    var input = event.target.querySelector("[name=s]");
    var query = input ? input.value.trim() : "";
    var url = new URL(location.href);
    if (query) url.searchParams.set("s", query);
    else url.searchParams.delete("s");
    location.assign(url.toString());
  }

  function start() {
    var forms = document.querySelectorAll("form.et-search-form, form.searchform");
    for (var i = 0; i < forms.length; i += 1) forms[i].addEventListener("submit", onSubmit);
    var query = new URLSearchParams(location.search).get("s");
    if (query !== null && query !== "") {
      var fields = document.querySelectorAll("[name=s]");
      for (var f = 0; f < fields.length; f += 1) fields[f].value = query;
      render(query);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
