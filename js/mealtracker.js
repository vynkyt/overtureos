/* --------------------------------------------------
   MEAL TRACKER — OvertureOS
   -------------------------------------------------- */

var MealTracker = (function () {

    /* --------------------------------------------------
       FOOD DATABASE (per 100g unless noted)
    -------------------------------------------------- */

    var FOODS = {

        // Breakfast
        "Egg (1 large, ~50g)":              72,
        "Scrambled eggs (2)":               182,
        "Boiled egg (1)":                   78,
        "Omelette (1)":                     154,
        "Toast (1 slice)":                  79,
        "Butter (1 tbsp)":                  102,
        "Jam (1 tbsp)":                     56,
        "Peanut butter (1 tbsp)":           94,
        "Cereal (1 bowl, ~30g)":            117,
        "Oatmeal (1 bowl, ~200g)":          150,
        "Pancake (1)":                      175,
        "Waffle (1)":                       218,
        "Croissant (1)":                    272,
        "Muffin (1)":                       340,
        "Bagel (1)":                        245,
        "Yoghurt (1 cup, ~150g)":           100,
        "Granola bar (1)":                  190,
        "Banana (1)":                       105,
        "Apple (1)":                        95,
        "Orange (1)":                       62,
        "Strawberries (1 cup)":             49,
        "Blueberries (1 cup)":              84,
        "Milk (1 cup, ~250ml)":             149,
        "Orange juice (1 cup)":             112,
        "Coffee (black)":                   2,
        "Coffee with milk":                 35,
        "Tea (unsweetened)":                2,
        "Smoothie (1 glass)":               180,

        // Lunch / Dinner — Rice & Noodles
        "White rice (1 cup, cooked)":       206,
        "Brown rice (1 cup, cooked)":       216,
        "Fried rice (1 cup)":               238,
        "Pasta (1 cup, cooked)":            220,
        "Spaghetti bolognese (1 cup)":      330,
        "Ramen (1 bowl)":                   430,
        "Udon (1 bowl)":                    380,
        "Fried noodles (1 cup)":            350,

        // Lunch / Dinner — Proteins
        "Chicken breast (100g)":            165,
        "Chicken thigh (100g)":             209,
        "Fried chicken (1 piece)":          320,
        "Grilled chicken (100g)":           165,
        "Beef steak (100g)":                271,
        "Beef burger (1)":                  354,
        "Pork chop (100g)":                 231,
        "Bacon (3 strips)":                 129,
        "Ham (2 slices)":                   60,
        "Sausage (1)":                      150,
        "Fish fillet (100g)":               206,
        "Salmon (100g)":                    208,
        "Shrimp (100g)":                    99,
        "Tofu (100g)":                      76,
        "Egg (1 large)":                    72,
        "Lentils (1 cup, cooked)":          230,
        "Chickpeas (1 cup)":                269,
        "Black beans (1 cup)":              227,

        // Lunch / Dinner — Vegetables
        "Salad (mixed, 1 cup)":             20,
        "Caesar salad (1 serving)":         180,
        "Broccoli (1 cup)":                 55,
        "Carrots (1 cup)":                  52,
        "Corn (1 cup)":                     125,
        "Mashed potatoes (1 cup)":          244,
        "French fries (1 serving)":         365,
        "Sweet potato (1 medium)":          103,
        "Avocado (1)":                      240,
        "Tomato (1 medium)":                22,
        "Cucumber (1 cup)":                 16,
        "Onion (1 medium)":                 44,
        "Spinach (1 cup, raw)":             7,
        "Green beans (1 cup)":              31,

        // Lunch / Dinner — Other
        "Pizza (1 slice, medium)":          285,
        "Taco (1)":                         226,
        "Burrito (1)":                      480,
        "Sandwich (ham & cheese)":          350,
        "Sub sandwich (6 inch)":            360,
        "Soup (1 bowl, tomato)":            120,
        "Soup (1 bowl, chicken noodle)":    190,
        "Sushi (6 pieces)":                 290,
        "Spring roll (2)":                  160,
        "Dumpling (4)":                     220,
        "Fried rice (1 plate)":             350,
        "Curry (1 cup, chicken)":           290,
        "Curry (1 cup, vegetable)":         180,
        "Stir fry (1 cup)":                 250,

        // Snacks
        "Chips (1 bag, small)":             150,
        "Popcorn (1 cup, plain)":           31,
        "Crackers (10)":                    140,
        "Nuts (1 handful, ~30g)":           173,
        "Almonds (30g)":                    173,
        "Cashews (30g)":                    166,
        "Dark chocolate (1 bar, ~50g)":     260,
        "Chocolate bar (1)":                230,
        "Cookie (1)":                       150,
        "Biscuit (1)":                      120,
        "Ice cream (1 scoop)":              137,
        "Cake (1 slice)":                   350,
        "Pie (1 slice)":                    300,
        "Donut (1)":                        250,
        "Candy bar (1)":                    250,
        "Gummy bears (1 handful)":          90,
        "Dried fruit (1/4 cup)":            120,
        "Rice cake (1)":                    35,
        "Hummus (2 tbsp)":                  70,
        "Guacamole (2 tbsp)":              50,
        "Cheese (1 slice, ~20g)":           80,
        "Cheese stick (1)":                 80,
        "Yoghurt (1 cup)":                  100,
        "Protein bar (1)":                  220,
        "Trail mix (1/4 cup)":              175,
        "Pretzels (1 handful)":             110,

        // Drinks
        "Water (500ml)":                    0,
        "Soda (1 can, ~330ml)":             140,
        "Juice (1 cup)":                    112,
        "Lemonade (1 cup)":                 99,
        "Energy drink (1 can)":             110,
        "Milkshake (1)":                    500,
        "Hot chocolate (1 cup)":            190,
        "Smoothie (1)":                     180,
        "Protein shake (1)":                160,
        "Iced tea (1 cup)":                 90,
        "Bubble tea (1)":                   300,
        "Starbucks latte (1, grande)":      190,
        "Frappuccino (1)":                  380,
        "Beer (1, ~330ml)":                 154,
        "Wine (1 glass, ~150ml)":           125,
        "Cocktail (1)":                     200,

        // Malaysian / Asian
        "Nasi lemak (1 plate)":             450,
        "Mee goreng (1 plate)":             400,
        "Char kway teow (1 plate)":         420,
        "Roti canai (1)":                   300,
        "Roti telur (1)":                   350,
        "Mee mamak (1 plate)":              380,
        "Nasi goreng (1 plate)":            400,
        "Laksa (1 bowl)":                   450,
        "Tom yum (1 bowl)":                 180,
        "Satay (5 sticks)":                 250,
        "Fried banana (1)":                 120,
        "Cendol (1 bowl)":                  280,
        "Teh tarik (1 cup)":                160,
        "Kopi o (1 cup)":                   80,
        "Milo (1 cup)":                     170,
        "Teh ais (1 cup)":                  120,
        "Kopi ais (1 cup)":                 130,
        "Bak kut teh (1 bowl)":             350,
        "Hokkien mee (1 plate)":            430,
        "Prawn mee (1 bowl)":               380,
        "Fish soup (1 bowl)":               220,
        "Chicken rice (1 plate)":           450,
        "Wanton mee (1 plate)":             380,
        "Claypot rice (1)":                 500,
        "Porridge (1 bowl)":                200,
        "Moon cake (1)":                    420,
        "Kuih (1 piece)":                   120,
        "Onion ring (1 serving)":           260,
        "Mashed potato (1 serving)":        244,
    };

    var STORAGE_KEY = "mealtracker";

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
        }).catch(function () {
            callback({});
        });
    }

    function saveData(data, callback) {
        if (typeof OvertureStore === "undefined") { if (callback) callback(); return; }
        OvertureStore.set("mealtracker", "data", data).then(function () {
            if (callback) callback();
        }).catch(function () {
            if (callback) callback();
        });
    }

    function getDayData(data, date) {
        if (!data[date]) {
            data[date] = { breakfast: [], lunch: [], dinner: [], snacks: [] };
        }
        return data[date];
    }

    function formatDate(dateStr) {
        var parts = dateStr.split("-");
        var d = new Date(parts[0], parts[1] - 1, parts[2]);
        var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return days[d.getDay()] + ", " + d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
    }

    function shiftDate(dateStr, days) {
        var parts = dateStr.split("-");
        var d = new Date(parts[0], parts[1] - 1, parts[2]);
        d.setDate(d.getDate() + days);
        return d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0");
    }

    /* --------------------------------------------------
       RENDER
    -------------------------------------------------- */

    var currentDate = today();

    function render() {
        var container = document.getElementById("mealtracker-content");
        if (!container) return;

        loadData(function (data) {
            var day = getDayData(data, currentDate);

            var totalCals = 0;
            ["breakfast", "lunch", "dinner", "snacks"].forEach(function (meal) {
                (day[meal] || []).forEach(function (item) {
                    totalCals += item.calories;
                });
            });

            var foodOptions = Object.keys(FOODS).sort().map(function (name) {
                return '<option value="' + name + '">' + name + ' (' + FOODS[name] + ' cal)</option>';
            }).join("");

            container.innerHTML = [
                '<div class="mt-container">',

                // Header
                '<p class="mt-subtitle">~ to fuel my eating disorder ~</p>',
                '  <div class="mt-header">',
                '    <div class="mt-date">' + formatDate(currentDate) + '</div>',
                '    <div class="mt-total"><span class="mt-total-num">' + totalCals + '</span> cal today</div>',
                '  </div>',

                // Date nav
                '  <div class="mt-nav">',
                '    <button class="mt-nav-btn" id="mt-prev-day">&#9664;</button>',
                '    <button class="mt-nav-btn" id="mt-today-btn">Today</button>',
                '    <button class="mt-nav-btn" id="mt-next-day">&#9654;</button>',
                '  </div>',

                // Meal sections
                renderMealSection("breakfast", "Breakfast", day.breakfast),
                renderMealSection("lunch", "Lunch", day.lunch),
                renderMealSection("dinner", "Dinner", day.dinner),
                renderMealSection("snacks", "Snacks", day.snacks),

                // Quick add
                '  <div class="mt-quick-add">',
                '    <div class="mt-quick-row">',
                '      <select id="mt-food-select"><option value="">-- pick a food --</option>' + foodOptions + '<option value="__custom">Custom food...</option></select>',
                '      <input type="number" id="mt-custom-cals" placeholder="custom cal" min="0" style="display:none;">',
                '      <input type="text" id="mt-custom-name" placeholder="custom food name" style="display:none;">',
                '      <select id="mt-meal-select">',
                '        <option value="breakfast">Breakfast</option>',
                '        <option value="lunch">Lunch</option>',
                '        <option value="dinner">Dinner</option>',
                '        <option value="snacks">Snacks</option>',
                '      </select>',
                '      <button class="mt-add-btn" id="mt-add-btn">+ Add</button>',
                '    </div>',
                '  </div>',

                // Chart
                '  <div class="mt-chart-section">',
                '    <div class="mt-chart-header">',
                '      <span class="mt-chart-title">Calorie Trends</span>',
                '      <div class="mt-chart-toggles">',
                '        <button class="mt-chart-btn active" data-range="weekly">Weekly</button>',
                '        <button class="mt-chart-btn" data-range="monthly">Monthly</button>',
                '        <button class="mt-chart-btn" data-range="yearly">Yearly</button>',
                '      </div>',
                '    </div>',
                '    <div class="mt-chart-wrap">',
                '      <canvas id="mt-chart" width="600" height="200"></canvas>',
                '    </div>',
                '    <div id="mt-chart-stats" class="mt-chart-stats"></div>',
                '  </div>',

                '</div>',
            ].join("");

            bindEvents(container, data);

            // Render chart after DOM is ready
            setTimeout(function () { renderChart(data); }, 0);
        });
    }

    function renderMealSection(meal, label, items) {
        var mealCals = 0;
        (items || []).forEach(function (item) { mealCals += item.calories; });

        var rows = "";
        (items || []).forEach(function (item, i) {
            rows += '<div class="mt-item">' +
                '<span class="mt-item-name">' + item.name + '</span>' +
                '<span class="mt-item-cals">' + item.calories + ' cal</span>' +
                '<button class="mt-item-del" data-meal="' + meal + '" data-idx="' + i + '">&times;</button>' +
                '</div>';
        });

        return [
            '  <div class="mt-meal">',
            '    <div class="mt-meal-header">',
            '      <span class="mt-meal-title">' + label + '</span>',
            '      <span class="mt-meal-cals">' + mealCals + ' cal</span>',
            '    </div>',
            '    <div class="mt-meal-items">' + (rows || '<div class="mt-empty">No items yet</div>') + '</div>',
            '  </div>',
        ].join("");
    }

    /* --------------------------------------------------
       CHART
    -------------------------------------------------- */

    var chartRange = "weekly";

    function dayTotalCals(data, dateStr) {
        var day = data[dateStr];
        if (!day) return 0;
        var total = 0;
        ["breakfast", "lunch", "dinner", "snacks"].forEach(function (meal) {
            (day[meal] || []).forEach(function (item) { total += item.calories; });
        });
        return total;
    }

    function getChartData(data, range) {
        var labels = [];
        var values = [];
        var now = new Date();

        if (range === "weekly") {
            for (var i = 6; i >= 0; i--) {
                var d = new Date(now);
                d.setDate(d.getDate() - i);
                var key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
                var dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                labels.push(dayNames[d.getDay()] + "\n" + d.getDate() + "/" + (d.getMonth() + 1));
                values.push(dayTotalCals(data, key));
            }
        } else if (range === "monthly") {
            for (var i = 29; i >= 0; i--) {
                var d = new Date(now);
                d.setDate(d.getDate() - i);
                var key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
                labels.push(d.getDate() + "/" + (d.getMonth() + 1));
                values.push(dayTotalCals(data, key));
            }
        } else if (range === "yearly") {
            var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            var curMonth = now.getMonth();
            var curYear = now.getFullYear();
            for (var i = 11; i >= 0; i--) {
                var m = (curMonth - i + 12) % 12;
                var y = curMonth - i < 0 ? curYear - 1 : curYear;
                var total = 0;
                var count = 0;
                var daysInMonth = new Date(y, m + 1, 0).getDate();
                for (var day = 1; day <= daysInMonth; day++) {
                    var key = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
                    var t = dayTotalCals(data, key);
                    if (t > 0) { total += t; count++; }
                }
                labels.push(monthNames[m] + " " + y);
                values.push(count > 0 ? Math.round(total / count) : 0);
            }
        }

        return { labels: labels, values: values };
    }

    function renderChart(data) {
        var canvas = document.getElementById("mt-chart");
        var statsEl = document.getElementById("mt-chart-stats");
        if (!canvas || !statsEl) return;

        var ctx = canvas.getContext("2d");
        var wrap = canvas.parentElement;
        var W = wrap.clientWidth || 600;
        var H = 200;
        canvas.width = W;
        canvas.height = H;

        var chartData = getChartData(data, chartRange);
        var labels = chartData.labels;
        var values = chartData.values;

        var maxVal = Math.max.apply(null, values);
        if (maxVal === 0) maxVal = 2000;
        maxVal = Math.ceil(maxVal / 500) * 500;

        var padL = 50, padR = 16, padT = 16, padB = 40;
        var chartW = W - padL - padR;
        var chartH = H - padT - padB;
        var barW = Math.max(2, (chartW / labels.length) - 3);

        ctx.clearRect(0, 0, W, H);

        // Grid lines
        ctx.strokeStyle = "rgba(135,42,78,0.1)";
        ctx.lineWidth = 1;
        ctx.font = "10px Balsamiq Sans, sans-serif";
        ctx.fillStyle = "rgba(135,42,78,0.5)";
        ctx.textAlign = "right";

        var gridLines = 4;
        for (var i = 0; i <= gridLines; i++) {
            var y = padT + chartH - (chartH * i / gridLines);
            var val = Math.round(maxVal * i / gridLines);
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(W - padR, y);
            ctx.stroke();
            ctx.fillText(val, padL - 6, y + 3);
        }

        // Bars
        var gap = chartW / labels.length;
        var barColors = ["#e84393", "#fd79a8", "#fab1a0", "#ff7675", "#fdcb6e", "#55efc4", "#74b9ff", "#a29bfe"];

        for (var i = 0; i < labels.length; i++) {
            var x = padL + i * gap + (gap - barW) / 2;
            var barH = (values[i] / maxVal) * chartH;
            var y = padT + chartH - barH;

            // Bar gradient
            var grad = ctx.createLinearGradient(x, y, x, padT + chartH);
            grad.addColorStop(0, "#e84393");
            grad.addColorStop(1, "rgba(232,67,147,0.3)");
            ctx.fillStyle = grad;

            // Rounded top
            var r = Math.min(4, barW / 2, barH / 2);
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + barW - r, y);
            ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
            ctx.lineTo(x + barW, padT + chartH);
            ctx.lineTo(x, padT + chartH);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.fill();

            // Value on top
            if (values[i] > 0) {
                ctx.fillStyle = "#4a1a2e";
                ctx.font = "9px Balsamiq Sans, sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(values[i], x + barW / 2, y - 4);
            }

            // Label below
            ctx.fillStyle = "rgba(135,42,78,0.6)";
            ctx.font = "9px Balsamiq Sans, sans-serif";
            ctx.textAlign = "center";
            var labelLines = labels[i].split("\n");
            for (var l = 0; l < labelLines.length; l++) {
                ctx.fillText(labelLines[l], x + barW / 2, padT + chartH + 12 + l * 11);
            }
        }

        // Stats
        var nonZero = values.filter(function (v) { return v > 0; });
        var avg = nonZero.length > 0 ? Math.round(nonZero.reduce(function (a, b) { return a + b; }, 0) / nonZero.length) : 0;
        var peak = Math.max.apply(null, values);
        var total = values.reduce(function (a, b) { return a + b; }, 0);
        statsEl.innerHTML =
            '<div class="mt-stat"><span class="mt-stat-val">' + avg + '</span><span class="mt-stat-lbl">avg cal/day</span></div>' +
            '<div class="mt-stat"><span class="mt-stat-val">' + peak + '</span><span class="mt-stat-lbl">peak</span></div>' +
            '<div class="mt-stat"><span class="mt-stat-val">' + total + '</span><span class="mt-stat-lbl">total</span></div>' +
            '<div class="mt-stat"><span class="mt-stat-val">' + nonZero.length + '</span><span class="mt-stat-lbl">days logged</span></div>';
    }

    /* --------------------------------------------------
       EVENTS
    -------------------------------------------------- */

    function bindEvents(container, data) {

        // Add food
        var addBtn = document.getElementById("mt-add-btn");
        var foodSelect = document.getElementById("mt-food-select");
        var mealSelect = document.getElementById("mt-meal-select");
        var customCals = document.getElementById("mt-custom-cals");
        var customName = document.getElementById("mt-custom-name");

        if (foodSelect) {
            foodSelect.addEventListener("change", function () {
                if (foodSelect.value === "__custom") {
                    customCals.style.display = "";
                    customName.style.display = "";
                } else {
                    customCals.style.display = "none";
                    customName.style.display = "none";
                }
            });
        }

        if (addBtn) {
            addBtn.addEventListener("click", function () {
                var name, cals;

                if (foodSelect && foodSelect.value === "__custom") {
                    name = customName.value.trim();
                    cals = parseInt(customCals.value, 10);
                    if (!name || isNaN(cals) || cals < 0) {
                        alert("Enter a food name and calorie count.");
                        return;
                    }
                } else if (foodSelect && foodSelect.value) {
                    name = foodSelect.value;
                    cals = FOODS[name];
                } else {
                    alert("Pick a food from the list.");
                    return;
                }

                var meal = mealSelect ? mealSelect.value : "snacks";
                var dayData = getDayData(data, currentDate);
                if (!dayData[meal]) dayData[meal] = [];
                dayData[meal].push({ name: name, calories: cals });
                saveData(data, function () { render(); });
            });
        }

        // Delete items
        container.querySelectorAll(".mt-item-del").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var meal = btn.getAttribute("data-meal");
                var idx = parseInt(btn.getAttribute("data-idx"), 10);
                var dayData = getDayData(data, currentDate);
                if (dayData[meal]) {
                    dayData[meal].splice(idx, 1);
                    saveData(data, function () { render(); });
                }
            });
        });

        // Date navigation
        var prevBtn = document.getElementById("mt-prev-day");
        var nextBtn = document.getElementById("mt-next-day");
        var todayBtn = document.getElementById("mt-today-btn");

        if (prevBtn) {
            prevBtn.addEventListener("click", function () {
                currentDate = shiftDate(currentDate, -1);
                render();
            });
        }

        if (todayBtn) {
            todayBtn.addEventListener("click", function () {
                currentDate = today();
                render();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener("click", function () {
                currentDate = shiftDate(currentDate, 1);
                render();
            });
        }

        // Chart range toggles
        container.querySelectorAll(".mt-chart-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                container.querySelectorAll(".mt-chart-btn").forEach(function (b) { b.classList.remove("active"); });
                btn.classList.add("active");
                chartRange = btn.getAttribute("data-range");
                renderChart(data);
            });
        });
    }

    /* --------------------------------------------------
       INIT
    -------------------------------------------------- */

    function init() {
        currentDate = today();
        render();
    }

    return {
        init: init,
        render: render,
        FOODS: FOODS,
    };

})();
