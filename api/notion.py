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

    # data_source objects store the title as a top-level
    # array of rich text objects, not as a property.
    top_title = page.get("title")

    if isinstance(top_title, list) and top_title:

        text = ""

        for part in top_title:
            plain_text = part.get("plain_text")

            if plain_text:
                text += plain_text

        if text.strip():
            return text.strip()

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
        "type": "page",
    }


# ---------------------------------------------------------
# PROPERTY EXTRACTION
# ---------------------------------------------------------

def extract_property_value(prop):
    """
    Turn a Notion property object into a simple value that
    the frontend can render. Keys are the property type.
    """

    prop_type = prop.get("type")

    if prop_type == "checkbox":
        return prop.get("checkbox")

    if prop_type == "status":
        option = prop.get("status") or {}
        return {
            "name": option.get("name"),
            "color": option.get("color"),
        }

    if prop_type == "select":
        option = prop.get("select") or {}
        return {
            "name": option.get("name"),
            "color": option.get("color"),
        }

    if prop_type == "multi_select":
        return [
            {
                "name": option.get("name"),
                "color": option.get("color"),
            }
            for option in prop.get("multi_select", [])
        ]

    if prop_type == "date":
        value = prop.get("date")
        if not value:
            return None
        return {
            "start": value.get("start"),
            "end": value.get("end"),
        }

    if prop_type == "number":
        return prop.get("number")

    if prop_type == "url":
        return prop.get("url")

    if prop_type == "email":
        return prop.get("email")

    if prop_type == "phone_number":
        return prop.get("phone_number")

    if prop_type == "rich_text":
        return "".join(
            part.get("plain_text", "")
            for part in prop.get("rich_text", [])
        )

    if prop_type == "title":
        return "".join(
            part.get("plain_text", "")
            for part in prop.get("title", [])
        )

    if prop_type == "formula":
        formula = prop.get("formula") or {}
        return formula.get(formula.get("type"))

    if prop_type in ("created_time", "last_edited_time"):
        return prop.get(prop_type)

    if prop_type in ("created_by", "last_edited_by"):
        user = prop.get(prop_type) or {}
        return user.get("name")

    if prop_type == "people":
        return [
            person.get("name")
            for person in prop.get("people", [])
        ]

    if prop_type == "files":
        return [
            (
                file_.get("name")
                or file_.get("external", {}).get("url")
                or file_.get("file", {}).get("url")
            )
            for file_ in prop.get("files", [])
        ]

    if prop_type == "relation":
        return [
            ref.get("id")
            for ref in prop.get("relation", [])
        ]

    if prop_type == "rollup":
        rollup = prop.get("rollup") or {}
        return rollup.get("array") or rollup.get("number")

    return None


# ---------------------------------------------------------
# NORMALISE DATABASE
# ---------------------------------------------------------

def normalise_database(database):
    return {
        "id": database.get("id"),
        "title": extract_title(database),
        "icon": extract_icon(database),
        "parent_id": extract_parent(database),
        "url": database.get("url"),
        "last_edited_time": database.get("last_edited_time"),
        "in_trash": database.get("in_trash", False),
        "type": "database",
    }

# ---------------------------------------------------------
# SEARCH / LIST ALL PAGES
# ---------------------------------------------------------

