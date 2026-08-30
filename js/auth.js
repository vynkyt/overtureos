/* --------------------------------------------------
   OVERTUREOS AUTH SYSTEM
   -------------------------------------------------- */

var OvertureAuth = (function () {

    var currentUser = null;
    var currentMethod = null;
    var encKeyReady = false;
    var usbDirHandle = null;

    /* --------------------------------------------------
       API HELPER
    -------------------------------------------------- */

    function authAPI(action, body) {

        var url = "/api/auth?action=" + encodeURIComponent(action);

        var opts = {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
        };

        if (body) {
            opts.body = JSON.stringify(body);
        }

        return fetch(url, opts).then(function (res) {
            return res.text().then(function (text) {
                try {
                    var data = JSON.parse(text);
                } catch (e) {
                    throw new Error("Server error. Please try again later.");
                }
                if (!data.ok) {
                    throw new Error(data.error || "Auth request failed.");
                }
                return data;
            });
        });
    }

    /* --------------------------------------------------
       SESSION CHECK
    -------------------------------------------------- */

    function checkSession() {

        return fetch("/api/auth?action=session", {
            credentials: "include",
        })
        .then(function (res) {
            return res.text().then(function (text) {
                try { return JSON.parse(text); }
                catch (e) { return { ok: false }; }
            });
        })
        .then(function (data) {
            if (data.ok) {
                currentUser = data.userId;
                currentMethod = data.method;
                return { loggedIn: true, userId: currentUser, method: currentMethod };
            }
            return { loggedIn: false };
        })
        .catch(function () {
            return { loggedIn: false };
        });
    }

    /* --------------------------------------------------
       REGISTER
    -------------------------------------------------- */

    function register(email, password) {

        return authAPI("register", {
            email: email,
            password: password,
        }).then(function (data) {
            currentUser = data.userId;
            currentMethod = data.method;
            return data;
        });
    }

    /* --------------------------------------------------
       LOGIN (password)
    -------------------------------------------------- */

    function login(email, password) {

        return authAPI("login", {
            email: email,
            password: password,
        }).then(function (data) {
            currentUser = data.userId;
            currentMethod = data.method;
            return data;
        });
    }

    /* --------------------------------------------------
       LOGIN (USB)
    -------------------------------------------------- */

    function loginWithUSB(email, usbToken) {

        return authAPI("usb-login", {
            email: email,
            usbToken: usbToken,
        }).then(function (data) {
            currentUser = data.userId;
            currentMethod = data.method;
            return data;
        });
    }

    /* --------------------------------------------------
       SETUP USB KEY
    -------------------------------------------------- */

    function setupUSB(usbToken) {

        return authAPI("setup-usb", {
            usbToken: usbToken,
        }).then(function (data) {
            currentUser = data.userId;
            currentMethod = data.method;
            return data;
        });
    }

    /* --------------------------------------------------
       SWITCH TO PASSWORD
    -------------------------------------------------- */

    function switchToPassword(newPassword) {

        return authAPI("switch-to-password", {
            newPassword: newPassword,
        }).then(function (data) {
            currentUser = data.userId;
            currentMethod = data.method;
            return data;
        });
    }

    /* --------------------------------------------------
       LOGOUT
    -------------------------------------------------- */

    function logout() {

        var saveToUSB = Promise.resolve();

        if (currentMethod === "usb" && encKeyReady && typeof OvertureStore !== "undefined") {
            saveToUSB = OvertureStore.exportToUSB().catch(function (err) {
                console.warn("Auto-save to USB failed on logout:", err.message);
            });
        }

        return saveToUSB.then(function () {
            return authAPI("logout");
        }).then(function () {
            currentUser = null;
            currentMethod = null;
            encKeyReady = false;
            OvertureStore.clearKey();
        });
    }

    /* --------------------------------------------------
       USB FILE READING
    -------------------------------------------------- */

    function readUSBKeyFile() {

        if (!window.showDirectoryPicker) {
            return Promise.reject(
                new Error("USB passkey requires Chrome or Edge.")
            );
        }

        return window.showDirectoryPicker({ mode: "read" })
            .then(function (dirHandle) {

                usbDirHandle = dirHandle;

                return dirHandle.getFileHandle(".overtureos-key")
                    .then(function (fileHandle) {

                        return fileHandle.getFile();

                    }).then(function (file) {

                        return file.text();

                    }).then(function (text) {

                        var data = JSON.parse(text);

                        if (!data.email || !data.token) {
                            throw new Error(
                                "Invalid key file. Missing email or token."
                            );
                        }

                        return data;
                    });
            });
    }

    function readUSBDataFile() {

        if (!window.showDirectoryPicker) {
            return Promise.reject(
                new Error("USB requires Chrome or Edge.")
            );
        }

        return window.showDirectoryPicker({ mode: "read" })
            .then(function (dirHandle) {

                return dirHandle.getFileHandle(".overtureos-data.json")
                    .then(function (fileHandle) {

                        return fileHandle.getFile();

                    }).then(function (file) {

                        return file.text();

                    }).then(function (text) {

                        return JSON.parse(text);
                    });
            });
    }

    function writeUSBDataFile(data) {

        var content = JSON.stringify(data, null, 2);

        if (usbDirHandle) {
            return usbDirHandle.getFileHandle(
                ".overtureos-data.json",
                { create: true }
            ).then(function (fileHandle) {
                return fileHandle.createWritable();
            }).then(function (writable) {
                return writable.write(content).then(function () {
                    return writable.close();
                });
            });
        }

        if (!window.showDirectoryPicker) {
            return Promise.reject(
                new Error("USB requires Chrome or Edge.")
            );
        }

        return window.showDirectoryPicker({ mode: "readwrite" })
            .then(function (dirHandle) {

                usbDirHandle = dirHandle;

                return dirHandle.getFileHandle(
                    ".overtureos-data.json",
                    { create: true }
                );

            }).then(function (fileHandle) {

                return fileHandle.createWritable();

            }).then(function (writable) {

                return writable.write(content).then(function () {
                    return writable.close();
                });
            });
    }

    /* --------------------------------------------------
       RENDER UNLOCK SCREEN (session valid, need password/USB for enc key)
    -------------------------------------------------- */

    function renderUnlockScreen() {

        var overlay = document.getElementById("auth-overlay");

        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "auth-overlay";
            document.body.appendChild(overlay);
        }

        var isUSB = currentMethod === "usb";

        overlay.innerHTML = [
            '<div class="auth-card">',
            '  <h1>OvertureOS</h1>',
            '  <p class="auth-subtitle">welcome back, ' + (currentUser || "") + '</p>',
            '',
            isUSB
                ? '  <p style="color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:16px;">Select your USB drive to unlock</p>'
                : '  <div class="auth-field">',
                '    <label for="auth-password">Password</label>',
                '    <input type="password" id="auth-password" placeholder="Enter password to unlock" autocomplete="current-password">',
                '  </div>',
            '  <div class="auth-error" id="auth-error"></div>',
            '  <div class="auth-loading" id="auth-loading">Unlocking...</div>',
            isUSB
                ? '  <button class="auth-btn auth-btn-usb" id="auth-unlock-btn">Select USB Drive</button>'
                : '  <button class="auth-btn auth-btn-primary" id="auth-unlock-btn">Unlock</button>',
            '  <p class="auth-toggle"><a id="auth-switch-account">Use a different account</a></p>',
            '</div>',
        ].join("\n");

        var unlockBtn = document.getElementById("auth-unlock-btn");
        var errorEl = document.getElementById("auth-error");
        var loadingEl = document.getElementById("auth-loading");
        var switchLink = document.getElementById("auth-switch-account");

        function showError(msg) {
            errorEl.textContent = msg;
            errorEl.className = "auth-error visible";
        }

        if (isUSB) {

            unlockBtn.addEventListener("click", function () {

                errorEl.className = "auth-error";
                loadingEl.className = "auth-loading visible";

                readUSBKeyFile()
                    .then(function (keyData) {
                        return OvertureStore.setEncryptionKeyFromToken(keyData.token, currentUser);
                    })
                    .then(function () {
                        encKeyReady = true;
                        hideLoginScreen();
                    })
                    .catch(function (err) {
                        if (err.name === "AbortError") return;
                        loadingEl.className = "auth-loading";
                        showError(err.message);
                    });
            });

        } else {

            var passwordInput = document.getElementById("auth-password");

            unlockBtn.addEventListener("click", function () {

                var password = passwordInput.value;

                errorEl.className = "auth-error";

                if (!password) {
                    showError("Please enter your password.");
                    return;
                }

                loadingEl.className = "auth-loading visible";

                OvertureStore.setEncryptionKey(password, currentUser)
                    .then(function () {
                        encKeyReady = true;
                        hideLoginScreen();
                    })
                    .catch(function (err) {
                        loadingEl.className = "auth-loading";
                        showError(err.message);
                    });
            });

            passwordInput.addEventListener("keydown", function (e) {
                if (e.key === "Enter") {
                    unlockBtn.click();
                }
            });
        }

        switchLink.addEventListener("click", function () {
            logout().then(function () {
                showLoginScreen();
            });
        });

        overlay.classList.remove("hidden");
    }

    /* --------------------------------------------------
       AUTO-SAVE TO USB ON TAB CLOSE
    -------------------------------------------------- */

    function setupAutoSave() {

        window.addEventListener("beforeunload", function () {

            if (currentMethod !== "usb" || !encKeyReady || !usbDirHandle) {
                return;
            }

            if (typeof OvertureStore === "undefined") {
                return;
            }

            OvertureStore.exportToUSB().catch(function () {});
        });
    }

    /* --------------------------------------------------
       LOGIN SCREEN RENDERING
    -------------------------------------------------- */

    function renderLoginScreen() {

        var overlay = document.getElementById("auth-overlay");

        if (!overlay) {

            overlay = document.createElement("div");
            overlay.id = "auth-overlay";

            overlay.innerHTML = [
                '<div class="auth-card">',
                '  <h1>OvertureOS</h1>',
                '  <p class="auth-subtitle">your story begins here</p>',
                '',
                '  <div id="auth-form-login">',
                '    <div class="auth-field">',
                '      <label for="auth-email">Email</label>',
                '      <input type="email" id="auth-email" placeholder="you@example.com" autocomplete="email">',
                '    </div>',
                '    <div class="auth-field" id="auth-password-field">',
                '      <label for="auth-password">Password</label>',
                '      <input type="password" id="auth-password" placeholder="Your password" autocomplete="current-password">',
                '    </div>',
                '    <div class="auth-remember">',
                '      <label><input type="checkbox" id="auth-remember-cb"> Remember me</label>',
                '    </div>',
                '    <div class="auth-error" id="auth-error"></div>',
                '    <div class="auth-success" id="auth-success"></div>',
                '    <div class="auth-loading" id="auth-loading">Loading...</div>',
                '    <button class="auth-btn auth-btn-primary" id="auth-submit-btn">Login with Password</button>',
                '    <div class="auth-divider"><span>or</span></div>',
                '    <button class="auth-btn auth-btn-usb" id="auth-usb-btn">Login with USB Drive</button>',
                '    <p class="auth-toggle">No account? <a id="auth-toggle-link">Sign up</a></p>',
                '  </div>',
                '</div>',
            ].join("\n");

            document.body.appendChild(overlay);
        }

        var emailInput = document.getElementById("auth-email");
        var passwordInput = document.getElementById("auth-password");
        var passwordField = document.getElementById("auth-password-field");
        var submitBtn = document.getElementById("auth-submit-btn");
        var usbBtn = document.getElementById("auth-usb-btn");
        var toggleLink = document.getElementById("auth-toggle-link");
        var errorEl = document.getElementById("auth-error");
        var successEl = document.getElementById("auth-success");
        var loadingEl = document.getElementById("auth-loading");
        var rememberCb = document.getElementById("auth-remember-cb");

        var isSignUp = false;

        var savedCreds = null;
        try { savedCreds = JSON.parse(localStorage.getItem("overtureos_saved")); } catch (e) {}
        if (savedCreds && savedCreds.email) {
            emailInput.value = savedCreds.email;
            if (savedCreds.password) {
                passwordInput.value = savedCreds.password;
                rememberCb.checked = true;
            }
        }

        function clearMessages() {
            errorEl.className = "auth-error";
            successEl.className = "auth-success";
            loadingEl.className = "auth-loading";
        }

        function showError(msg) {
            clearMessages();
            errorEl.textContent = msg;
            errorEl.className = "auth-error visible";
        }

        function showLoading(msg) {
            clearMessages();
            loadingEl.textContent = msg || "Loading...";
            loadingEl.className = "auth-loading visible";
        }

        toggleLink.addEventListener("click", function () {
            isSignUp = !isSignUp;
            clearMessages();

            if (isSignUp) {
                submitBtn.textContent = "Sign Up";
                passwordField.querySelector("label").textContent = "Create Password";
                toggleLink.textContent = "Log in instead";
            } else {
                submitBtn.textContent = "Login with Password";
                passwordField.querySelector("label").textContent = "Password";
                toggleLink.textContent = "Sign up";
            }
        });

        submitBtn.addEventListener("click", function () {

            var email = emailInput.value.trim();
            var password = passwordInput.value;

            clearMessages();

            if (!email) {
                showError("Please enter your email.");
                return;
            }

            if (!password) {
                showError("Please enter your password.");
                return;
            }

            showLoading(isSignUp ? "Creating account..." : "Logging in...");

            var action = isSignUp ? register(email, password) : login(email, password);

            action
                .then(function () {
                    if (rememberCb.checked) {
                        localStorage.setItem("overtureos_saved", JSON.stringify({ email: email, password: password }));
                    } else {
                        localStorage.removeItem("overtureos_saved");
                    }
                    return OvertureStore.setEncryptionKey(password, email);
                })
                .then(function () {
                    encKeyReady = true;
                    hideLoginScreen();
                })
                .catch(function (err) {
                    showError(err.message);
                });
        });

        usbBtn.addEventListener("click", function () {

            var email = emailInput.value.trim();

            clearMessages();

            if (!email) {
                showError("Please enter your email first.");
                return;
            }

            showLoading("Reading USB drive...");

            readUSBKeyFile()
                .then(function (keyData) {

                    if (keyData.email.toLowerCase() !== email.toLowerCase()) {
                        throw new Error(
                            "Email does not match the USB key. Expected: " + keyData.email
                        );
                    }

                    showLoading("Authenticating...");
                    return loginWithUSB(email, keyData.token);
                })
                .then(function () {
                    return OvertureStore.setEncryptionKeyFromToken(keyData.token, email);
                })
                .then(function () {
                    encKeyReady = true;
                    hideLoginScreen();
                })
                .catch(function (err) {
                    if (err.name === "AbortError") return;
                    showError(err.message);
                });
        });

        passwordInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                submitBtn.click();
            }
        });

        emailInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                if (isSignUp || passwordInput.value) {
                    submitBtn.click();
                } else {
                    passwordInput.focus();
                }
            }
        });

        overlay.classList.remove("hidden");
    }

    var onUnlockCallback = null;

    function hideLoginScreen() {

        var overlay = document.getElementById("auth-overlay");

        if (overlay) {
            overlay.classList.add("hidden");
        }

        var desktop = document.getElementById("desktop");

        if (desktop) {
            desktop.style.display = "block";
        }

        if (onUnlockCallback) {
            onUnlockCallback();
            onUnlockCallback = null;
        }
    }

    function showLoginScreen() {

        var desktop = document.getElementById("desktop");

        if (desktop) {
            desktop.style.display = "none";
        }

        var overlay = document.getElementById("auth-overlay");

        if (overlay) {
            overlay.classList.remove("hidden");
        } else {
            renderLoginScreen();
        }
    }

    /* --------------------------------------------------
       INIT (called on page load)
    -------------------------------------------------- */

    function init() {

        var desktop = document.getElementById("desktop");

        if (desktop) {
            desktop.style.display = "none";
        }

        setupAutoSave();

        return checkSession().then(function (result) {

            if (result.loggedIn) {
                renderUnlockScreen();
                return result;
            }

            showLoginScreen();
            return result;
        });
    }

    /* --------------------------------------------------
       PUBLIC API
    -------------------------------------------------- */

    return {
        init: init,
        checkSession: checkSession,
        register: register,
        login: login,
        loginWithUSB: loginWithUSB,
        logout: logout,
        setupUSB: setupUSB,
        switchToPassword: switchToPassword,
        readUSBKeyFile: readUSBKeyFile,
        readUSBDataFile: readUSBDataFile,
        writeUSBDataFile: writeUSBDataFile,
        showLoginScreen: showLoginScreen,
        hideLoginScreen: hideLoginScreen,
        onUnlock: function (fn) { onUnlockCallback = fn; },
        getUser: function () { return currentUser; },
        getMethod: function () { return currentMethod; },
        isKeyReady: function () { return encKeyReady; },
    };

})();
