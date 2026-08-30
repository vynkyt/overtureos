import os
import json
import hashlib
import hmac
import secrets
import base64
import time
import urllib.request
import urllib.parse
import urllib.error
from http.server import BaseHTTPRequestHandler


# ---------------------------------------------------------
# CONFIG
# ---------------------------------------------------------

NOTION_API_KEY = os.environ.get("NOTION_API_KEY")
NOTION_VERSION = "2026-03-11"
NOTION_BASE = "https://api.notion.com/v1"
NOTION_USERS_DB_ID = os.environ.get("NOTION_USERS_DB_ID")
SESSION_SECRET = os.environ.get("SESSION_SECRET", "")

SESSION_MAX_AGE = 86400 * 7  # 7 days
PASSWORD_ITERATIONS = 260000
ALGORITHM = "pbkdf2_sha256"


# ---------------------------------------------------------
# NOTION REQUEST HELPER (same as notion.py)
# ---------------------------------------------------------

def notion_request(method, endpoint, body=None):

    if not NOTION_API_KEY:
        raise RuntimeError("NOTION_API_KEY is not configured.")

    url = NOTION_BASE + endpoint

    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }

    data = None

    if body is not None:
        data = json.dumps(body).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")

            if not raw:
                return {}

            return json.loads(raw)

    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8")

        try:
            error_json = json.loads(error_body)
        except Exception:
            error_json = {"message": error_body}

        raise RuntimeError(
            f"Notion API error {error.code}: "
            f"{error_json.get('message', 'Unknown error')}"
        )

    except urllib.error.URLError as error:
        raise RuntimeError(
            f"Could not connect to Notion: {error.reason}"
        )


# ---------------------------------------------------------
# PASSWORD HASHING (stdlib only, no bcrypt)
# ---------------------------------------------------------

def hash_password(password, salt=None, iterations=PASSWORD_ITERATIONS):

    if salt is None:
        salt = secrets.token_hex(16)

    pw_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    )

    b64_hash = base64.b64encode(pw_hash).decode("ascii").strip()

    return f"{ALGORITHM}${iterations}${salt}${b64_hash}"


def verify_password(password, stored_hash):

    if (stored_hash or "").count("$") != 3:
        return False

    algorithm, iterations, salt, b64_hash = stored_hash.split("$", 3)
    iterations = int(iterations)

    if algorithm != ALGORITHM:
        return False

    compare_hash = hash_password(password, salt, iterations)

    return hmac.compare_digest(stored_hash, compare_hash)


# ---------------------------------------------------------
# SESSION TOKENS (HMAC-signed, stateless)
# ---------------------------------------------------------

def create_session_token(user_id, method):

    if not SESSION_SECRET:
        raise RuntimeError("SESSION_SECRET is not configured.")

    payload = {
        "uid": user_id,
        "method": method,
        "exp": int(time.time()) + SESSION_MAX_AGE,
    }

    payload_b64 = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).decode().rstrip("=")

    signature = hmac.new(
        SESSION_SECRET.encode(),
        payload_b64.encode(),
        hashlib.sha256,
    ).hexdigest()

    return f"{payload_b64}.{signature}"


