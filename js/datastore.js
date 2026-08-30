/* --------------------------------------------------
   OVERTUREOS ENCRYPTED DATASTORE
   -------------------------------------------------- */

var OvertureStore = (function () {

    var DB_NAME = "overtureos";
    var STORE_NAME = "data";
    var DB_VERSION = 1;

    var db = null;
    var encKey = null;
    var userId = null;

    /* --------------------------------------------------
       IndexedDB INIT
    -------------------------------------------------- */

    function init(uid) {

        userId = uid;

        return new Promise(function (resolve, reject) {

            if (!window.indexedDB) {
                reject(new Error("IndexedDB is required for OvertureOS."));
                return;
            }

            var request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function (event) {

                var database = event.target.result;

                if (!database.objectStoreNames.contains(STORE_NAME)) {

                    var store = database.createObjectStore(STORE_NAME, {
                        keyPath: "id",
                        autoIncrement: true,
                    });

                    store.createIndex("namespace", "namespace", { unique: false });
                    store.createIndex("ns_key", ["namespace", "key"], { unique: true });
                }
            };

            request.onsuccess = function (event) {
                db = event.target.result;
                resolve(db);
            };

            request.onerror = function (event) {
                reject(new Error("IndexedDB open failed: " + event.target.error));
            };
        });
    }

    /* --------------------------------------------------
       ENCRYPTION KEY (set after login)
    -------------------------------------------------- */

    function setEncryptionKey(password, uid) {

        if (uid) {
            userId = uid;
        }

        var enc = new TextEncoder();

        return crypto.subtle.importKey(
            "raw",
            enc.encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
        ).then(function (keyMaterial) {

            var salt = enc.encode("overtureos-salt-" + (userId || "default"));

            return crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: salt,
                    iterations: 260000,
                    hash: "SHA-256",
                },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt", "decrypt"]
            );

        }).then(function (key) {
            encKey = key;
            return key;
        });
    }

    function setEncryptionKeyFromToken(usbToken, uid) {

        if (uid) {
            userId = uid;
        }

        var enc = new TextEncoder();

        return crypto.subtle.importKey(
            "raw",
            enc.encode(usbToken),
            "PBKDF2",
            false,
            ["deriveKey"]
        ).then(function (keyMaterial) {

            var salt = enc.encode("overtureos-salt-" + (userId || "default"));

            return crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: salt,
                    iterations: 260000,
                    hash: "SHA-256",
                },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt", "decrypt"]
            );

        }).then(function (key) {
            encKey = key;
            return key;
        });
    }

    function clearKey() {
        encKey = null;
    }

    function userNs(namespace) {
        return namespace + ":" + (userId || "_anon");
    }

    /* --------------------------------------------------
       ENCRYPT / DECRYPT
    -------------------------------------------------- */

    function encryptValue(value) {

        if (!encKey) {
            return Promise.resolve({
                ciphertext: btoa(JSON.stringify(value)),
                iv: null,
                encrypted: false,
            });
        }

        var iv = crypto.getRandomValues(new Uint8Array(12));
        var enc = new TextEncoder();
        var data = enc.encode(JSON.stringify(value));

        return crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            encKey,
            data
        ).then(function (encrypted) {
            return {
                ciphertext: btoa(
                    String.fromCharCode.apply(null, new Uint8Array(encrypted))
                ),
                iv: btoa(
                    String.fromCharCode.apply(null, iv)
                ),
                encrypted: true,
            };
        });
    }

    function decryptValue(record) {

        if (!record.encrypted || !encKey) {
            try {
                return Promise.resolve(JSON.parse(atob(record.ciphertext)));
            } catch (e) {
                return Promise.resolve(record.ciphertext);
            }
        }

        var ivBytes = new Uint8Array(
            atob(record.iv).split("").map(function (c) {
                return c.charCodeAt(0);
            })
        );

        var dataBytes = new Uint8Array(
            atob(record.ciphertext).split("").map(function (c) {
                return c.charCodeAt(0);
            })
        );

        return crypto.subtle.decrypt(
            { name: "AES-GCM", iv: ivBytes },
            encKey,
            dataBytes
        ).then(function (decrypted) {
            var dec = new TextDecoder();
            return JSON.parse(dec.decode(decrypted));
        });
    }

    /* --------------------------------------------------
       CRUD
    -------------------------------------------------- */

    function get(namespace, key) {

        return new Promise(function (resolve, reject) {

            if (!db) {
                reject(new Error("Store not initialized."));
                return;
            }

            var tx = db.transaction(STORE_NAME, "readonly");
            var store = tx.objectStore(STORE_NAME);
            var index = store.index("ns_key");
            var ns = userNs(namespace);
            var request = index.get([ns, key]);

            request.onsuccess = function () {

                var result = request.result;

                if (!result) {
                    resolve(null);
                    return;
                }

                decryptValue(result)
                    .then(function (val) {
                        resolve(val);
                    })
                    .catch(reject);
            };

            request.onerror = function () {
                reject(new Error("Read failed."));
            };
        });
    }

    function set(namespace, key, value) {

        return new Promise(function (resolve, reject) {

            if (!db) {
                reject(new Error("Store not initialized."));
                return;
            }

            encryptValue(value).then(function (encrypted) {

                var tx = db.transaction(STORE_NAME, "readwrite");
                var store = tx.objectStore(STORE_NAME);
                var index = store.index("ns_key");
                var ns = userNs(namespace);

                var getReq = index.get([ns, key]);

                getReq.onsuccess = function () {

                    var existing = getReq.result;
                    var record;

                    if (existing) {
                        record = {
                            id: existing.id,
                            namespace: ns,
                            key: key,
                            ciphertext: encrypted.ciphertext,
                            iv: encrypted.iv,
                            encrypted: encrypted.encrypted,
                            updatedAt: Date.now(),
                        };
                    } else {
                        record = {
                            namespace: ns,
                            key: key,
                            ciphertext: encrypted.ciphertext,
                            iv: encrypted.iv,
                            encrypted: encrypted.encrypted,
                            updatedAt: Date.now(),
                        };
                    }

                    var putReq = store.put(record);

                    putReq.onsuccess = function () {
                        resolve();
                    };

                    putReq.onerror = function () {
                        reject(new Error("Write failed."));
                    };
                };

                getReq.onerror = function () {
                    reject(new Error("Write lookup failed."));
                };
            });
        });
    }

    function del(namespace, key) {

        return new Promise(function (resolve, reject) {

            if (!db) {
                reject(new Error("Store not initialized."));
                return;
            }

            var tx = db.transaction(STORE_NAME, "readwrite");
            var store = tx.objectStore(STORE_NAME);
            var index = store.index("ns_key");
            var ns = userNs(namespace);
            var request = index.get([ns, key]);

            request.onsuccess = function () {

                var result = request.result;

                if (!result) {
                    resolve();
                    return;
                }

                store.delete(result.id);
                resolve();
            };

            request.onerror = function () {
                reject(new Error("Delete failed."));
            };
        });
    }

    function keys(namespace) {

        return new Promise(function (resolve, reject) {

            if (!db) {
                reject(new Error("Store not initialized."));
                return;
            }

            var tx = db.transaction(STORE_NAME, "readonly");
            var store = tx.objectStore(STORE_NAME);
            var index = store.index("namespace");
            var ns = userNs(namespace);
            var request = index.getAllKeys(ns);

            request.onsuccess = function () {
                resolve(request.result || []);
            };

            request.onerror = function () {
                reject(new Error("Keys query failed."));
            };
        });
    }

    /* --------------------------------------------------
       EXPORT / IMPORT
    -------------------------------------------------- */

    function exportAll() {

        return new Promise(function (resolve, reject) {

            if (!db) {
                reject(new Error("Store not initialized."));
                return;
            }

            var prefix = (userId || "_anon") + ":";
            var tx = db.transaction(STORE_NAME, "readonly");
            var store = tx.objectStore(STORE_NAME);
            var request = store.getAll();

            request.onsuccess = function () {

                var records = (request.result || []).filter(function (rec) {
                    return rec.namespace && rec.namespace.indexOf(prefix) === 0;
                });
                var exportData = {};

                var decryptPromises = records.map(function (rec) {
                    return decryptValue(rec).then(function (val) {
                        var rawNs = rec.namespace.substring(prefix.length);
                        if (!exportData[rawNs]) {
                            exportData[rawNs] = {};
                        }
                        exportData[rawNs][rec.key] = val;
                    });
                });

                Promise.all(decryptPromises).then(function () {
                    resolve({
                        version: 1,
                        userId: userId,
                        exportedAt: new Date().toISOString(),
                        data: exportData,
                    });
                });
            };

            request.onerror = function () {
                reject(new Error("Export failed."));
            };
        });
    }

    function importAll(exportBlob) {

        var importData = exportBlob.data || {};
        var promises = [];

        Object.keys(importData).forEach(function (namespace) {
            Object.keys(importData[namespace]).forEach(function (key) {
                promises.push(
                    set(namespace, key, importData[namespace][key])
                );
            });
        });

        return Promise.all(promises);
    }

    /* --------------------------------------------------
       USB EXPORT / IMPORT
    -------------------------------------------------- */

    function exportToUSB() {

        return exportAll().then(function (data) {
            return OvertureAuth.writeUSBDataFile(data);
        });
    }

    function importFromUSB() {

        return OvertureAuth.readUSBDataFile().then(function (data) {
            return importAll(data);
        });
    }

    /* --------------------------------------------------
       CLEAR
    -------------------------------------------------- */

    function clear() {

        return new Promise(function (resolve, reject) {

            if (!db) {
                reject(new Error("Store not initialized."));
                return;
            }

            var prefix = (userId || "_anon") + ":";
            var tx = db.transaction(STORE_NAME, "readwrite");
            var store = tx.objectStore(STORE_NAME);
            var request = store.getAll();

            request.onsuccess = function () {
                var records = request.result || [];
                records.forEach(function (rec) {
                    if (rec.namespace && rec.namespace.indexOf(prefix) === 0) {
                        store.delete(rec.id);
                    }
                });
                resolve();
            };

            request.onerror = function () {
                reject(new Error("Clear failed."));
            };
        });
    }

    /* --------------------------------------------------
       PUBLIC API
    -------------------------------------------------- */

    return {
        init: init,
        setEncryptionKey: setEncryptionKey,
        setEncryptionKeyFromToken: setEncryptionKeyFromToken,
        clearKey: clearKey,
        get: get,
        set: set,
        delete: del,
        keys: keys,
        exportAll: exportAll,
        importAll: importAll,
        exportToUSB: exportToUSB,
        importFromUSB: importFromUSB,
        clear: clear,
    };

})();
