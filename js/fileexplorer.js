/* =========================================================
   FILE EXPLORER
   Browse + open local files inside an OvertureOS window.
   Uses the File System Access API (Chrome/Edge) with a
   folder-picker / drag-and-drop fallback everywhere else.
========================================================= */

(function () {
    "use strict";

    function $(id) {
        return document.getElementById(id);
    }

    var win = $("fileexplorer");
    var grid = $("filexGrid");
    var preview = $("filexPreview");
    var pathEl = $("filexPath");
    var statusEl = $("filexStatus");
    var picker = $("filexPicker");
    var backBtn = $("filexBack");
    var fwdBtn = $("filexFwd");
    var upBtn = $("filexUp");
    var refreshBtn = $("filexRefresh");
    var openBtn = $("filexOpen");
    var split = $("filexSplit");

    var history = [];
    var histIndex = -1;
    var current = null;
    var selectedEntry = null;
    var previewUrl = null;

    var IMG = ["png","jpg","jpeg","gif","bmp","webp","svg","ico","heic","avif"];
    var VID = ["mp4","webm","ogg","mov","avi","mkv","m4v"];
    var AUD = ["mp3","wav","flac","m4a","aac","opus"];
    var CODE = ["js","ts","py","css","json","c","cpp","java","rb","go","rs","sh","sql","php","xml","yml","yaml","toml","ini"];
    var TEXT = ["txt","log","csv"].concat(CODE);

    /* =========================================================
       HELPERS
    ========================================================= */

    function extOf(name) {
        var i = name.lastIndexOf(".");
        return i === -1 ? "" : name.slice(i + 1).toLowerCase();
    }

    function fmtBytes(n) {
        if (typeof n !== "number" || isNaN(n)) return "";
        var units = ["B", "KB", "MB", "GB", "TB"];
        var i = 0;
        while (n >= 1024 && i < units.length - 1) {
            n /= 1024;
            i++;
        }
        return n.toFixed(i === 0 ? 0 : 1) + " " + units[i];
    }

    function iconFor(entry) {
        if (entry.kind === "directory") return "📁";
        var ext = extOf(entry.name);
        if (IMG.indexOf(ext) > -1) return "🖼️";
        if (VID.indexOf(ext) > -1) return "🎬";
        if (AUD.indexOf(ext) > -1) return "🎵";
        if (ext === "pdf") return "📕";
        if (ext === "md" || ext === "markdown") return "📝";
        if (TEXT.indexOf(ext) > -1) return "💻";
        return "📄";
    }

    function makeEntry(ref, parent) {
        return {
            name: ref.name,
            kind: ref.kind || (ref.isDirectory ? "directory" : "file"),
            ref: ref,
            parent: parent
        };
    }

    function readAllEntries(reader) {
        return new Promise(function (resolve, reject) {
            reader.readEntries(function (entries) { resolve(entries); }, reject);
        });
    }

    function childrenOf(entry) {
        var ref = entry.ref;

        // Modern FileSystemDirectoryHandle
        if (ref && ref.kind) {
            return (async function () {
                var out = [];
                for await (var h of ref.values()) {
                    out.push(makeEntry(h, entry));
                }
                return out;
            })();
        }

        // Webkit FileSystemDirectoryEntry (drag & drop)
        if (ref && ref.createReader) {
            return new Promise(function (resolve, reject) {
                var out = [];
                var reader = ref.createReader();
                (async function () {
                    while (true) {
                        var batch = await readAllEntries(reader);
                        out = out.concat(batch);
                        if (!batch.length) break;
                    }
                    resolve(out.map(function (x) { return makeEntry(x, entry); }));
                })().catch(reject);
            });
        }

        // In-memory folder (picker fallback / dropped files)
        if (entry.children) {
            return Promise.resolve(Object.values(entry.children));
        }

        return Promise.resolve([]);
    }

    function fileOf(entry) {
        return new Promise(function (resolve, reject) {
            if (entry.file) { resolve(entry.file); return; }
            var ref = entry.ref;
            if (!ref) { resolve(null); return; }
            if (ref.kind) {
                // FileSystemFileHandle
                ref.getFile().then(resolve, reject);
            } else if (ref.getFile) {
                // FileSystemFileEntry (webkit)
                ref.getFile(resolve, reject);
            } else {
                resolve(null);
            }
        });
    }

    function sortEntries(entries) {
        entries.sort(function (a, b) {
            var ad = a.kind === "directory";
            var bd = b.kind === "directory";
            if (ad !== bd) return ad ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, {
                numeric: true,
                sensitivity: "base"
            });
        });
        return entries;
    }

    function pathOf(entry) {
        var parts = [];
        var e = entry;
        while (e) {
            if (e.name) parts.unshift(e.name);
            e = e.parent;
        }
        return "/" + parts.join("/");
    }

    function emptyEl(msg) {
        var d = document.createElement("div");
        d.className = "filex-empty";
        d.textContent = msg;
        return d;
    }

    /* =========================================================
       NAVIGATION
    ========================================================= */

    function updateButtons() {
        backBtn.disabled = histIndex <= 0;
        fwdBtn.disabled = histIndex >= history.length - 1;
        upBtn.disabled = !current || !current.parent;
    }

    function navigateTo(entry, reset) {
        current = entry;
        selectedEntry = null;

        if (reset) {
            history = [entry];
            histIndex = 0;
        } else {
            history = history.slice(0, histIndex + 1);
            history.push(entry);
            histIndex++;
        }

        return render();
    }

    var renderToken = 0;

    async function render() {
        var token = ++renderToken;

        updateButtons();

        pathEl.textContent = current
            ? pathOf(current)
            : "choose a folder to start";

        grid.innerHTML = "";

        if (!current) {
            grid.appendChild(emptyEl(
                "press \"open folder\" in the corner, or drop files " +
                "anywhere in here ♡"
            ));
            statusEl.textContent = "no folder open";
            return;
        }

        var entries = sortEntries(await childrenOf(current));

        if (token !== renderToken) return;

        if (!entries.length) {
            grid.appendChild(emptyEl("this folder is empty ♡"));
        }

        entries.forEach(function (entry) {
            grid.appendChild(tileFor(entry));
        });

        statusEl.textContent =
            entries.length + " item" + (entries.length === 1 ? "" : "s");
    }

    /* =========================================================
       GRID TILES
    ========================================================= */

    function tileFor(entry) {
        var tile = document.createElement("div");
        tile.className = "filex-tile";
        if (selectedEntry === entry) tile.classList.add("selected");

        var icon = document.createElement("div");
        icon.className = "filex-tile-icon";
        icon.textContent = iconFor(entry);

        var name = document.createElement("div");
        name.className = "filex-tile-name";
        name.textContent = entry.name;
        name.title = entry.name;

        tile.appendChild(icon);
        tile.appendChild(name);

        tile.addEventListener("click", function (e) {
            e.stopPropagation();
            selectEntry(entry, tile);
        });

        tile.addEventListener("dblclick", function (e) {
            e.stopPropagation();
            openEntry(entry);
        });

        return tile;
    }

    function selectEntry(entry, tile) {
        selectedEntry = entry;

        document.querySelectorAll(".filex-tile.selected").forEach(function (t) {
            if (t !== tile) t.classList.remove("selected");
        });

        tile.classList.add("selected");

        statusEl.textContent =
            entry.kind === "directory"
                ? "folder · " + entry.name
                : entry.name;
    }

    function openEntry(entry) {
        if (entry.kind === "directory") {
            navigateTo(entry, false);
            return;
        }
        previewFile(entry);
    }

    /* =========================================================
       PREVIEW
    ========================================================= */

    function closePreview() {
        preview.classList.remove("open");
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }
        preview.innerHTML = "";
    }

    var filexWinSeq = 0;

    function centerContent(content) {
        content.style.display = "flex";
        content.style.alignItems = "center";
        content.style.justifyContent = "center";
    }

    function spawnOSWindow(fileName, payload) {
        if (typeof createOSWindow !== "function") {
            // No dynamic windows available -> fall back to a tab.
            if (payload.url) window.open(payload.url, "_blank");
            return;
        }

        filexWinSeq++;

        var winData =
            createOSWindow("filex-win-" + filexWinSeq, fileName || "file");

        if (!winData) return;

        var screen = winData.window;
        var content = winData.content;
        var revokeUrl = payload.url || null;

        // Reasonable default size, centred on the desktop.
        screen.style.width = "760px";
        screen.style.height = "540px";
        screen.style.left = "calc(50% - 380px)";
        screen.style.top = "calc(50% - 270px)";

        content.style.padding = "0";

        var type = payload.type;

        if (type === "pdf" || type === "html") {
            var iframe = document.createElement("iframe");
            iframe.src = payload.url;
            if (type === "html") iframe.sandbox = "";
            iframe.style.cssText =
                "width:100%;height:100%;border:none;background:white;";
            content.appendChild(iframe);
        } else if (IMG.indexOf(type) > -1) {
            centerContent(content);
            var img = document.createElement("img");
            img.src = payload.url;
            img.style.cssText =
                "max-width:100%;max-height:100%;object-fit:contain;";
            content.appendChild(img);
        } else if (VID.indexOf(type) > -1) {
            centerContent(content);
            var vid = document.createElement("video");
            vid.src = payload.url;
            vid.controls = true;
            vid.style.cssText =
                "max-width:100%;max-height:100%;";
            content.appendChild(vid);
        } else if (AUD.indexOf(type) > -1) {
            centerContent(content);
            var aud = document.createElement("audio");
            aud.src = payload.url;
            aud.controls = true;
            aud.style.cssText = "width:80%;";
            content.appendChild(aud);
        } else if (type === "text") {
            content.style.padding = "22px 25px";
            if (payload.ext === "md" || payload.ext === "markdown") {
                var md = document.createElement("div");
                md.className = "filex-md";
                var html = window.marked ? marked.parse(payload.text) : payload.text;
                md.innerHTML = window.DOMPurify
                    ? DOMPurify.sanitize(html)
                    : html;
                content.appendChild(md);
            } else {
                var pre = document.createElement("pre");
                pre.textContent = payload.text;
                pre.style.cssText =
                    "white-space:pre-wrap;word-break:break-word;" +
                    "margin:0;font-size:12px;line-height:1.6;";
                content.appendChild(pre);
            }
            revokeUrl = null;
        } else {
            content.style.padding = "22px 25px";
            content.appendChild(emptyEl(
                "no preview for ." + (type || "?") + " files"
            ));
        }

        // Free the blob URL once this window is closed.
        winData.close.addEventListener("click", function () {
            if (revokeUrl) {
                URL.revokeObjectURL(revokeUrl);
                revokeUrl = null;
            }
        });
    }

    function openInNewWindow(f, ext, name) {
        if (ext === "html" || ext === "htm") {
            f.text()
                .then(function (t) {
                    spawnOSWindow(name, {
                        type: "html",
                        url: URL.createObjectURL(
                            new Blob([t], { type: "text/html" })
                        )
                    });
                })
                .catch(function () {
                    statusEl.textContent = "couldn't open in new window";
                });
            return;
        }

        if (TEXT.indexOf(ext) > -1) {
            f.text()
                .then(function (t) {
                    spawnOSWindow(name, {
                        type: "text",
                        text: t,
                        ext: ext
                    });
                })
                .catch(function () {
                    statusEl.textContent = "couldn't open in new window";
                });
            return;
        }

        spawnOSWindow(name, {
            type: ext,
            url: URL.createObjectURL(f)
        });
    }

    async function previewFile(entry) {
        var f;
        try {
            f = await fileOf(entry);
        } catch (err) {
            statusEl.textContent = "couldn't read " + entry.name;
            return;
        }
        if (!f) {
            statusEl.textContent = "couldn't read " + entry.name;
            return;
        }

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }

        preview.classList.add("open");
        preview.innerHTML = "";

        var ext = extOf(entry.name);

        var head = document.createElement("div");
        head.className = "filex-preview-head";

        var title = document.createElement("span");
        title.textContent = entry.name;

        var open = document.createElement("button");
        open.textContent = "↗";
        open.title = "open in new window";
        open.addEventListener("click", function () {
            openInNewWindow(f, ext, entry.name);
        });

        var close = document.createElement("button");
        close.textContent = "×";
        close.title = "close preview";
        close.addEventListener("click", closePreview);

        head.appendChild(title);
        head.appendChild(open);
        head.appendChild(close);

        var meta = document.createElement("div");
        meta.className = "filex-preview-meta";
        meta.textContent =
            fmtBytes(f.size) +
            (f.lastModified
                ? " · " + new Date(f.lastModified).toLocaleString()
                : "");

        var body = document.createElement("div");
        body.className = "filex-preview-body";

        preview.appendChild(head);
        preview.appendChild(meta);
        preview.appendChild(body);

        try {
            if (IMG.indexOf(ext) > -1) {
                previewUrl = URL.createObjectURL(f);
                var img = document.createElement("img");
                img.src = previewUrl;
                body.appendChild(img);
            } else if (VID.indexOf(ext) > -1) {
                previewUrl = URL.createObjectURL(f);
                var vid = document.createElement("video");
                vid.controls = true;
                vid.src = previewUrl;
                body.appendChild(vid);
            } else if (AUD.indexOf(ext) > -1) {
                previewUrl = URL.createObjectURL(f);
                var aud = document.createElement("audio");
                aud.controls = true;
                aud.src = previewUrl;
                body.appendChild(aud);
            } else if (ext === "pdf") {
                previewUrl = URL.createObjectURL(f);
                var pdf = document.createElement("iframe");
                pdf.src = previewUrl;
                body.appendChild(pdf);
            } else if (ext === "html" || ext === "htm") {
                var htext = await f.text();
                previewUrl = URL.createObjectURL(
                    new Blob([htext], { type: "text/html" })
                );
                var htmlFrame = document.createElement("iframe");
                htmlFrame.sandbox = "";
                htmlFrame.src = previewUrl;
                body.appendChild(htmlFrame);
            } else if (TEXT.indexOf(ext) > -1) {
                var text = await f.text();
                if (ext === "md" || ext === "markdown") {
                    var md = document.createElement("div");
                    md.className = "filex-md";
                    var html = window.marked ? marked.parse(text) : text;
                    md.innerHTML = window.DOMPurify
                        ? DOMPurify.sanitize(html)
                        : html;
                    body.appendChild(md);
                } else {
                    var pre = document.createElement("pre");
                    pre.textContent = text;
                    body.appendChild(pre);
                }
            } else {
                var msg = emptyEl(
                    "no preview for ." + (ext || "?") + " files"
                );
                body.appendChild(msg);
            }
        } catch (err) {
            var em = emptyEl("couldn't open this file: " + err.message);
            body.appendChild(em);
        }
    }

    /* =========================================================
       OPEN FOLDER (File System Access API)
    ========================================================= */

    openBtn.addEventListener("click", function () {
        if (window.showDirectoryPicker) {
            window.showDirectoryPicker({ mode: "read" })
                .then(function (h) {
                    var root = {
                        name: h.name,
                        kind: "directory",
                        ref: h,
                        parent: null
                    };
                    return navigateTo(root, true);
                })
                .catch(function (err) {
                    if (err.name === "AbortError") return;
                    // Picker unsupported in this context -> folder input
                    if (err.name === "SecurityError" || err.name === "TypeError") {
                        picker.click();
                        return;
                    }
                    statusEl.textContent = err.message;
                });
        } else {
            picker.click();
        }
    });

    /* =========================================================
       FOLDER PICKER FALLBACK (<input webkitdirectory>)
    ========================================================= */

    picker.addEventListener("change", function () {
        var files = Array.prototype.slice.call(picker.files);
        if (!files.length) return;

        var rootName = (files[0].webkitRelativePath || "").split("/")[0] ||
            "selected files";

        var root = {
            name: rootName,
            kind: "directory",
            children: {},
            parent: null
        };

        files.forEach(function (f) {
            var parts = (f.webkitRelativePath || f.name).split("/");
            var node = root;
            for (var i = 1; i < parts.length - 1; i++) {
                if (!node.children[parts[i]]) {
                    node.children[parts[i]] = {
                        name: parts[i],
                        kind: "directory",
                        children: {},
                        parent: node
                    };
                }
                node = node.children[parts[i]];
            }
            node.children[f.name] = {
                name: f.name,
                kind: "file",
                file: f,
                parent: node
            };
        });

        navigateTo(root, true);
        picker.value = "";
    });

    /* =========================================================
       DRAG & DROP
    ========================================================= */

    ["dragenter", "dragover"].forEach(function (evt) {
        win.addEventListener(evt, function (e) {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    win.addEventListener("drop", async function (e) {
        e.preventDefault();
        e.stopPropagation();

        var items = e.dataTransfer.items;
        var webkitEntries = [];

        for (var i = 0; i < items.length; i++) {
            if (items[i].webkitGetAsEntry) {
                var en = items[i].webkitGetAsEntry();
                if (en) webkitEntries.push(en);
            }
        }

        if (webkitEntries.length) {
            var droppedDir = null;
            for (var j = 0; j < webkitEntries.length; j++) {
                if (webkitEntries[j].isDirectory) {
                    droppedDir = webkitEntries[j];
                    break;
                }
            }
            if (droppedDir) {
                var rootDir = {
                    name: droppedDir.name,
                    kind: "directory",
                    ref: droppedDir,
                    parent: null
                };
                await navigateTo(rootDir, true);
                return;
            }
        }

        var files = e.dataTransfer.files;
        if (files.length) {
            var rootFiles = {
                name: "dropped files",
                kind: "directory",
                children: {},
                parent: null
            };
            for (var k = 0; k < files.length; k++) {
                rootFiles.children[files[k].name] = {
                    name: files[k].name,
                    kind: "file",
                    file: files[k],
                    parent: rootFiles
                };
            }
            await navigateTo(rootFiles, true);
        }
    });

    /* =========================================================
       TOOLBAR BUTTONS
    ========================================================= */

    backBtn.addEventListener("click", function () {
        if (histIndex > 0) {
            histIndex--;
            current = history[histIndex];
            selectedEntry = null;
            render();
        }
    });

    fwdBtn.addEventListener("click", function () {
        if (histIndex < history.length - 1) {
            histIndex++;
            current = history[histIndex];
            selectedEntry = null;
            render();
        }
    });

    upBtn.addEventListener("click", function () {
        if (current && current.parent) {
            navigateTo(current.parent, false);
        }
    });

    refreshBtn.addEventListener("click", function () {
        selectedEntry = null;
        render();
    });

    /* =========================================================
       SPLIT RESIZE (drag between grid and preview)
    ========================================================= */

    var splitting = false;
    var splitStartX = 0;
    var splitStartW = 0;
    var splitMax = 0;
    var splitTarget = 0;
    var splitRaf = false;

    split.addEventListener("mousedown", function (e) {
        e.preventDefault();
        e.stopPropagation();

        splitting = true;
        splitStartX = e.clientX;
        splitStartW = preview.offsetWidth;
        splitMax = win.offsetWidth * 0.85;
        split.classList.add("dragging");
        document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", function (e) {
        if (!splitting) return;
        e.preventDefault();

        splitTarget = Math.max(
            210,
            Math.min(splitStartW - (e.clientX - splitStartX), splitMax)
        );

        if (!splitRaf) {
            splitRaf = true;
            requestAnimationFrame(function () {
                splitRaf = false;
                preview.style.width = splitTarget + "px";
            });
        }
    });

    document.addEventListener("mouseup", function () {
        if (!splitting) return;

        splitting = false;
        split.classList.remove("dragging");
        document.body.style.userSelect = "";
    });

    /* =========================================================
       KEYBOARD
    ========================================================= */

    document.addEventListener("keydown", function (e) {
        if (!win || getComputedStyle(win).display === "none") return;

        var t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;

        if (e.key === "Escape") {
            closePreview();
        } else if (e.key === "Enter" && selectedEntry) {
            openEntry(selectedEntry);
        } else if (e.key === "Backspace") {
            upBtn.click();
        } else if (e.key === "ArrowLeft") {
            backBtn.click();
        } else if (e.key === "ArrowRight") {
            fwdBtn.click();
        }
    });

    /* =========================================================
       INIT
    ========================================================= */

    statusEl.textContent = "open a folder to browse local files";
    render();
})();