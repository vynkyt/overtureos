import os
import json
import urllib.request
import urllib.parse
import urllib.error
from http.server import BaseHTTPRequestHandler


NOTION_API_KEY = os.environ.get("NOTION_API_KEY")
NOTION_VERSION = "2026-03-11"

NOTION_BASE = "https://api.notion.com/v1"


# ---------------------------------------------------------
# NOTION REQUEST HELPER
# ---------------------------------------------------------

def notion_request(method, endpoint, body=None):
    """
    Make a request to the Notion API.
    """

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
            error_json = {
                "message": error_body
            }

        raise RuntimeError(
            f"Notion API error {error.code}: "
            f"{error_json.get('message', 'Unknown error')}"
        )

    except urllib.error.URLError as error:
        raise RuntimeError(
            f"Could not connect to Notion: {error.reason}"
        )


# ---------------------------------------------------------
# TITLE EXTRACTION
# ---------------------------------------------------------

def extract_title(page):
    """
    Find the title of a Notion page.
    """

    properties = page.get("properties", {})

    for _, prop in properties.items():

        if prop.get("type") != "title":
            continue

        title_parts = prop.get("title", [])

        text = ""

        for part in title_parts:
            plain_text = part.get("plain_text")

            if plain_text:
                text += plain_text

        if text.strip():
            return text.strip()

    # Fallback
    return "Untitled"


# ---------------------------------------------------------
# ICON EXTRACTION
# ---------------------------------------------------------

def extract_icon(page):
    icon = page.get("icon")

    if not icon:
        return "📄"

    icon_type = icon.get("type")

    if icon_type == "emoji":
        return icon.get("emoji", "📄")

    return "📄"


# ---------------------------------------------------------
# PARENT EXTRACTION
# ---------------------------------------------------------

def extract_parent(page):
    parent = page.get("parent", {})

    parent_type = parent.get("type")

    if parent_type == "page_id":
        return parent.get("page_id")

    if parent_type == "database_id":
        return parent.get("database_id")

    if parent_type == "data_source_id":
        return parent.get("data_source_id")

    return None


# ---------------------------------------------------------
# NORMALISE PAGE
# ---------------------------------------------------------

def normalise_page(page):
    return {
        "id": page.get("id"),
        "title": extract_title(page),
        "icon": extract_icon(page),
        "parent_id": extract_parent(page),
        "url": page.get("url"),
        "last_edited_time": page.get("last_edited_time"),
        "in_trash": page.get("in_trash", False),
    }


# ---------------------------------------------------------
# SEARCH / LIST ALL PAGES
# ---------------------------------------------------------

def get_all_pages(query=None):
    """
    Search through pages accessible to the Notion connection.

    Notion's search endpoint is paginated, so keep requesting
    pages until there are no more.
    """

    all_pages = []
    cursor = None

    while True:

        body = {
            "page_size": 100,
            "filter": {
                "property": "object",
                "value": "page",
            },
            "sort": {
                "direction": "descending",
                "timestamp": "last_edited_time",
            },
        }

        if query:
            body["query"] = query

        if cursor:
            body["start_cursor"] = cursor

        result = notion_request(
            "POST",
            "/search",
            body,
        )

        results = result.get("results", [])

        for page in results:

            if page.get("in_trash"):
                continue

            all_pages.append(
                normalise_page(page)
            )

        if not result.get("has_more"):
            break

        cursor = result.get("next_cursor")

        if not cursor:
            break

        # Safety limit.
        # Increase if you have a huge workspace.
        if len(all_pages) >= 1000:
            break

    return all_pages


# ---------------------------------------------------------
# GET SINGLE PAGE
# ---------------------------------------------------------

def get_page(page_id):

    encoded_id = urllib.parse.quote(
        page_id,
        safe=""
    )

    page = notion_request(
        "GET",
        f"/pages/{encoded_id}"
    )

    return page


# ---------------------------------------------------------
# GET PAGE MARKDOWN
# ---------------------------------------------------------

def get_page_markdown(page_id):

    encoded_id = urllib.parse.quote(
        page_id,
        safe=""
    )

    result = notion_request(
        "GET",
        f"/pages/{encoded_id}/markdown"
    )

    return result


# ---------------------------------------------------------
# RESPONSE HELPERS
# ---------------------------------------------------------

def send_json(handler, status, data):

    payload = json.dumps(
        data,
        ensure_ascii=False
    ).encode("utf-8")

    handler.send_response(status)

    handler.send_header(
        "Content-Type",
        "application/json; charset=utf-8"
    )

    handler.send_header(
        "Cache-Control",
        "no-store"
    )

    handler.send_header(
        "Access-Control-Allow-Origin",
        "*"
    )

    handler.end_headers()

    handler.wfile.write(payload)


# ---------------------------------------------------------
# API HANDLER
# ---------------------------------------------------------

class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):

        self.send_response(204)

        self.send_header(
            "Access-Control-Allow-Origin",
            "*"
        )

        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, OPTIONS"
        )

        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type"
        )

        self.end_headers()


    def do_GET(self):

        try:

            parsed = urllib.parse.urlparse(
                self.path
            )

            params = urllib.parse.parse_qs(
                parsed.query
            )

            action = params.get(
                "action",
                ["pages"]
            )[0]


            # -------------------------------------------------
            # HEALTH CHECK
            # -------------------------------------------------

            if action == "health":

                send_json(
                    self,
                    200,
                    {
                        "ok": True,
                        "message": "Notion API is running."
                    }
                )

                return


            # -------------------------------------------------
            # LIST PAGES
            # -------------------------------------------------

            if action == "pages":

                pages = get_all_pages()

                send_json(
                    self,
                    200,
                    {
                        "ok": True,
                        "pages": pages
                    }
                )

                return


            # -------------------------------------------------
            # SEARCH
            # -------------------------------------------------

            if action == "search":

                query = params.get(
                    "q",
                    [""]
                )[0].strip()

                if not query:

                    pages = get_all_pages()

                else:

                    pages = get_all_pages(
                        query=query
                    )

                send_json(
                    self,
                    200,
                    {
                        "ok": True,
                        "pages": pages
                    }
                )

                return


            # -------------------------------------------------
            # PAGE CONTENT
            # -------------------------------------------------

            if action == "page":

                page_id = params.get(
                    "id",
                    [None]
                )[0]

                if not page_id:

                    send_json(
                        self,
                        400,
                        {
                            "ok": False,
                            "error": "Missing page ID."
                        }
                    )

                    return


                page = get_page(
                    page_id
                )

                markdown = get_page_markdown(
                    page_id
                )


                send_json(
                    self,
                    200,
                    {
                        "ok": True,

                        "page": {
                            "id": page.get("id"),
                            "title": extract_title(page),
                            "icon": extract_icon(page),
                            "url": page.get("url"),
                            "markdown": markdown.get(
                                "markdown",
                                ""
                            ),
                            "truncated": markdown.get(
                                "truncated",
                                False
                            ),
                            "unknown_block_ids": markdown.get(
                                "unknown_block_ids",
                                []
                            ),
                        }
                    }
                )

                return


            # -------------------------------------------------
            # UNKNOWN ACTION
            # -------------------------------------------------

            send_json(
                self,
                404,
                {
                    "ok": False,
                    "error": "Unknown action."
                }
            )


        except Exception as error:

            print(
                "Notion API error:",
                str(error)
            )

            send_json(
                self,
                500,
                {
                    "ok": False,
                    "error": str(error)
                }
            )