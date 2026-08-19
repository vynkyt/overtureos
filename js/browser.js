/* =========================================================
   BROWSER
   Browse the internet inside an OvertureOS window.
   Sites that block iframe embedding (Google, ...) are fetched
   through the server-side /api/browse proxy, which strips
   X-Frame-Options / CSP so they render inside this window.
========================================================= */

(function () {
    "use strict";

    function $(id) {
        return document.getElementById(id);
    }

    var frame = $("browserFrame");
    var urlInput = $("browserUrl");
    var goBtn = $("browserGo");
    var backBtn = $("browserBack");
    var fwdBtn = $("browserFwd");
    var reloadBtn = $("browserReload");
    var homeBtn = $("browserHome");
    var quickBar = $("browserQuick");
    var statusEl = $("browserStatus");

    var HOME = "https://www.wikipedia.org";

    var history = [];
    var index = -1;

    /* =========================================================
       URL HELPERS
    ========================================================= */

    function normalizeUrl(input) {
        var s = (input || "").trim();
        if (!s) return null;

        // Already has a scheme
        if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//.test(s)) return s;

        // localhost / IP -> usually http
        if (/^(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?([\/?#].*)?$/.test(s)) {
            return "http://" + s;
        }

        // Looks like a domain -> https
        if (/^([a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,}(:\d+)?([\/?#].*)?$/.test(s)) {
            return "https://" + s;
        }

        // Otherwise treat it as a search query
        return "https://www.google.com/search?q=" + encodeURIComponent(s);
    }

    /* =========================================================
       NAVIGATION
    ========================================================= */

    function iframeSrcFor(url) {
        // Sites that block framing (Google, ...) go through the
        // server-side proxy, which strips X-Frame-Options / CSP
        // so they render inside this window.
        if (/^https?:\/\//i.test(url)) {
            return "/api/browse?url=" + encodeURIComponent(url);
        }
        return url;
    }

    function updateButtons() {
        backBtn.disabled = index <= 0;
        fwdBtn.disabled = index >= history.length - 1;
    }

    function go(url, push) {
        if (!url) return;

        if (push) {
            history = history.slice(0, index + 1);
            history.push(url);
            index++;
        }

        updateButtons();
        urlInput.value = url;
        statusEl.textContent = "loading...";
        frame.src = iframeSrcFor(url);
    }

    function back() {
        if (index > 0) {
            index--;
            updateButtons();
            urlInput.value = history[index];
            frame.src = iframeSrcFor(history[index]);
        }
    }

    function forward() {
        if (index < history.length - 1) {
            index++;
            updateButtons();
            urlInput.value = history[index];
            frame.src = iframeSrcFor(history[index]);
        }
    }

    /* =========================================================
       CONTROLS
    ========================================================= */

    urlInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            go(normalizeUrl(urlInput.value), true);
        }
    });

    urlInput.addEventListener("focus", function () {
        urlInput.select();
    });

    goBtn.addEventListener("click", function () {
        go(normalizeUrl(urlInput.value), true);
    });

    backBtn.addEventListener("click", back);
    fwdBtn.addEventListener("click", forward);

    reloadBtn.addEventListener("click", function () {
        try {
            frame.contentWindow.location.reload();
        } catch (e) {
            frame.src = frame.src;
        }
    });

    homeBtn.addEventListener("click", function () {
        go(HOME, true);
    });

    /* =========================================================
       QUICK LINKS
    ========================================================= */

    var quickLinks = [
        { name: "google", url: "https://www.google.com" },
        { name: "wikipedia", url: "https://www.wikipedia.org" },
        { name: "archive", url: "https://archive.org" },
        { name: "example", url: "https://example.com" },
        { name: "overture", url: "./index.html" }
    ];

    quickLinks.forEach(function (link) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = link.name;
        btn.title = link.url;
        btn.addEventListener("click", function () {
            go(link.url, true);
        });
        quickBar.appendChild(btn);
    });

    /* =========================================================
       LOAD EVENTS
    ========================================================= */

    frame.addEventListener("load", function () {
        statusEl.textContent = "";
        try {
            var href = frame.contentWindow.location.href;
            if (href && href !== "about:blank") {
                // Proxied pages report the proxy URL; unwrap it to
                // show the real address.
                var m = href.match(/\/api\/browse\?url=([^#&]+)/);
                urlInput.value = m ? decodeURIComponent(m[1]) : href;
            }
        } catch (e) {
            // Cross-origin: can't read the actual URL.
        }
    });

    /* =========================================================
       INIT
    ========================================================= */

    updateButtons();
    go(HOME, true);
})();