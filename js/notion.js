/* =========================================================
   NOTION FRONTEND
========================================================= */


(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let notionPages = [];

    let currentPageId = null;

    let searchTimeout = null;

    let statusOptions = {};


    /* =====================================================
       ELEMENTS
    ===================================================== */

    const pageList =
        document.getElementById("notionPageList");

    const content =
        document.getElementById("notionContent");

    const searchInput =
        document.getElementById("notionSearch");

    const breadcrumb =
        document.getElementById("notionBreadcrumb");

    const status =
        document.getElementById("notionStatus");

    const refreshButton =
        document.getElementById("notionRefresh");


    /* =====================================================
       API
    ===================================================== */

    async function notionAPI(action, params = {}, method = "GET") {

        const query =
            new URLSearchParams();

        query.set(
            "action",
            action
        );


        Object.keys(params).forEach(key => {

            if (
                params[key] !== undefined &&
                params[key] !== null
            ) {

                query.set(
                    key,
                    params[key]
                );

            }

        });


        const response =
            await fetch(
                `/api/notion?${query.toString()}`,
                {
                    method: method,
                    headers: {
                        "Accept":
                            "application/json",
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        method === "PATCH"
                            ? JSON.stringify(params)
                            : undefined
                }
            );


        let data;

        try {

            data =
                await response.json();

        } catch (error) {

            throw new Error(
                "The server returned invalid JSON."
            );

        }


        if (!response.ok || data.ok === false) {

            throw new Error(
                data.error ||
                "Notion API request failed."
            );

        }


        return data;
    }


    /* =====================================================
       LOAD ALL PAGES
    ===================================================== */

    async function loadPages() {

        showPageLoading();

        try {

            const data =
                await notionAPI("pages");

            notionPages =
                data.pages || [];

            renderPageList(
                notionPages
            );

        } catch (error) {

            console.error(
                "Notion page loading error:",
                error
            );

            showPageError(
                error.message
            );

        }

    }


    /* =====================================================
       SEARCH
    ===================================================== */

    async function searchPages(query) {

        if (!query.trim()) {

            renderPageList(
                notionPages
            );

            return;

        }


        showPageLoading(
            "searching..."
        );


        try {

            const data =
                await notionAPI(
                    "search",
                    {
                        q: query
                    }
                );


            renderPageList(
                data.pages || []
            );


        } catch (error) {

            console.error(
                "Notion search error:",
                error
            );

            showPageError(
                error.message
            );

        }

    }


    /* =====================================================
       RENDER SIDEBAR
    ===================================================== */

    function renderPageList(pages) {

        pageList.innerHTML = "";


        if (!pages.length) {

            pageList.innerHTML = `
                <div class="notion-loading">
                    no pages found ♡
                </div>
            `;

            return;

        }


        /*
         * Build a tree from parent_id.
         */

        const tree =
            buildPageTree(pages);


        tree.forEach(node => {

            renderPageNode(
                node,
                0
            );

        });

    }


    /* =====================================================
       BUILD TREE
    ===================================================== */

    function buildPageTree(pages) {

        const nodes = {};

        const roots = [];


        pages.forEach(page => {

            nodes[page.id] = {
                page: page,
                children: []
            };

        });


        pages.forEach(page => {

            const node =
                nodes[page.id];

            const parentId =
                page.parent_id;


            if (
                parentId &&
                nodes[parentId]
            ) {

                nodes[parentId]
                    .children
                    .push(node);

            } else {

                roots.push(node);

            }

        });


        /*
         * Sort naturally (Chapter 2 before Chapter 10).
         */

        function naturalCompare(a, b) {

            const titleA =
                a.page.title || "";

            const titleB =
                b.page.title || "";

            const numA =
                titleA.match(/\d+/);

            const numB =
                titleB.match(/\d+/);

            if (numA && numB) {

                const diff =
                    parseInt(numA[0], 10) -
                    parseInt(numB[0], 10);

                if (diff !== 0) {
                    return diff;
                }

            }

            return titleA.localeCompare(
                titleB
            );

        }

        function sortNodes(list) {

            list.sort(
                naturalCompare
            );


            list.forEach(node => {

                sortNodes(
                    node.children
                );

            });

        }


        sortNodes(roots);


        return roots;

    }


    /* =====================================================
       RENDER TREE NODE
    ===================================================== */

    function renderPageNode(
        node,
        depth,
        container
    ) {

        const page =
            node.page;

        const isDatabase =
            page.type === "database";

        const hasChildren =
            node.children.length > 0;

        const parent =
            container || pageList;


        const row =
            document.createElement(
                "div"
            );

        row.className =
            "notion-tree-row";


        const button =
            document.createElement(
                "button"
            );


        button.type = "button";

        button.className =
            "notion-page" +
            (isDatabase ? " notion-database-item" : "");


        button.dataset.pageId =
            page.id;

        button.dataset.type =
            page.type || "page";


        button.style.paddingLeft =
            `${8 + depth * 15}px`;


        button.innerHTML = `

            <span class="notion-page-icon">
                ${escapeHTML(
                    page.icon || (isDatabase ? "🗄️" : "📄")
                )}
            </span>

            <span class="notion-page-title">
                ${escapeHTML(
                    page.title || "Untitled"
                )}
            </span>

        `;


        button.addEventListener(
            "click",
            function () {

                if (isDatabase) {

                    openNotionDatabase(
                        page.id
                    );

                } else {

                    openNotionPage(
                        page.id
                    );

                }

            }
        );


        row.appendChild(
            button
        );


        let childrenEl = null;

        if (hasChildren) {

            /*
             * Collapse toggle. Default is expanded.
             */

            const toggle =
                document.createElement(
                    "button"
                );

            toggle.type = "button";

            toggle.className =
                "notion-toggle";

            toggle.textContent =
                "▾";

            toggle.title =
                "Collapse / expand";

            toggle.addEventListener(
                "click",
                function (event) {

                    event.stopPropagation();

                    const collapsed =
                        childrenEl.classList.toggle(
                            "collapsed"
                        );

                    toggle.textContent =
                        collapsed ? "▸" : "▾";

                }
            );


            button.insertBefore(
                toggle,
                button.firstChild
            );


            childrenEl =
                document.createElement(
                    "div"
                );

            childrenEl.className =
                "notion-tree-children";

            node.children.forEach(
                child => {

                    renderPageNode(
                        child,
                        depth + 1,
                        childrenEl
                    );

                }
            );


            row.appendChild(
                childrenEl
            );

        }


        parent.appendChild(
            row
        );

    }


    /* =====================================================
       OPEN PAGE
    ===================================================== */

    async function openNotionPage(
        pageId
    ) {

        currentPageId =
            pageId;


        setActivePage(
            pageId
        );


        showContentLoading();


        try {

            const data =
                await notionAPI(
                    "page",
                    {
                        id: pageId
                    }
                );


            const page =
                data.page;


            renderPage(
                page
            );


        } catch (error) {

            console.error(
                "Notion page error:",
                error
            );


            showContentError(
                error.message
            );

        }

    }


    /* =====================================================
       OPEN DATABASE
    ===================================================== */

    async function openNotionDatabase(
        databaseId
    ) {

        currentPageId =
            databaseId;


        setActivePage(
            databaseId
        );


        showContentLoading();


        try {

            const data =
                await notionAPI(
                    "database",
                    {
                        id: databaseId
                    }
                );


            renderDatabase(
                data
            );


        } catch (error) {

            console.error(
                "Notion database error:",
                error
            );


            showContentError(
                error.message
            );

        }

    }


    /* =====================================================
       ORDER COLUMNS (from NOTION_CONFIG)
    ===================================================== */

    function orderColumns(db, props) {

        const config =
            window.NOTION_CONFIG;

        if (
            !config ||
            !config.columnOrder
        ) {
            return props;
        }

        const order =
            config.columnOrder[db.id] ||
            config.columnOrder[db.title] ||
            null;

        if (!order || !order.length) {
            return props;
        }

        const ordered = [];
        const leftovers = [];

        props.forEach(col => {

            const index =
                order.indexOf(
                    col.name
                );

            if (index === -1) {

                leftovers.push(
                    col
                );

            } else {

                ordered[index] =
                    col;

            }

        });

        return ordered
            .filter(Boolean)
            .concat(
                leftovers
            );

    }


    /* =====================================================
       RENDER DATABASE
    ===================================================== */

    function renderDatabase(data) {

        const db =
            data.database || {};

        const props =
            orderColumns(
                db,
                data.properties || []
            );

        const rows =
            data.rows || [];


        breadcrumb.textContent =
            db.title || "Untitled";


        status.classList.remove(
            "show"
        );


        statusOptions = {};

        props.forEach(col => {

            if (
                col.type === "status" &&
                Array.isArray(col.options)
            ) {

                statusOptions[col.id] =
                    col.options;

            }

        });


        const statusOptionsRef =
            statusOptions;

        content.innerHTML =
            buildDatabaseHtml(
                db,
                props,
                rows
            );


        wireDatabaseToggles(
            content,
            props,
            rows,
            statusOptionsRef
        );

    }


    /* =====================================================
       BUILD DATABASE HTML
    ===================================================== */

    function buildDatabaseHtml(db, props, rows) {

        let tableHtml = "";

        if (props.length) {

            tableHtml =

                `<thead>
                    <tr>
                        <th class="notion-db-title-col">Title</th>
                        ${props.map(col => `

                            <th>
                                ${escapeHTML(col.name)}
                            </th>

                        `).join("")}
                    </tr>
                </thead>`;


        }


        const bodyHtml =
            rows.map(row => {

                const rowProps =
                    row.properties || {};


                const titleProp =
                    Object.values(rowProps)
                        .find(p => p.type === "title");


                const titleValue =
                    titleProp
                        ? titleProp.value
                        : row.title ||
                          "Untitled";


                return `

                    <tr class="notion-db-row" data-row-id="${escapeHTML(row.id)}">

                        <td class="notion-db-title-col">

                            <span class="notion-page-icon">
                                ${escapeHTML(
                                    row.icon || "📄"
                                )}
                            </span>

                            <span class="notion-db-title-text">
                                ${escapeHTML(titleValue)}
                            </span>

                        </td>

                        ${props.map(col => `

                            <td class="notion-db-cell notion-db-cell-${escapeHTML(col.type)}">

                                ${renderPropCell(col, rowProps[col.id])}

                            </td>

                        `).join("")}

                    </tr>

                `;

            }).join("");


        return `

            <div class="notion-database">

                ${rows.length === 0
                    ? `<div class="notion-loading">
                            no rows found
                       </div>`
                    : `
                        <table class="notion-db-table">
                            ${tableHtml}
                            <tbody>
                                ${bodyHtml}
                            </tbody>
                        </table>
                    `
                }

            </div>

        `;

    }


    /* =====================================================
       RENDER PROPERTY CELL
    ===================================================== */

    function renderPropCell(col, prop) {

        const type =
            col.type;

        const value =
            prop
                ? prop.value
                : undefined;


        if (type === "checkbox") {

            const checked =
                Boolean(value);

            return `

                <button
                    class="notion-db-checkbox"
                    data-prop-id="${escapeHTML(col.id)}"
                    data-prop-type="checkbox"
                    data-checked="${checked ? "1" : "0"}"
                    aria-pressed="${checked ? "true" : "false"}"
                    type="button"
                >
                    ${checked ? "☑" : "☐"}
                </button>

            `;

        }


        if (type === "status") {

            const name =
                value && value.name
                    ? value.name
                    : "—";

            const color =
                value && value.color
                    ? value.color
                    : "";

            return `

                <span
                    class="notion-db-status"
                    style="--status-color: var(--notion-color-${escapeHTML(color)}, #e9e9ee);"
                    data-prop-id="${escapeHTML(col.id)}"
                    data-prop-type="status"
                >
                    ${escapeHTML(name)}
                </span>

            `;

        }


        if (type === "select") {

            const name =
                value && value.name
                    ? value.name
                    : "—";

            const color =
                value && value.color
                    ? value.color
                    : "";

            return `

                <span
                    class="notion-db-tag notion-db-tag-${escapeHTML(color)}"
                >
                    ${escapeHTML(name)}
                </span>

            `;

        }


        if (type === "multi_select") {

            const items =
                Array.isArray(value)
                    ? value
                    : [];

            return items.map(item => `

                <span class="notion-db-tag notion-db-tag-${escapeHTML(item.color || "")}">
                    ${escapeHTML(item.name || "")}
                </span>

            `).join("") || "—";

        }


        if (type === "date") {

            if (!value || !value.start) {
                return "—";
            }

            const start =
                new Date(value.start);

            let text =
                start.toLocaleDateString(
                    undefined,
                    {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                    }
                );

            if (value.end) {

                const end =
                    new Date(value.end);

                text +=
                    " → " +
                    end.toLocaleDateString(
                        undefined,
                        {
                            year: "numeric",
                            month: "short",
                            day: "numeric"
                        }
                    );

            }

            return escapeHTML(text);

        }


        if (type === "url") {

            if (!value) {
                return "—";
            }

            return `

                <a
                    href="${escapeHTML(value)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="notion-db-link"
                >
                    ${escapeHTML(value.replace(/^https?:\/\//, ""))}
                </a>

            `;

        }


        if (type === "number") {

            return value === undefined || value === null
                ? "—"
                : escapeHTML(String(value));

        }


        if (type === "people") {

            const names =
                Array.isArray(value) && value.length
                    ? value
                    : [];

            return names
                .map(name =>
                    `<span class="notion-db-tag">${escapeHTML(name || "")}</span>`
                )
                .join(" ") || "—";

        }


        if (type === "formula") {

            return value === undefined || value === null || value === ""
                ? "—"
                : escapeHTML(String(value));

        }


        if (type === "relation") {

            const count =
                Array.isArray(value)
                    ? value.length
                    : 0;

            return escapeHTML(
                count ? `${count} linked` : "—"
            );

        }


        if (type === "rollup") {

            return value === undefined || value === null
                ? "—"
                : escapeHTML(String(value));

        }


        if (Array.isArray(value)) {

            return escapeHTML(
                value.join(", ")
            );

        }


        if (value === undefined || value === null || value === "") {
            return "—";
        }


        return escapeHTML(String(value));

    }


    /* =====================================================
       WIRE DATABASE TOGGLES
    ===================================================== */

    function wireDatabaseToggles(
        container,
        props,
        rows,
        statusOptionsRef
    ) {

        /*
         * Checkboxes → PATCH immediately.
         */

        const checkboxes =
            container.querySelectorAll(
                ".notion-db-checkbox"
            );


        checkboxes.forEach(cb => {

            cb.addEventListener(
                "click",
                function () {

                    const pageId =
                        cb.closest(
                            ".notion-db-row"
                        ).dataset.rowId;

                    const propId =
                        cb.dataset.propId;

                    const checked =
                        cb.dataset.checked === "1";


                    cb.dataset.checked =
                        checked ? "0" : "1";

                    cb.setAttribute(
                        "aria-pressed",
                        checked ? "false" : "true"
                    );

                    cb.textContent =
                        checked ? "☐" : "☑";

                    cb.disabled = true;

                    notionAPI(
                        "prop",
                        {
                            id: pageId,
                            property: propId,
                            type: "checkbox",
                            value: !checked
                        },
                        "PATCH"
                    ).then(() => {

                        cb.disabled = false;

                    }).catch(error => {

                        console.error(
                            "Notion toggle error:",
                            error
                        );

                        cb.dataset.checked =
                            checked ? "1" : "0";

                        cb.setAttribute(
                            "aria-pressed",
                            checked ? "true" : "false"
                        );

                        cb.textContent =
                            checked ? "☑" : "☐";

                        cb.disabled = false;

                        showStatus(
                            "Couldn't update: " + error.message
                        );

                    });

                }
            );

        });


        /*
         * Status → cycle through the database's status options.
         */

        const statuses =
            container.querySelectorAll(
                ".notion-db-status"
            );


        statuses.forEach(st => {

            st.addEventListener(
                "click",
                function () {

                    const pageId =
                        st.closest(
                            ".notion-db-row"
                        ).dataset.rowId;

                    const propId =
                        st.dataset.propId;

                    const current =
                        st.textContent.trim();

                    const options =
                        (statusOptionsRef || statusOptions)[propId] || ["Not started", "In progress", "Done"];

                    const next =
                        options[
                            (Math.max(
                                options.indexOf(current),
                                0
                            ) + 1) % options.length
                        ];


                    st.disabled = true;

                    notionAPI(
                        "prop",
                        {
                            id: pageId,
                            property: propId,
                            type: "status",
                            value: next
                        },
                        "PATCH"
                    ).then(() => {

                        st.textContent =
                            next;

                        st.disabled = false;

                    }).catch(error => {

                        console.error(
                            "Notion status error:",
                            error
                        );

                        st.disabled = false;

                        showStatus(
                            "Couldn't update: " + error.message
                        );

                    });

                }
            );

        });

    }


    /* =====================================================
       RENDER PAGE
    ===================================================== */

    function renderPage(page) {

        breadcrumb.textContent =
            page.title || "Untitled";


        status.classList.remove(
            "show"
        );


        let markdown =
            page.markdown || "";


        /*
         * Notion's enhanced markdown can contain
         * special block references. For now, display
         * them gracefully rather than crashing.
         */

        if (
            page.truncated &&
            page.unknown_block_ids &&
            page.unknown_block_ids.length
        ) {

            showStatus(
                "This Notion page is very large and some content could not be loaded."
            );

        }


        /*
         * Make sure the libraries are actually loaded.
         *
         * They are vendored locally (js/marked.min.js and
         * js/purify.min.js), but if they ever fail to load,
         * show a clear message instead of crashing silently.
         */

        if (
            typeof window.marked === "undefined" ||
            typeof window.DOMPurify === "undefined"
        ) {

            showContentError(
                "The Markdown libraries could not be loaded. Please refresh the page."
            );

            return;

        }


        /*
         * Configure marked.
         */

        marked.setOptions({

            breaks: true,

            gfm: true,

            headerIds: false,

            mangle: false

        });


        /*
         * Embedded databases.
         *
         * Notion's enhanced markdown embeds inline databases
         * as `<database url="..." data-source-url="collection://<id>">
         * Title</database>`. Swap each one for a placeholder
         * div that gets filled in below.
         */

        const embeddedDBs = [];

        markdown = markdown.replace(
            /<database\b[^>]*?(?:data-source-url="collection:\/\/([0-9a-f-]+)")[^>]*>([\s\S]*?)<\/database>/gi,
            function (match, dbId, titleText) {

                const index =
                    embeddedDBs.length;

                embeddedDBs.push({
                    id: (dbId || "").trim(),
                    title: (titleText || "").trim()
                });

                return (
                    `<div class="notion-embedded-db" data-db-index="${index}">loading…</div>`
                );

            }
        );


        const rawHTML =
            marked.parse(
                markdown
            );


        /*
         * IMPORTANT:
         *
         * Sanitize before inserting HTML.
         */

        const safeHTML =
            DOMPurify.sanitize(
                rawHTML,
                {
                    ADD_ATTR: [
                        "target"
                    ]
                }
            );


        content.innerHTML = `

            <div class="notion-rendered">

                ${safeHTML}

            </div>

        `;


        /*
         * Fill the embedded database placeholders.
         */

        embeddedDBs.forEach(
            (entry, index) => {

                const holder =
                    content.querySelector(
                        `.notion-embedded-db[data-db-index="${index}"]`
                    );

                if (holder) {

                    loadEmbeddedDatabase(
                        holder,
                        entry
                    );

                }

            }
        );


        /*
         * Harden images.
         *
         * Notion serves files from signed S3 URLs that can
         * react badly to referrers, so strip the referrer.
         * Lazy loading keeps large pages fast.
         */

        content.querySelectorAll(
            "img"
        ).forEach(img => {

            img.loading = "lazy";

            img.referrerPolicy = "no-referrer";

        });


        /*
         * Graceful image fallback.
         *
         * Notion's signed URLs expire (roughly 1 hour).
         * When that happens the image simply fails to load
         * and leaves a blank gap. Replace it with a link
         * so the image is still reachable.
         */

        content.querySelectorAll(
            "img"
        ).forEach(img => {

            const src =
                img.getAttribute(
                    "src"
                );

            if (!src) {
                return;
            }

            img.addEventListener(
                "error",
                function () {

                    if (
                        img.dataset.onerrorHandled ===
                        "true"
                    ) {
                        return;
                    }

                    img.dataset.onerrorHandled =
                        "true";

                    const link =
                        document.createElement(
                            "a"
                        );

                    link.href = src;

                    link.target =
                        "_blank";

                    link.rel =
                        "noopener noreferrer";

                    link.className =
                        "notion-image-fallback";

                    link.textContent =
                        "🔗 click to open this image";

                    img.parentNode.replaceChild(
                        link,
                        img
                    );

                }
            );

        });


        /*
         * Make links open safely.
         */

        const links =
            content.querySelectorAll(
                "a"
            );


        links.forEach(link => {

            const href =
                link.getAttribute(
                    "href"
                );


            if (
                href &&
                (
                    href.startsWith(
                        "http://"
                    ) ||
                    href.startsWith(
                        "https://"
                    )
                )
            ) {

                link.target =
                    "_blank";

                link.rel =
                    "noopener noreferrer";

            }

        });


        /*
         * Interactive to-do checkboxes.
         *
         * Notion's to_do blocks are rendered as markdown
         * task lists (`- [ ]`). They come back disabled —
         * we enable them and PATCH Notion when clicked.
         */

        const todoBlocks =
            page.todo_blocks || [];

        const renderedBoxes =
            content.querySelectorAll(
                ".notion-rendered input[type=checkbox]"
            );


        if (
            todoBlocks.length &&
            renderedBoxes.length
        ) {

            renderedBoxes.forEach((box, index) => {

                const todo =
                    todoBlocks[
                        Math.min(
                            index,
                            todoBlocks.length - 1
                        )
                    ];

                const blockId =
                    todo && todo.id;

                if (!blockId) {
                    return;
                }

                box.disabled = false;

                box.title = "Tick to update Notion";

                box.addEventListener(
                    "change",
                    function () {

                        const checked =
                            box.checked;

                        box.disabled = true;

                        notionAPI(
                            "todo",
                            {
                                id: blockId,
                                checked: checked
                            },
                            "PATCH"
                        ).then(() => {

                            box.disabled = false;

                        }).catch(error => {

                            console.error(
                                "Notion todo error:",
                                error
                            );

                            box.checked =
                                !checked;

                            box.disabled = false;

                            showStatus(
                                "Couldn't update: " + error.message
                            );

                        });

                    }
                );

            });

        }


        /*
         * Scroll back to top.
         */

        content.scrollTop = 0;

    }


    /* =====================================================
       EMBEDDED DATABASE (inside a page)
    ===================================================== */

    const embeddedCache = {};

    async function loadEmbeddedDatabase(
        holder,
        entry
    ) {

        if (!entry.id) {

            holder.textContent =
                "(database unavailable)";

            return;

        }

        if (embeddedCache[entry.id]) {

            renderEmbeddedDatabase(
                holder,
                entry,
                embeddedCache[entry.id]
            );

            return;

        }

        try {

            const data =
                await notionAPI(
                    "database",
                    {
                        id: entry.id
                    }
                );

            embeddedCache[entry.id] =
                data;

            renderEmbeddedDatabase(
                holder,
                entry,
                data
            );

        } catch (error) {

            console.error(
                "Notion embedded database error:",
                error
            );

            holder.textContent =
                "Couldn't load database.";

        }

    }


    function renderEmbeddedDatabase(
        holder,
        entry,
        data
    ) {

        const db =
            data.database || {};

        const props =
            orderColumns(
                db,
                data.properties || []
            );

        const rows =
            data.rows || [];

        const statusOptionsRef = {};

        props.forEach(col => {

            if (
                col.type === "status" &&
                Array.isArray(col.options)
            ) {

                statusOptionsRef[col.id] =
                    col.options;

            }

        });

        const title =
            entry.title ||
            db.title ||
            "Untitled";

        holder.innerHTML =

            `<div class="notion-embedded-db-head">

                <span class="notion-embedded-db-icon">🗄️</span>

                <span class="notion-embedded-db-title">
                    ${escapeHTML(title)}
                </span>

            </div>

            ${buildDatabaseHtml(
                db,
                props,
                rows
            )}`;


        wireDatabaseToggles(
            holder,
            props,
            rows,
            statusOptionsRef
        );

    }


    /* =====================================================
       ACTIVE PAGE
    ===================================================== */

    function setActivePage(
        pageId
    ) {

        const buttons =
            pageList.querySelectorAll(
                ".notion-page"
            );


        buttons.forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.pageId === pageId
            );

        });

    }


    /* =====================================================
       LOADING STATES
    ===================================================== */

    function showPageLoading(
        text = "loading..."
    ) {

        pageList.innerHTML = `

            <div class="notion-loading">
                ${escapeHTML(text)}
            </div>

        `;

    }


    function showContentLoading() {

        content.innerHTML = `

            <div class="notion-welcome">

                <div class="notion-welcome-icon">
                    ⌛
                </div>

                <p>
                    loading page...
                </p>

            </div>

        `;

    }


    /* =====================================================
       ERROR STATES
    ===================================================== */

    function showPageError(
        message
    ) {

        pageList.innerHTML = `

            <div class="notion-error">

                <b>Couldn't load Notion.</b>

                <br><br>

                ${escapeHTML(message)}

            </div>

        `;

    }


    function showContentError(
        message
    ) {

        content.innerHTML = `

            <div class="notion-error">

                <b>Couldn't open this page.</b>

                <br><br>

                ${escapeHTML(message)}

            </div>

        `;

    }


    /* =====================================================
       STATUS
    ===================================================== */

    function showStatus(
        message
    ) {

        status.textContent =
            message;

        status.classList.add(
            "show"
        );

    }


    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHTML(value) {

        const div =
            document.createElement(
                "div"
            );


        div.textContent =
            String(value);


        return div.innerHTML;

    }


    /* =====================================================
       SEARCH INPUT
    ===================================================== */

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            function () {

                const query =
                    searchInput.value;


                clearTimeout(
                    searchTimeout
                );


                searchTimeout =
                    setTimeout(
                        function () {

                            searchPages(
                                query
                            );

                        },
                        350
                    );

            }
        );

    }


    /* =====================================================
       REFRESH
    ===================================================== */

    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            function () {

                loadPages();

            }
        );

    }


    /* =====================================================
       INITIALISE
    ===================================================== */

    loadPages();


})();