def verify_session_token(token):

    if not SESSION_SECRET or "." not in token:
        return None

    try:
        payload_b64, signature = token.split(".", 1)

        expected = hmac.new(
            SESSION_SECRET.encode(),
            payload_b64.encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(signature, expected):
            return None

        padded = payload_b64 + "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))

        if payload.get("exp", 0) < time.time():
            return None

        return payload

    except Exception:
        return None


# ---------------------------------------------------------
# NOTION USER DB HELPERS
# ---------------------------------------------------------

def query_user_by_email(email):

    if not NOTION_USERS_DB_ID:
        raise RuntimeError("NOTION_USERS_DB_ID is not configured.")

    db_id = NOTION_USERS_DB_ID.strip().replace("-", "")
    target = email.strip().lower()

    body = {
        "page_size": 100,
    }

    result = None

    for endpoint in [f"/databases/{db_id}/query", f"/data_sources/{db_id}/query"]:

        try:
            result = notion_request("POST", endpoint, body)
            break
        except Exception:
            continue

    if result is None:
        raise RuntimeError("Could not query Users database.")

    for page in result.get("results", []):

        if page.get("in_trash"):
            continue

        title = get_user_property(page, "title")

        if title.lower() == target:
            return page

    return None


def extract_title(page):
    top_title = page.get("title")
    if isinstance(top_title, list) and top_title:
        return "".join(p.get("plain_text", "") for p in top_title).strip()
    for prop in page.get("properties", {}).values():
        if prop.get("type") == "title":
            return "".join(p.get("plain_text", "") for p in prop.get("title", [])).strip()
    return ""


def get_user_property(page, prop_name):

    props = page.get("properties", {})

    for prop_id, prop in props.items():

        if prop.get("name") == prop_name or prop_id == prop_name:

            ptype = prop.get("type")

            if ptype == "title":
                parts = prop.get("title", [])
                return "".join(
                    p.get("plain_text", "") for p in parts
                ).strip()

            if ptype == "rich_text":
                parts = prop.get("rich_text", [])
                return "".join(
                    p.get("plain_text", "") for p in parts
                ).strip()

            if ptype == "select":
                sel = prop.get("select")
                return sel.get("name", "") if sel else ""

            if ptype == "date":
                d = prop.get("date")
                return d.get("start", "") if d else ""

    return ""


def create_user_page(email, password_hash="", usb_key_hash="", auth_method="password"):

    if not NOTION_USERS_DB_ID:
        raise RuntimeError("NOTION_USERS_DB_ID is not configured.")

    db_id = NOTION_USERS_DB_ID.strip().replace("-", "")

    now_iso = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())

    properties = {
        "title": {
            "title": [
                {
                    "text": {
                        "content": email.strip().lower(),
                    },
                },
            ],
        },
    }

    if password_hash:
        properties["Password Hash"] = {
            "rich_text": [
                {
                    "text": {
                        "content": password_hash,
                    },
                },
            ],
        }

    if usb_key_hash:
        properties["USB Key Hash"] = {
            "rich_text": [
                {
                    "text": {
                        "content": usb_key_hash,
                    },
                },
            ],
        }

    properties["Auth Method"] = {
        "select": {
            "name": auth_method,
        },
    }

    properties["Created At"] = {
        "date": {
            "start": now_iso,
        },
    }

    return notion_request(
        "POST",
        "/pages",
        {
            "parent": {
                "database_id": db_id,
            },
            "properties": properties,
        },
    )


def update_user_page(page_id, properties):

    return notion_request(
        "PATCH",
        f"/pages/{page_id}",
        {"properties": properties},
    )


# ---------------------------------------------------------
# RESPONSE HELPERS
# ---------------------------------------------------------

def send_json(handler, status, data, extra_headers=None):

    payload = json.dumps(
        data, ensure_ascii=False
    ).encode("utf-8")

    handler.send_response(status)

    handler.send_header(
        "Content-Type",
        "application/json; charset=utf-8",
    )

    handler.send_header(
        "Cache-Control",
        "no-store",
    )

    handler.send_header(
        "Access-Control-Allow-Origin",
        "*",
    )

    if extra_headers:
        for key, val in extra_headers.items():
            handler.send_header(key, val)

    handler.end_headers()

    handler.wfile.write(payload)


def read_body(handler):

    length = int(
        handler.headers.get("Content-Length", 0)
    )

    raw = ""

    if length > 0:
        raw = handler.rfile.read(length).decode("utf-8")

    if raw.strip():
        return json.loads(raw)

    return {}


def get_cookie(handler, name):

    cookie_header = handler.headers.get("Cookie", "")

    for part in cookie_header.split(";"):

        part = part.strip()

        if "=" in part:
            k, v = part.split("=", 1)

            if k.strip() == name:
                return v.strip()

    return None


# ---------------------------------------------------------
# API HANDLER
# ---------------------------------------------------------

