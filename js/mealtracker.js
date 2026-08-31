/* --------------------------------------------------
   MEAL TRACKER — OvertureOS
   -------------------------------------------------- */

var MealTracker = (function () {

    /* --------------------------------------------------
       FOOD DATABASE — image path, calories, category
    -------------------------------------------------- */

    var FOODS = [
        // Drinks
        { name: "Bubble Tea (no sugar)", img: "img/food/1bubbletea.png", cal: 360, cat: "drinks" },
        { name: "Bubble Tea (2, no sugar)",       img: "img/food/2bubbletea.png", cal: 720, cat: "drinks" },

        // Snacks
        { name: "Chocolate Bar",           img: "img/food/chocolate-bar.png", cal: 230, cat: "snacks" },
        { name: "Strawberries",            img: "img/food/strawberries.png", cal: 49, cat: "snacks" },

        // Meals
        { name: "Wrap",                    img: "img/food/wrap.png", cal: 300, cat: "meals" },

        // Custom placeholder
        { name: "Custom",                  img: "img/food/custom.jpg", cal: 0, cat: "custom", isCustom: true },
    ];

    var MEALS = [
        { id: "breakfast", label: "Breakfast", color: "#fdcb6e" },
        { id: "lunch",     label: "Lunch",     color: "#55efc4" },
        { id: "dinner",    label: "Dinner",    color: "#a29bfe" },
        { id: "snacks",    label: "Snacks",    color: "#fd79a8" },
    ];

    var TABS = [
        { id: "add",    label: "Add Food" },
        { id: "today",  label: "Chart" },
    ];

    /* --------------------------------------------------
       STATE
    -------------------------------------------------- */

    var currentDate = today();
    var activeTab = "add";
    var activeMeal = "breakfast";
    var chartRange = "weekly";

    /* --------------------------------------------------
       HELPERS
    -------------------------------------------------- */

    function today() {
        var d = new Date();
        return d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0");
    }

    function loadData(callback) {
        if (typeof OvertureStore === "undefined") { callback({}); return; }
        OvertureStore.get("mealtracker", "data").then(function (val) {
            callback(val || {});
        }).catch(function () { callback({}); });
    }

    function saveData(data, cb) {
        if (typeof OvertureStore === "undefined") { if (cb) cb(); return; }
        OvertureStore.set("mealtracker", "data", data).then(function () {
            if (cb) cb();
        }).catch(function () { if (cb) cb(); });
    }

    function getDayData(data, date) {
        if (!data[date]) data[date] = { breakfast: [], lunch: [], dinner: [], snacks: [] };
        return data[date];
    }

    function dayTotalCals(day) {
        var t = 0;
        ["breakfast", "lunch", "dinner", "snacks"].forEach(function (m) {
            (day[m] || []).forEach(function (i) { t += i.calories; });
        });
        return t;
    }

    function dayTotalFromData(data, dateStr) {
        return dayTotalCals(getDayData(data, dateStr));
    }

    function formatDate(dateStr) {
        var p = dateStr.split("-");
        var d = new Date(p[0], p[1] - 1, p[2]);
        var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return days[d.getDay()] + ", " + d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
    }

    function shiftDate(dateStr, days) {
        var p = dateStr.split("-");
        var d = new Date(p[0], p[1] - 1, p[2]);
        d.setDate(d.getDate() + days);
        return d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0");
    }

    /* --------------------------------------------------
       RENDER — MAIN
    -------------------------------------------------- */

    function render() {
        var container = document.getElementById("mealtracker-content");
        if (!container) return;

        loadData(function (data) {
            var day = getDayData(data, currentDate);
            var total = dayTotalCals(day);

            var html = '<div class="mt-container">';

            // Header
            html += '<div class="mt-header">';
            html += '<div class="mt-date">' + formatDate(currentDate) + '</div>';
            html += '<div class="mt-total"><span class="mt-total-num">' + total + '</span> cal</div>';
            html += '</div>';

            // Date nav
            html += '<div class="mt-nav">';
            html += '<button class="mt-nav-btn" id="mt-prev-day">&#9664;</button>';
            html += '<button class="mt-nav-btn" id="mt-today-btn">Today</button>';
            html += '<button class="mt-nav-btn" id="mt-next-day">&#9654;</button>';
            html += '</div>';

            // Tabs
            html += '<div class="mt-tabs">';
            TABS.forEach(function (tab) {
                html += '<button class="mt-tab' + (activeTab === tab.id ? ' active' : '') + '" data-tab="' + tab.id + '">' + tab.label + '</button>';
            });
            html += '</div>';

            // Tab content
            html += '<div class="mt-tab-content">';
            if (activeTab === "add") {
                html += renderAddTab(data, day);
            } else if (activeTab === "today") {
                html += renderTodayTab(day);
            }
            html += '</div>';

            html += '</div>';

            container.innerHTML = html;
            bindEvents(container, data);

            if (activeTab === "today" || activeTab === "chart") {
                setTimeout(function () { drawChart(data); }, 0);
            }
        });
    }

    /* --------------------------------------------------
       RENDER — ADD TAB
    -------------------------------------------------- */

    function renderAddTab(data, day) {
        var html = '';

        // Meal selector
        html += '<div class="mt-meal-selector">';
        MEALS.forEach(function (m) {
            var count = (day[m.id] || []).length;
            html += '<button class="mt-meal-pill' + (activeMeal === m.id ? ' active' : '') + '" data-meal="' + m.id + '" style="--pill-color:' + m.color + '">';
            html += m.label;
            if (count > 0) html += '<span class="mt-pill-count">' + count + '</span>';
            html += '</button>';
        });
        html += '</div>';

        html += renderFoodGrid(activeMeal);

        return html;
    }

    /* --------------------------------------------------
       RENDER — TODAY TAB
    -------------------------------------------------- */

    function renderFoodGrid(targetMeal) {
        var html = '<div class="mt-food-grid">';
        FOODS.forEach(function (f) {
            html += '<div class="mt-food-card" data-name="' + f.name + '" data-cal="' + f.cal + '" data-img="' + f.img + '" data-custom="' + (f.isCustom ? "1" : "0") + '" data-meal-target="' + targetMeal + '">';
            html += '<img src="' + f.img + '" alt="' + f.name + '" class="mt-food-img" loading="lazy">';
            html += '<div class="mt-food-label">' + f.name + '</div>';
            html += '<div class="mt-food-cal">' + (f.isCustom ? "tap to add" : f.cal + " cal") + '</div>';
            html += '</div>';
        });
        html += '</div>';
        return html;
    }

    function renderTodayTab(day) {
        var html = '';

        MEALS.forEach(function (m) {
            var items = day[m.id] || [];
            var mealCals = 0;
            items.forEach(function (i) { mealCals += i.calories; });

            html += '<div class="mt-today-meal">';
            html += '<div class="mt-today-meal-header">';
            html += '<span class="mt-today-meal-title">' + m.label + '</span>';
            html += '<span class="mt-today-meal-cals">' + mealCals + ' cal</span>';
            html += '</div>';
            html += '<div class="mt-today-items">';

            if (items.length === 0) {
                html += '<div class="mt-empty">Nothing logged yet</div>';
            } else {
                items.forEach(function (item, i) {
                    html += '<div class="mt-today-item">';
                    html += '<div class="mt-today-item-info">';
                    html += '<div class="mt-today-item-name">' + item.name + '</div>';
                    html += '<div class="mt-today-item-cal">' + item.calories + ' cal</div>';
                    html += '</div>';
                    html += '<button class="mt-today-item-del" data-meal="' + m.id + '" data-idx="' + i + '">&times;</button>';
                    html += '</div>';
                });
            }

            html += '</div></div>';
        });

        // Chart inline
        html += '<div class="mt-chart-section">';
        html += '<div class="mt-chart-toggles">';
        ["weekly", "monthly", "yearly"].forEach(function (r) {
            html += '<button class="mt-chart-btn' + (chartRange === r ? ' active' : '') + '" data-range="' + r + '">' + r.charAt(0).toUpperCase() + r.slice(1) + '</button>';
        });
        html += '</div>';
        html += '<div class="mt-chart-wrap"><canvas id="mt-chart"></canvas></div>';
        html += '<div id="mt-chart-stats" class="mt-chart-stats"></div>';
        html += '</div>';

        return html;
    }

    /* --------------------------------------------------
       CHART DRAWING
    -------------------------------------------------- */

    function getChartData(data, range) {
        var labels = [], values = [];
        var now = new Date();

        if (range === "weekly") {
            for (var i = 6; i >= 0; i--) {
                var d = new Date(now); d.setDate(d.getDate() - i);
                var key = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
                labels.push(["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()] + "\n" + d.getDate() + "/" + (d.getMonth()+1));
                values.push(dayTotalFromData(data, key));
            }
        } else if (range === "monthly") {
            for (var i = 29; i >= 0; i--) {
                var d = new Date(now); d.setDate(d.getDate() - i);
                var key = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
                labels.push(d.getDate() + "/" + (d.getMonth()+1));
                values.push(dayTotalFromData(data, key));
            }
        } else {
            var mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            var cm = now.getMonth(), cy = now.getFullYear();
            for (var i = 11; i >= 0; i--) {
                var m = (cm - i + 12) % 12, y = cm - i < 0 ? cy - 1 : cy;
                var total = 0, count = 0, dim = new Date(y, m+1, 0).getDate();
                for (var dd = 1; dd <= dim; dd++) {
                    var key = y + "-" + String(m+1).padStart(2,"0") + "-" + String(dd).padStart(2,"0");
                    var t = dayTotalFromData(data, key);
                    if (t > 0) { total += t; count++; }
                }
                labels.push(mn[m] + " " + y);
                values.push(count > 0 ? Math.round(total / count) : 0);
            }
        }
        return { labels: labels, values: values };
    }

    function drawChart(data) {
        var canvas = document.getElementById("mt-chart");
        var statsEl = document.getElementById("mt-chart-stats");
        if (!canvas || !statsEl) return;

        var ctx = canvas.getContext("2d");
        var wrap = canvas.parentElement;
        var W = wrap.clientWidth || 600;
        var H = 180;
        var dpr = window.devicePixelRatio || 1;

        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        ctx.scale(dpr, dpr);

        var chartData = getChartData(data, chartRange);
        var labels = chartData.labels;
        var values = chartData.values;

        var maxVal = Math.max.apply(null, values);
        if (maxVal === 0) maxVal = 2000;
        maxVal = Math.ceil(maxVal / 500) * 500;

        var padL = 46, padR = 12, padT = 14, padB = 36;
        var chartW = W - padL - padR;
        var chartH = H - padT - padB;

        ctx.clearRect(0, 0, W, H);

        // Grid
        ctx.strokeStyle = "rgba(135,42,78,0.08)";
        ctx.lineWidth = 1;
        ctx.font = "10px Balsamiq Sans, sans-serif";
        ctx.fillStyle = "rgba(135,42,78,0.45)";
        ctx.textAlign = "right";

        for (var i = 0; i <= 4; i++) {
            var y = padT + chartH - (chartH * i / 4);
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
            ctx.fillText(Math.round(maxVal * i / 4), padL - 5, y + 3);
        }

        // Bars
        var gap = chartW / labels.length;
        var barW = Math.max(3, gap - 4);

        for (var i = 0; i < labels.length; i++) {
            var x = padL + i * gap + (gap - barW) / 2;
            var barH = (values[i] / maxVal) * chartH;
            var y = padT + chartH - barH;

            var grad = ctx.createLinearGradient(x, y, x, padT + chartH);
            grad.addColorStop(0, "#e84393");
            grad.addColorStop(1, "rgba(232,67,147,0.25)");
            ctx.fillStyle = grad;

            var r = Math.min(3, barW / 2, barH / 2);
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + barW - r, y);
            ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
            ctx.lineTo(x + barW, padT + chartH);
            ctx.lineTo(x, padT + chartH);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.fill();

            if (values[i] > 0) {
                ctx.fillStyle = "#4a1a2e";
                ctx.font = "8px Balsamiq Sans, sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(values[i], x + barW / 2, y - 3);
            }

            ctx.fillStyle = "rgba(135,42,78,0.5)";
            ctx.font = "8px Balsamiq Sans, sans-serif";
            ctx.textAlign = "center";
            var ll = labels[i].split("\n");
            for (var l = 0; l < ll.length; l++) {
                ctx.fillText(ll[l], x + barW / 2, padT + chartH + 10 + l * 10);
            }
        }

        // Stats
        var nonZero = values.filter(function (v) { return v > 0; });
        var avg = nonZero.length ? Math.round(nonZero.reduce(function (a,b) { return a+b; }, 0) / nonZero.length) : 0;
        var peak = Math.max.apply(null, values);
        var least = nonZero.length ? Math.min.apply(null, nonZero) : 0;

        statsEl.innerHTML =
            '<div class="mt-stat"><span class="mt-stat-val">' + avg + '</span><span class="mt-stat-lbl">avg/day</span></div>' +
            '<div class="mt-stat"><span class="mt-stat-val">' + peak + '</span><span class="mt-stat-lbl">peak</span></div>' +
            '<div class="mt-stat"><span class="mt-stat-val">' + least + '</span><span class="mt-stat-lbl">least</span></div>' +
            '<div class="mt-stat"><span class="mt-stat-val">' + nonZero.length + '</span><span class="mt-stat-lbl">days</span></div>';
    }

    /* --------------------------------------------------
       CUSTOM FOOD MODAL
    -------------------------------------------------- */

    function showCustomModal(data) {
        var existing = document.getElementById("mt-custom-modal");
        if (existing) existing.remove();

        var modal = document.createElement("div");
        modal.id = "mt-custom-modal";
        modal.className = "mt-modal-overlay";
        modal.innerHTML = [
            '<div class="mt-modal">',
            '  <div class="mt-modal-header">',
            '    <span>Add Custom Food</span>',
            '    <button class="mt-modal-close">&times;</button>',
            '  </div>',
            '  <div class="mt-modal-body">',
            '    <div class="mt-modal-field">',
            '      <label>Food / Drink Name</label>',
            '      <input type="text" id="mt-custom-food-name" placeholder="e.g. Grandma\'s soup">',
            '    </div>',
            '    <div class="mt-modal-field">',
            '      <label>Calories</label>',
            '      <input type="number" id="mt-custom-food-cal" placeholder="e.g. 250" min="0">',
            '    </div>',
            '    <div class="mt-modal-field">',
            '      <label>Image (optional)</label>',
            '      <div class="mt-modal-img-upload" id="mt-custom-img-area">',
            '        <div class="mt-modal-img-placeholder">Click or drag</div>',
            '        <input type="file" id="mt-custom-img-input" accept="image/*" style="display:none">',
            '        <img id="mt-custom-img-preview" style="display:none">',
            '      </div>',
            '    </div>',
            '  </div>',
            '  <div class="mt-modal-footer">',
            '    <button class="mt-modal-cancel">Cancel</button>',
            '    <button class="mt-modal-confirm">Add Food</button>',
            '  </div>',
            '</div>',
        ].join("");

        document.body.appendChild(modal);
        requestAnimationFrame(function () { modal.classList.add("open"); });

        var nameInput = document.getElementById("mt-custom-food-name");
        var calInput = document.getElementById("mt-custom-food-cal");
        var imgInput = document.getElementById("mt-custom-img-input");
        var imgArea = document.getElementById("mt-custom-img-area");
        var imgPreview = document.getElementById("mt-custom-img-preview");
        var uploadedDataUrl = null;

        // Close
        modal.querySelector(".mt-modal-close").onclick = function () { modal.remove(); };
        modal.querySelector(".mt-modal-cancel").onclick = function () { modal.remove(); };
        modal.addEventListener("click", function (e) { if (e.target === modal) modal.remove(); });

        // Image upload
        imgArea.addEventListener("click", function () { imgInput.click(); });
        imgInput.addEventListener("change", function () {
            var file = imgInput.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function (e) {
                uploadedDataUrl = e.target.result;
                imgPreview.src = uploadedDataUrl;
                imgPreview.style.display = "block";
                modal.querySelector(".mt-modal-img-placeholder").style.display = "none";
            };
            reader.readAsDataURL(file);
        });

        // Confirm
        modal.querySelector(".mt-modal-confirm").onclick = function () {
            var name = nameInput.value.trim();
            var cal = parseInt(calInput.value, 10);
            if (!name) { nameInput.focus(); return; }
            if (isNaN(cal) || cal < 0) { calInput.focus(); return; }

            var img = uploadedDataUrl || "img/food/custom.jpg";

            // Add to FOODS list
            FOODS.push({ name: name, img: img, cal: cal, cat: "custom", isCustom: false, userAdded: true });

            // Add to today's meal
            var day = getDayData(data, currentDate);
            if (!day[activeMeal]) day[activeMeal] = [];
            day[activeMeal].push({ name: name, calories: cal, img: img });

            // Save and re-render
            saveData(data, function () {
                modal.remove();
                render();
            });
        };

        nameInput.focus();
    }

    /* --------------------------------------------------
       EVENTS
    -------------------------------------------------- */

    function bindEvents(container, data) {

        // Tab switching
        container.querySelectorAll(".mt-tab").forEach(function (btn) {
            btn.addEventListener("click", function () {
                activeTab = btn.getAttribute("data-tab");
                render();
            });
        });

        // Date nav
        var prevBtn = document.getElementById("mt-prev-day");
        var nextBtn = document.getElementById("mt-next-day");
        var todayBtn = document.getElementById("mt-today-btn");

        if (prevBtn) prevBtn.onclick = function () { currentDate = shiftDate(currentDate, -1); render(); };
        if (nextBtn) nextBtn.onclick = function () { currentDate = shiftDate(currentDate, 1); render(); };
        if (todayBtn) todayBtn.onclick = function () { currentDate = today(); render(); };

        // Meal selector pills
        container.querySelectorAll(".mt-meal-pill").forEach(function (btn) {
            btn.addEventListener("click", function () {
                activeMeal = btn.getAttribute("data-meal");
                render();
            });
        });

        // Food cards — click to add
        container.querySelectorAll(".mt-food-card").forEach(function (card) {
            card.addEventListener("click", function () {
                var isCustom = card.getAttribute("data-custom") === "1";
                if (isCustom) {
                    showCustomModal(data);
                    return;
                }

                var name = card.getAttribute("data-name");
                var cal = parseInt(card.getAttribute("data-cal"), 10);
                var img = card.getAttribute("data-img");
                var targetMeal = card.getAttribute("data-meal-target") || activeMeal;

                loadData(function (d) {
                    var day = getDayData(d, currentDate);
                    if (!day[targetMeal]) day[targetMeal] = [];
                    day[targetMeal].push({ name: name, calories: cal, img: img });
                    saveData(d, function () { render(); });
                });
            });

            // Right-click to delete custom foods
            card.addEventListener("contextmenu", function (e) {
                var name = card.getAttribute("data-name");
                var isCustomPlaceholder = card.getAttribute("data-custom") === "1";
                if (isCustomPlaceholder) return;

                // Find if this is a user-added food
                var idx = -1;
                for (var i = 0; i < FOODS.length; i++) {
                    if (FOODS[i].name === name && FOODS[i].userAdded) { idx = i; break; }
                }
                if (idx === -1) return;

                e.preventDefault();
                if (confirm('Remove "' + name + '" from your food list?')) {
                    FOODS.splice(idx, 1);
                    render();
                }
            });
        });

        // Delete items (today tab)
        container.querySelectorAll(".mt-today-item-del").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var meal = btn.getAttribute("data-meal");
                var idx = parseInt(btn.getAttribute("data-idx"), 10);
                var day = getDayData(data, currentDate);
                if (day[meal]) {
                    day[meal].splice(idx, 1);
                    saveData(data, function () { render(); });
                }
            });
        });

        // Chart range toggles
        container.querySelectorAll(".mt-chart-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                chartRange = btn.getAttribute("data-range");
                render();
            });
        });
    }

    /* --------------------------------------------------
       INIT
    -------------------------------------------------- */

    function init() {
        currentDate = today();
        activeTab = "add";
        activeMeal = "breakfast";
        render();
    }

    return { init: init, render: render };

})();
