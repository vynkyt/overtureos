# ---------------------------------------------------------
# BROWSE PROXY
#
# Fetches a page server-side and serves it without
# X-Frame-Options / CSP frame-ancestors, so sites that refuse
# to be framed (Google, etc.) render inside the Browser app.
#
# Links and form actions are rewritten to keep navigation
# flowing back through this proxy.
# ---------------------------------------------------------

import html
import re
import urllib.request
import urllib.parse
import urllib.error
from http.server import BaseHTTPRequestHandler


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# Headers that would block framing if we passed them through.
STRIP_HEADERS = {
    "x-frame-options",
    "frame-options",
    "content-security-policy",
    "content-security-policy-report-only",
}

# Hop-by-hop / length headers we recompute ourselves.
SKIP_HEADERS = {
    "content-length",
    "content-encoding",
    "transfer-encoding",
    "connection",
    "keep-alive",
}

# <a href> / <form ...> — rewrite only the attribute value so
# the rest of the tag is preserved.
_HREF_RE = re.compile(
    r'(<a\b[^>]*?)(\bhref\s*=\s*)(["\'])(.*?)\3([^>]*>)',
    re.IGNORECASE | re.DOTALL,
)

_FORM_RE = re.compile(
    r"<form\b[^>]*>",
    re.IGNORECASE,
)

_ACTION_RE = re.compile(
    r"\baction\s*=\s*([\"'])(.*?)\1",
    re.IGNORECASE | re.DOTALL,
)

_METHOD_RE = re.compile(
    r"\bmethod\s*=\s*([\"'])(get|post)\1",
    re.IGNORECASE,
)


def request_origin(handler):
    """
    Reconstruct the public URL of this app (scheme + host) from the
    incoming request headers, so rewritten links/forms point back at
    the app even when the proxied page injects a <base> tag pointing
    at the target site.
    """
    proto = (handler.headers.get("X-Forwarded-Proto") or "http").split(",")[0].strip()
    host = handler.headers.get("X-Forwarded-Host") or handler.headers.get("Host")
    if not host:
        return ""
    host = host.split(",")[0].strip()
    return "%s://%s" % (proto, host)


def proxy_url(origin, base_url, target):
    return origin + "/api/browse?url=" + urllib.parse.quote(
        urllib.parse.urljoin(base_url, target),
        safe="",
    )


def fix_form(origin, base_url, match):
    """
    Rewrite a <form> tag. POST forms keep a proxied action (the url=
    query survives a POST submit). GET forms point at the bare proxy
    endpoint and carry the target in a hidden url input, because a GET
    submit replaces the action's entire query string.
    """
    tag = match.group(0)

    method = "get"
    method_m = _METHOD_RE.search(tag)
    if method_m:
        method = method_m.group(2).lower()

    action_m = _ACTION_RE.search(tag)
    action = action_m.group(2) if action_m else ""

    target = urllib.parse.urljoin(base_url, action)
    quote = action_m.group(1) if action_m else '"'

    hidden = ""
    if method == "post":
        new_action = proxy_url(origin, base_url, action)
    else:
        new_action = origin + "/api/browse"
        hidden = (
            '<input type="hidden" name="url" value="%s">'
            % html.escape(target, quote=True)
        )

    if action_m:
        tag = (
            tag[: action_m.start()]
            + "action=" + quote + new_action + quote
            + tag[action_m.end():]
        )
    elif tag.endswith("/>"):
        tag = tag[:-2] + ' action="%s"/>' % new_action
    else:
        tag = tag[:-1] + ' action="%s">' % new_action

    return tag + hidden


def rewrite_html(html_text, base_url, origin):
    """
    Inject a <base> tag so relative scripts/styles/images load
    straight from the original site, and rewrite anchors/forms
    so navigation stays inside the proxy.
    """

    base_tag = '<base href="%s">' % base_url.replace("&", "&amp;")

    if re.search(r"<head\b", html_text, re.IGNORECASE):
        html_text = re.sub(
            r"<head\b[^>]*>",
            lambda m: m.group(0) + base_tag,
            html_text,
            count=1,
            flags=re.IGNORECASE,
        )
    else:
        html_text = base_tag + html_text

    def fix_href(match):
        href = match.group(4)

        if href.startswith(("javascript:", "#", "mailto:", "tel:")):
            return match.group(0)

        return (
            match.group(1)
            + match.group(2)
            + match.group(3)
            + proxy_url(origin, base_url, href)
            + match.group(3)
            + match.group(5)
        )

    html_text = _HREF_RE.sub(fix_href, html_text)
    html_text = _FORM_RE.sub(lambda m: fix_form(origin, base_url, m), html_text)

    return html_text


def fetch_and_respond(handler, url, data=None, content_type=None):
    headers = {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    method = "GET"

    if data is not None:
        method = "POST"
        headers["Content-Type"] = (
            content_type or "application/x-www-form-urlencoded"
        )

    request = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method=method,
    )

    with urllib.request.urlopen(request, timeout=25) as response:
        status = response.getcode()
        response_headers = response.headers
        final_url = response.geturl()
        body = response.read()

    content_type_out = response_headers.get(
        "Content-Type",
        "text/html",
    )

    if "html" in content_type_out.lower():
        text = body.decode("utf-8", errors="replace")
        text = rewrite_html(text, final_url, request_origin(handler))
        body = text.encode("utf-8", errors="replace")
        content_type_out = "text/html; charset=utf-8"

    handler.send_response(status)

    for key, value in response_headers.items():
        key_lower = key.lower()

        if key_lower in STRIP_HEADERS:
            continue

        if key_lower in SKIP_HEADERS:
            continue

        handler.send_header(key, value)

    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Content-Type", content_type_out)
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()

    handler.wfile.write(body)


class handler(BaseHTTPRequestHandler):

    def log_message(self, *args):
        pass

    def _target(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
        url = None
        extra = []

        for key, value in params:
            if key == "url":
                url = value
            else:
                extra.append((key, value))

        if not url:
            self.send_error(400, "Missing url parameter")
            return None, None

        if not url.lower().startswith(("http://", "https://")):
            self.send_error(400, "Only http/https URLs are allowed")
            return None, None

        return url, extra

    def do_GET(self):
        try:
            url, extra = self._target()
            if not url:
                return

            # GET form submits land their fields on the proxy URL; forward
            # them to the target so searches and form-driven pages work.
            if extra:
                sep = "&" if urllib.parse.urlparse(url).query else "?"
                url += sep + urllib.parse.urlencode(extra)

            fetch_and_respond(self, url)
        except urllib.error.HTTPError as error:
            self.send_error(error.code, str(error.reason))
        except urllib.error.URLError as error:
            self.send_error(502, str(error.reason))
        except Exception as error:
            self.send_error(500, str(error))

    def do_POST(self):
        try:
            url, _ = self._target()
            if not url:
                return

            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length else b""
            content_type = self.headers.get("Content-Type", "")

            fetch_and_respond(self, url, data=body, content_type=content_type)
        except urllib.error.HTTPError as error:
            self.send_error(error.code, str(error.reason))
        except urllib.error.URLError as error:
            self.send_error(502, str(error.reason))
        except Exception as error:
            self.send_error(500, str(error))