def get_all_items(query=None):
    """
    Search through pages AND databases accessible to the
    Notion connection.

    Notion's search endpoint is paginated, so keep requesting
    pages until there are no more.
    """

    all_items = []
    seen = set()
    cursor = None

    while True:

        body = {
            "page_size": 100,
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

        for item in results:

            if item.get("in_trash"):
                continue

            item_id = item.get("id")

            if item_id in seen:
                continue

            seen.add(item_id)

            if item.get("object") in (
                "database",
                "data_source"
            ):
                all_items.append(
                    normalise_database(item)
                )
            else:
                all_items.append(
                    normalise_page(item)
                )

        if not result.get("has_more"):
            break

        cursor = result.get("next_cursor")

        if not cursor:
            break

        # Safety limit.
        # Increase if you have a huge workspace.
        if len(all_items) >= 1000:
            break

    return all_items


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
# GET DATABASE
# ---------------------------------------------------------

def get_database(database_id):
    """
    Retrieve a database container OR a data source.

    Since API version 2025-09-03, inline databases are
    represented as `data_source` objects. The search result
    IDs point at data sources, so try that endpoint first
    and fall back to the database container endpoint.
    """

    encoded_id = urllib.parse.quote(
        database_id,
        safe=""
    )

    try:

        database = notion_request(
            "GET",
            f"/data_sources/{encoded_id}"
        )

    except Exception:

        database = notion_request(
            "GET",
            f"/databases/{encoded_id}"
        )

    return database


# ---------------------------------------------------------
# QUERY DATABASE (PAGES INSIDE IT)
# ---------------------------------------------------------

def query_database(database_id):

    encoded_id = urllib.parse.quote(
        database_id,
        safe=""
    )

    rows = []
    cursor = None

    while True:

        body = {
            "page_size": 100,
        }

        if cursor:
            body["start_cursor"] = cursor

        result = notion_request(
            "POST",
            f"/data_sources/{encoded_id}/query",
            body,
        )

        for page in result.get("results", []):

            if page.get("in_trash"):
                continue

            row = normalise_page(page)

            properties = {}

            for prop_id, prop in page.get("properties", {}).items():

                if prop.get("type") == "title":
                    continue

                prop_name = prop.get("name", prop_id)

                properties[prop_name] = {
                    "id": prop_id,
                    "name": prop_name,
                    "type": prop.get("type"),
                    "value": extract_property_value(prop),
                }

            row["properties"] = properties

            rows.append(row)

        if not result.get("has_more"):
            break

        cursor = result.get("next_cursor")

        if not cursor:
            break

        if len(rows) >= 1000:
            break

    return rows


# ---------------------------------------------------------
# GET CHILD BLOCKS (FOR MARKDOWN FALLBACK)
# ---------------------------------------------------------

def get_block_children(block_id):

    encoded_id = urllib.parse.quote(
        block_id,
        safe=""
    )

    blocks = []
    cursor = None

    while True:

        url = (
            f"/blocks/{encoded_id}/children"
        )

        if cursor:
            url += (
                f"?start_cursor={urllib.parse.quote(cursor, safe='')}"
            )

        result = notion_request(
            "GET",
            url,
        )

        blocks.extend(
            result.get("results", [])
        )

        if not result.get("has_more"):
            break

        cursor = result.get("next_cursor")

        if not cursor:
            break

        if len(blocks) >= 1000:
            break

    return blocks


# ---------------------------------------------------------
# BLOCKS -> MARKDOWN (FALLBACK)
# ---------------------------------------------------------

def rich_text_to_plain(rich_text):
    """
    Join a Notion rich_text list into plain text.
    """

    parts = []

    for part in rich_text or []:
        parts.append(
            part.get("plain_text", "")
        )

    return "".join(parts).strip()


def block_to_markdown(block):
    """
    Convert a single Notion block into Markdown.
    """

    block_type = block.get("type")

    if block_type in ("divider",):
        return "---\n\n"

    value = block.get(block_type, {}) or {}

    rich_text = rich_text_to_plain(
        value.get("rich_text")
    )

    if block_type == "paragraph":
        if not rich_text:
            return ""
        return rich_text + "\n\n"

    if block_type in ("heading_1", "heading_2", "heading_3"):
        level = block_type[-1]
        return "#" * int(level) + " " + rich_text + "\n\n"

    if block_type == "bulleted_list_item":
        if not rich_text:
            return ""
        return "- " + rich_text + "\n"

    if block_type == "numbered_list_item":
        if not rich_text:
            return ""
        return "1. " + rich_text + "\n"

    if block_type == "to_do":
        if not rich_text:
            return ""
        checked = value.get("checked", False)
        state = "x" if checked else " "
        return "- [" + state + "] " + rich_text + "\n"

    if block_type == "toggle":
        if not rich_text:
            return ""
        return "> " + rich_text + "\n\n"

    if block_type == "quote":
        if not rich_text:
            return ""
        return "> " + rich_text + "\n\n"

    if block_type == "code":
        language = value.get("language", "")
        return (
            "```" + language + "\n"
            + rich_text_to_plain(value.get("rich_text"))
            + "\n```\n\n"
        )

    if block_type == "callout":
        if not rich_text:
            return ""
        return "> 💡 " + rich_text + "\n\n"

    if block_type == "child_page":
        title = value.get("title") or "Untitled"
        return "### " + title + "\n\n"

    if block_type == "image":
        image_type = value.get("type")
        image_src = ""

        if image_type == "file":
            image_src = (
                value.get("file", {})
                .get("url", "")
            )

        elif image_type == "external":
            image_src = (
                value.get("external", {})
                .get("url", "")
            )

        if image_src:
            return f"![image]({image_src})\n\n"

        return ""

    return ""


def blocks_to_markdown(blocks):
    """
    Convert a list of Notion blocks into Markdown.
    """

    output = []

    for block in blocks:
        markdown = block_to_markdown(block)

        if markdown:
            output.append(markdown)

        children = block.get("has_children")

        if children:
            child_blocks = get_block_children(
                block.get("id")
            )

            child_markdown = blocks_to_markdown(
                child_blocks
            )

            if child_markdown:
                output.append(child_markdown)

    return "".join(output)


# ---------------------------------------------------------
# COLLECT TO-DO BLOCKS (WRITE-BACK SUPPORT)
# ---------------------------------------------------------

def collect_todo_blocks(blocks):
    """
    Walk a list of Notion blocks (and their children) and
    return every to_do block, in document order, with enough
    info for the frontend to tick/untick them.
    """

    todo = []

    for block in blocks:

        block_id = block.get("id")

        block_type = block.get("type")

        value = block.get(block_type, {}) or {}

        if block_type == "to_do":

            todo.append({
                "id": block_id,
                "checked": value.get("checked", False),
            })

        if block.get("has_children"):

            child_blocks = get_block_children(
                block_id
            )

            todo.extend(
                collect_todo_blocks(
                    child_blocks
                )
            )

    return todo


# ---------------------------------------------------------
# PATCH HELPERS (write back to Notion)
# ---------------------------------------------------------

def update_block(block_id, body):
    """
    PATCH a Notion block. Used to tick/untick to_do items.
    """

    encoded_id = urllib.parse.quote(
        block_id,
        safe=""
    )

    return notion_request(
        "PATCH",
        f"/blocks/{encoded_id}",
        body,
    )


# ---------------------------------------------------------
# UPDATE PAGE PROPERTY
# ---------------------------------------------------------

def update_page_property(page_id, prop_id, value):
    """
    PATCH a single property of a page (database row).
    """

    encoded_id = urllib.parse.quote(
        page_id,
        safe=""
    )

    return notion_request(
        "PATCH",
        f"/pages/{encoded_id}",
        {
            "properties": {
                prop_id: value
            }
        },
    )


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
            "GET, PATCH, OPTIONS"
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

                pages = get_all_items()

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

                    pages = get_all_items()

                else:

                    pages = get_all_items(
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
            # DATABASE CONTENTS
            # -------------------------------------------------

            if action == "database":

                database_id = params.get(
                    "id",
                    [None]
                )[0]

                if not database_id:

                    send_json(
                        self,
                        400,
                        {
                            "ok": False,
                            "error": "Missing database ID."
                        }
                    )

                    return

                database = get_database(
                    database_id
                )

                rows = query_database(
                    database_id
                )

                properties = []
                seen_props = set()

                name_by_id = {}

                for prop_id, prop in (
                    database.get("properties", {}).items()
                ):

                    prop_type = prop.get("type")

                    prop_name = prop.get("name", prop_id)

                    name_by_id[prop_id] = prop_name

                    if prop_type in ("title", "formula"):
                        continue

                    if prop_name in seen_props:
                        continue

                    seen_props.add(prop_name)

                    properties.append({
                        "id": prop_name,
                        "name": prop_name,
                        "type": prop_type,
                        "options": [
                            option.get("name")
                            for option in (
                                prop
                                    .get(prop_type, {})
                                    .get("options", [])
                            )
                            if option.get("name")
                        ] if prop_type in ("status", "select") else [],
                    })

                for row in rows:

                    row_props = row.get("properties", {})

                    remapped = {}

                    for prop_id, prop in row_props.items():

                        prop_name = name_by_id.get(
                            prop_id,
                            prop.get("name", prop_id)
                        )

                        remapped[prop_name] = {
                            **prop,
                            "name": prop_name,
                        }

                    row["properties"] = remapped

                send_json(
                    self,
                    200,
                    {
                        "ok": True,
                        "database": {
                            "id": database.get("id"),
                            "title": extract_title(database),
                            "icon": extract_icon(database),
                            "url": database.get("url"),
                        },
                        "properties": properties,
                        "rows": rows,
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

                markdown_result = get_page_markdown(
                    page_id
                )

                markdown = markdown_result.get(
                    "markdown",
                    ""
                )

                truncated = markdown_result.get(
                    "truncated",
                    False
                )

                unknown_block_ids = markdown_result.get(
                    "unknown_block_ids",
                    []
                )

                blocks = get_block_children(
                    page_id
                )

                todo_blocks = collect_todo_blocks(
                    blocks
                )

                if not markdown.strip():
                    markdown = blocks_to_markdown(
                        blocks
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
                            "markdown": markdown,
                            "todo_blocks": todo_blocks,
                            "truncated": truncated,
                            "unknown_block_ids": unknown_block_ids,
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


    # -------------------------------------------------
    # PATCH — TICK / UNTICK TO-DO ITEMS
    # -------------------------------------------------

    def do_PATCH(self):

        try:

            length = int(
                self.headers.get(
                    "Content-Length",
                    0
                )
            )

            raw_body = ""

            if length > 0:
                raw_body = self.rfile.read(
                    length
                ).decode("utf-8")

            body = {}

            if raw_body.strip():
                body = json.loads(raw_body)


            action = body.get(
                "action"
            )


            # -----------------------------------------
            # TOGGLE TO-DO
            # -----------------------------------------

            if action == "todo":

                block_id = body.get(
                    "id"
                )

                checked_value = body.get(
                    "checked"
                )

                if not block_id:

                    send_json(
                        self,
                        400,
                        {
                            "ok": False,
                            "error": "Missing block ID."
                        }
                    )

                    return

                update_block(
                    block_id,
                    {
                        "to_do": {
                            "checked": bool(
                                checked_value
                            )
                        }
                    }
                )

                send_json(
                    self,
                    200,
                    {
                        "ok": True
                    }
                )

                return


            # -----------------------------------------
            # TOGGLE DATABASE PROPERTY
            # -----------------------------------------

            if action == "prop":

                page_id = body.get(
                    "id"
                )

                prop_id = body.get(
                    "property"
                )

                prop_type = body.get(
                    "type"
                )

                value = body.get(
                    "value"
                )

                if (
                    not page_id or
                    not prop_id
                ):

                    send_json(
                        self,
                        400,
                        {
                            "ok": False,
                            "error": "Missing page or property."
                        }
                    )

                    return

                if prop_type == "checkbox":

                    update_page_property(
                        page_id,
                        prop_id,
                        {
                            "checkbox": bool(
                                value
                            )
                        }
                    )

                elif prop_type == "status":

                    update_page_property(
                        page_id,
                        prop_id,
                        {
                            "status": {
                                "name": str(
                                    value
                                )
                            }
                        }
                    )

                else:

                    send_json(
                        self,
                        400,
                        {
                            "ok": False,
                            "error": "Unsupported property type."
                        }
                    )

                    return

                send_json(
                    self,
                    200,
                    {
                        "ok": True
                    }
                )

                return


            # -----------------------------------------
            # UNKNOWN ACTION
            # -----------------------------------------

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
                "Notion patch error:",
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