class handler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):

        pass

    def do_OPTIONS(self):

        self.send_response(204)

        self.send_header(
            "Access-Control-Allow-Origin", "*"
        )
        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, OPTIONS",
        )
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type",
        )
        self.send_header(
            "Access-Control-Allow-Credentials",
            "true",
        )

        self.end_headers()

    def do_GET(self):

        try:

            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)

            action = params.get("action", ["session"])[0]

            # -----------------------------------------
            # SESSION CHECK
            # -----------------------------------------

            if action == "session":

                token = get_cookie(self, "os_session")

                if not token:
                    send_json(self, 401, {
                        "ok": False,
                        "error": "No session.",
                    })
                    return

                payload = verify_session_token(token)

                if not payload:
                    send_json(self, 401, {
                        "ok": False,
                        "error": "Invalid or expired session.",
                    })
                    return

                send_json(self, 200, {
                    "ok": True,
                    "userId": payload["uid"],
                    "method": payload.get("method", "password"),
                })

                return

            # -----------------------------------------
            # HEALTH CHECK
            # -----------------------------------------

            if action == "health":

                send_json(self, 200, {
                    "ok": True,
                    "service": "auth",
                })

                return

            # -----------------------------------------
            # DEBUG - test Notion DB access
            # -----------------------------------------

            if action == "debug-db":

                if not NOTION_USERS_DB_ID:
                    send_json(self, 200, {
                        "ok": False,
                        "error": "NOTION_USERS_DB_ID is not set.",
                    })
                    return

                db_id = NOTION_USERS_DB_ID.strip().replace("-", "")
                errors = []

                for ep in [f"/databases/{db_id}", f"/data_sources/{db_id}"]:
                    try:
                        result = notion_request("GET", ep)
                        send_json(self, 200, {
                            "ok": True,
                            "endpoint": ep,
                            "title": extract_title(result),
                            "id": result.get("id"),
                        })
                        return
                    except Exception as e:
                        errors.append(f"{ep}: {str(e)}")

                send_json(self, 200, {
                    "ok": False,
                    "db_id_raw": NOTION_USERS_DB_ID,
                    "db_id_clean": db_id,
                    "errors": errors,
                })

                return

            send_json(self, 404, {
                "ok": False,
                "error": "Unknown action.",
            })

        except Exception as error:

            print("Auth GET error:", str(error))

            send_json(self, 500, {
                "ok": False,
                "error": str(error),
            })

    def do_POST(self):

        try:

            body = read_body(self)

            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)

            action = params.get("action", [None])[0]

            if not action:
                action = body.get("action")

            # -----------------------------------------
            # REGISTER
            # -----------------------------------------

            if action == "register":

                email = (body.get("email") or "").strip().lower()
                password = body.get("password") or ""

                if not email or not password:
                    send_json(self, 400, {
                        "ok": False,
                        "error": "Email and password required.",
                    })
                    return

                if len(password) < 6:
                    send_json(self, 400, {
                        "ok": False,
                        "error": "Password must be at least 6 characters.",
                    })
                    return

                existing = query_user_by_email(email)

                if existing:
                    send_json(self, 409, {
                        "ok": False,
                        "error": "An account with this email already exists.",
                    })
                    return

                pw_hash = hash_password(password)

                create_user_page(
                    email,
                    password_hash=pw_hash,
                    auth_method="password",
                )

                token = create_session_token(email, "password")

                send_json(self, 200, {
                    "ok": True,
                    "userId": email,
                    "method": "password",
                }, extra_headers={
                    "Set-Cookie": (
                        f"os_session={token}; "
                        f"Path=/; "
                        f"Max-Age={SESSION_MAX_AGE}; "
                        f"HttpOnly; "
                        f"SameSite=Strict"
                    ),
                })

                return

            # -----------------------------------------
            # LOGIN (email + password)
            # -----------------------------------------

            if action == "login":

                email = (body.get("email") or "").strip().lower()
                password = body.get("password") or ""

                if not email or not password:
                    send_json(self, 400, {
                        "ok": False,
                        "error": "Email and password required.",
                    })
                    return

                user_page = query_user_by_email(email)

                if not user_page:
                    send_json(self, 401, {
                        "ok": False,
                        "error": "No account found with this email.",
                    })
                    return

                stored_hash = get_user_property(
                    user_page, "Password Hash"
                )

                if not stored_hash:
                    send_json(self, 401, {
                        "ok": False,
                        "error": "This account uses USB passkey login. Please use 'Login with USB Drive'.",
                    })
                    return

                if not verify_password(password, stored_hash):
                    send_json(self, 401, {
                        "ok": False,
                        "error": "Incorrect password.",
                    })
                    return

                token = create_session_token(email, "password")

                send_json(self, 200, {
                    "ok": True,
                    "userId": email,
                    "method": "password",
                }, extra_headers={
                    "Set-Cookie": (
                        f"os_session={token}; "
                        f"Path=/; "
                        f"Max-Age={SESSION_MAX_AGE}; "
                        f"HttpOnly; "
                        f"SameSite=Strict"
                    ),
                })

                return

            # -----------------------------------------
            # USB LOGIN (email + usb token)
            # -----------------------------------------

            if action == "usb-login":

                email = (body.get("email") or "").strip().lower()
                usb_token = body.get("usbToken") or ""

                if not email or not usb_token:
                    send_json(self, 400, {
                        "ok": False,
                        "error": "Email and USB token required.",
                    })
                    return

                user_page = query_user_by_email(email)

                if not user_page:
                    send_json(self, 401, {
                        "ok": False,
                        "error": "No account found with this email.",
                    })
                    return

                auth_method = get_user_property(
                    user_page, "Auth Method"
                )

                if auth_method != "usb":
                    send_json(self, 401, {
                        "ok": False,
                        "error": "This account uses password login. Please use 'Login with Password'.",
                    })
                    return

                stored_hash = get_user_property(
                    user_page, "USB Key Hash"
                )

                if not stored_hash:
                    send_json(self, 401, {
                        "ok": False,
                        "error": "No USB key registered for this account.",
                    })
                    return

                token_hash = hashlib.sha256(
                    usb_token.encode("utf-8")
                ).hexdigest()

                if not hmac.compare_digest(token_hash, stored_hash):
                    send_json(self, 401, {
                        "ok": False,
                        "error": "Invalid USB key.",
                    })
                    return

                session_token = create_session_token(email, "usb")

                send_json(self, 200, {
                    "ok": True,
                    "userId": email,
                    "method": "usb",
                }, extra_headers={
                    "Set-Cookie": (
                        f"os_session={session_token}; "
                        f"Path=/; "
                        f"Max-Age={SESSION_MAX_AGE}; "
                        f"HttpOnly; "
                        f"SameSite=Strict"
                    ),
                })

                return

            # -----------------------------------------
            # SETUP USB KEY
            # -----------------------------------------

            if action == "setup-usb":

                token = get_cookie(self, "os_session")

                if not token:
                    send_json(self, 401, {
                        "ok": False,
                        "error": "Not logged in.",
                    })
                    return

                payload = verify_session_token(token)

                if not payload:
                    send_json(self, 401, {
                        "ok": False,
                        "error": "Invalid session.",
                    })
                    return

                email = payload["uid"]
                usb_token = body.get("usbToken") or ""

                if not usb_token:
                    send_json(self, 400, {
                        "ok": False,
                        "error": "USB token required.",
                    })
                    return

                token_hash = hashlib.sha256(
                    usb_token.encode("utf-8")
                ).hexdigest()

                user_page = query_user_by_email(email)

                if not user_page:
                    send_json(self, 404, {
                        "ok": False,
                        "error": "User not found.",
                    })
                    return

                page_id = user_page.get("id")

                update_user_page(page_id, {
                    "USB Key Hash": {
                        "rich_text": [
                            {
                                "text": {
                                    "content": token_hash,
                                },
                            },
                        ],
                    },
                    "Auth Method": {
                        "select": {
                            "name": "usb",
                        },
                    },
                    "Password Hash": {
                        "rich_text": [],
                    },
                })

                new_token = create_session_token(email, "usb")

                send_json(self, 200, {
                    "ok": True,
                    "userId": email,
                    "method": "usb",
                }, extra_headers={
                    "Set-Cookie": (
                        f"os_session={new_token}; "
                        f"Path=/; "
                        f"Max-Age={SESSION_MAX_AGE}; "
                        f"HttpOnly; "
                        f"SameSite=Strict"
                    ),
                })

                return

            # -----------------------------------------
            # SWITCH TO PASSWORD
            # -----------------------------------------

            if action == "switch-to-password":

                token = get_cookie(self, "os_session")

                if not token:
                    send_json(self, 401, {
                        "ok": False,
                        "error": "Not logged in.",
                    })
                    return

                payload = verify_session_token(token)

                if not payload:
                    send_json(self, 401, {
                        "ok": False,
                        "error": "Invalid session.",
                    })
                    return

                email = payload["uid"]
                new_password = body.get("newPassword") or ""

                if not new_password or len(new_password) < 6:
                    send_json(self, 400, {
                        "ok": False,
                        "error": "Password must be at least 6 characters.",
                    })
                    return

                user_page = query_user_by_email(email)

                if not user_page:
                    send_json(self, 404, {
                        "ok": False,
                        "error": "User not found.",
                    })
                    return

                page_id = user_page.get("id")
                pw_hash = hash_password(new_password)

                update_user_page(page_id, {
                    "Password Hash": {
                        "rich_text": [
                            {
                                "text": {
                                    "content": pw_hash,
                                },
                            },
                        ],
                    },
                    "Auth Method": {
                        "select": {
                            "name": "password",
                        },
                    },
                    "USB Key Hash": {
                        "rich_text": [],
                    },
                })

                new_token = create_session_token(email, "password")

                send_json(self, 200, {
                    "ok": True,
                    "userId": email,
                    "method": "password",
                }, extra_headers={
                    "Set-Cookie": (
                        f"os_session={new_token}; "
                        f"Path=/; "
                        f"Max-Age={SESSION_MAX_AGE}; "
                        f"HttpOnly; "
                        f"SameSite=Strict"
                    ),
                })

                return

            # -----------------------------------------
            # LOGOUT
            # -----------------------------------------

            if action == "logout":

                send_json(self, 200, {
                    "ok": True,
                }, extra_headers={
                    "Set-Cookie": (
                        "os_session=; "
                        "Path=/; "
                        "Max-Age=0; "
                        "HttpOnly; "
                        "SameSite=Strict"
                    ),
                })

                return

            # -----------------------------------------
            # UNKNOWN ACTION
            # -----------------------------------------

            send_json(self, 404, {
                "ok": False,
                "error": "Unknown action.",
            })

        except Exception as error:

            print("Auth POST error:", str(error))

            send_json(self, 500, {
                "ok": False,
                "error": str(error),
            })
