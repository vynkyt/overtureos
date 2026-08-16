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

    async function notionAPI(action, params = {}) {

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
                    method: "GET",
                    headers: {
                        "Accept":
                            "application/json"
                    }
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
         * Sort alphabetically.
         */

        function sortNodes(list) {

            list.sort(
                (a, b) =>
                    a.page.title
                        .localeCompare(
                            b.page.title
                        )
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
        depth
    ) {

        const page =
            node.page;


        const button =
            document.createElement(
                "button"
            );


        button.type = "button";

        button.className =
            "notion-page";


        button.dataset.pageId =
            page.id;


        button.style.paddingLeft =
            `${8 + depth * 15}px`;


        button.innerHTML = `

            <span class="notion-page-icon">
                ${escapeHTML(
                    page.icon || "📄"
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

                openNotionPage(
                    page.id
                );

            }
        );


        pageList.appendChild(
            button
        );


        /*
         * Children
         */

        node.children.forEach(
            child => {

                renderPageNode(
                    child,
                    depth + 1
                );

            }
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
         * Scroll back to top.
         */

        content.scrollTop = 0;

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