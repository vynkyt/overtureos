/* =========================================================
   NOTION CONFIG

   This is the ONLY file you need to touch for:
   - column order of database tables
   - (future: sorting / visuals)

   Every entry below is optional. Leave something out and the
   app just uses the order Notion returns for that database.

   Key ideas:
   - databases can match by ID or by title.
   - The "Title" column is ALWAYS first (leftmost) and cannot
     be moved.
   - Column names must match exactly what you see in Notion
     (case-sensitive).
   ========================================================= */

(function () {

    "use strict";

    window.NOTION_CONFIG = {

        /* -------------------------------------------------
           COLUMN ORDER (per database)
           ------------------------------------------------
           Put the columns you want, in the order you want,
           directly after the always-first "Title" column.

           Any columns you don't list are appended afterwards
           in Notion's default order.

           Example:
           columnOrder: {
               "Physics AS-Levels": ["Lecture", "Notes", "Tutorial"],
               "Some Other DB": ["My First Col", "My Second Col"]
           }
        ------------------------------------------------- */

        columnOrder: {

            "Physics AS-Levels": [
                "Lecture",
                "Notes",
                "Anki review",
                "Cheated review",
                "Anki",
                "Tutorial"
            ],

            "Physics A2-Level": [
                "Lecture",
                "Notes",
                "Anki review",
                "Cheated review",
                "Anki",
                "Tutorial"
            ]

        }

    };

})();