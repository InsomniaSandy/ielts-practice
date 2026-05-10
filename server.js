const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

// =====================
// 1. API ROUTES
// =====================
function scan(dir, base) {
    let results = [];
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            results = results.concat(scan(full, base + file + "/"));
        } else if (file.endsWith(".html")) {
            const content = fs.readFileSync(full, "utf8");
            const h4 = content.match(/<h4[^>]*>(.*?)<\/h4>/i);
            const centered = content.match(/<p[^>]*class="centered-title"[^>]*>(.*?)<\/p>/i);
            const match = h4 || centered;
            const title = match ? match[1].replace(/<[^>]*>/g, "").trim() : null;
            results.push({ name: file, path: base + file, title });
        }
    });
    return results;
}

app.get("/api/reading",   (req, res) => res.json(scan(path.join(__dirname, "Reading"),   "Reading/")));
app.get("/api/listening", (req, res) => res.json(scan(path.join(__dirname, "Listening"), "Listening/")));
app.get("/api/writing",   (req, res) => res.json(scan(path.join(__dirname, "Writing"),   "Writing/")));

// =====================
// 2. HTML HANDLER
// =====================
app.use(function (req, res, next) {
    if (!req.path.toLowerCase().endsWith(".html")) return next();

    const filePath = path.join(__dirname, decodeURIComponent(req.path));
    if (!fs.existsSync(filePath)) return next();

    let html = fs.readFileSync(filePath, "utf8");

    // Remove Telegram links
    html = html.replace(/<a[^>]*href="https:\/\/t\.me\/[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "");

    // Styles
    const cleanStyle = `
        <style>
            body { background: #ffffff !important; }
            * { box-shadow: none !important; }

            /* Pop-up menu */
            #hl-popup {
                position: absolute;
                display: none;
                z-index: 99999;
                background: #1a1a1a;
                border-radius: 8px;
                padding: 0;
                overflow: hidden;
                box-shadow: 0 4px 16px rgba(0,0,0,0.35) !important;
                user-select: none;
                flex-direction: row;
            }
            #hl-popup.visible { display: flex; }
            .hl-popup-btn {
                color: #fff;
                font-size: 13px;
                font-weight: 500;
                padding: 9px 16px;
                cursor: pointer;
                border: none;
                background: transparent;
                white-space: nowrap;
                transition: background 0.15s;
            }
            .hl-popup-btn:hover { background: rgba(255,255,255,0.12); }
            .hl-popup-divider {
                width: 1px;
                background: rgba(255,255,255,0.15);
                margin: 6px 0;
            }

            /* Triangle arrow below popup */
            #hl-popup::after {
                content: "";
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                border: 6px solid transparent;
                border-top-color: #1a1a1a;
            }

            /* Highlight style */
            mark[data-hl] {
                background: #ffe066;
                border-radius: 2px;
                padding: 0;
                cursor: pointer;
            }

            /* Note tooltip */
            mark[data-note]::after {
                content: "📝";
                font-size: 11px;
                vertical-align: super;
                margin-left: 1px;
            }
            mark[data-note]:hover .note-tooltip,
            .note-tooltip:hover {
                display: block;
            }
            .note-tooltip {
                display: none;
                position: absolute;
                background: #fffbe6;
                border: 1px solid #f0c040;
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 13px;
                color: #333;
                max-width: 240px;
                z-index: 99998;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
                white-space: pre-wrap;
                pointer-events: none;
            }

            /* Note dialog */
            #note-dialog-overlay {
                display: none;
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.4);
                z-index: 999999;
                align-items: center;
                justify-content: center;
            }
            #note-dialog-overlay.visible { display: flex; }
            #note-dialog {
                background: #fff;
                border-radius: 12px;
                padding: 20px;
                width: 300px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.25) !important;
            }
            #note-dialog h3 {
                margin: 0 0 12px;
                font-size: 15px;
                color: #333;
            }
            #note-textarea {
                width: 100%;
                height: 100px;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 8px;
                font-size: 14px;
                resize: none;
                box-sizing: border-box;
                outline: none;
            }
            #note-textarea:focus { border-color: #f0c040; }
            .note-dialog-btns {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-top: 12px;
            }
            .note-dialog-btns button {
                padding: 7px 18px;
                border-radius: 6px;
                border: none;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
            }
            #note-cancel { background: #f0f0f0; color: #555; }
            #note-save   { background: #f0c040; color: #333; }
        </style>
    `;
    html = html.replace("</head>", cleanStyle + "</head>");

    // Popup + note dialog + logic
    const highlightScript = `
        <!-- Pop-up menu -->
        <div id="hl-popup">
            <button class="hl-popup-btn" id="hl-do">Highlight</button>
            <div class="hl-popup-divider"></div>
            <button class="hl-popup-btn" id="hl-note-btn">Note</button>
            <div class="hl-popup-divider"></div>
            <button class="hl-popup-btn" id="hl-remove" style="display:none;">Remove</button>
        </div>

        <!-- Note dialog -->
        <div id="note-dialog-overlay">
            <div id="note-dialog">
                <h3>Add a note</h3>
                <textarea id="note-textarea" placeholder="Type your note here..."></textarea>
                <div class="note-dialog-btns">
                    <button id="note-cancel">Cancel</button>
                    <button id="note-save">Save</button>
                </div>
            </div>
        </div>

        <script>
        (function() {
            const popup   = document.getElementById("hl-popup");
            const hlBtn   = document.getElementById("hl-do");
            const noteBtn = document.getElementById("hl-note-btn");
            const removeBtn = document.getElementById("hl-remove");
            const overlay = document.getElementById("note-dialog-overlay");
            const textarea = document.getElementById("note-textarea");
            const noteSave   = document.getElementById("note-save");
            const noteCancel = document.getElementById("note-cancel");

            let savedRange = null;
            let activeNote = null; // mark element being noted

            // ---- Expand range to full words ----
            function expandToWords(range) {
                const start = range.startContainer;
                const end   = range.endContainer;

                if (start.nodeType === Node.TEXT_NODE) {
                    let offset = range.startOffset;
                    while (offset > 0 && start.textContent[offset - 1] !== " " && start.textContent[offset - 1] !== "\\n") offset--;
                    range.setStart(start, offset);
                }
                if (end.nodeType === Node.TEXT_NODE) {
                    let offset = range.endOffset;
                    while (offset < end.textContent.length && end.textContent[offset] !== " " && end.textContent[offset] !== "\\n") offset++;
                    range.setEnd(end, offset);
                }
                return range;
            }

            // ---- Show popup above selection ----
            function showPopup(x, y, onMark) {
                removeBtn.style.display = onMark ? "block" : "none";
                popup.classList.add("visible");
                popup.style.left = x + "px";
                popup.style.top  = (y - 48) + "px";
            }

            function hidePopup() {
                popup.classList.remove("visible");
            }

            // ---- Apply highlight ----
            function applyHighlight(range, noteText) {
                const mark = document.createElement("mark");
                mark.dataset.hl = "1";
                if (noteText) mark.dataset.note = noteText;

                try {
                    range.surroundContents(mark);
                } catch(e) {
                    mark.appendChild(range.extractContents());
                    range.insertNode(mark);
                }

                // Click on mark to show popup with Remove
                mark.addEventListener("click", (e) => {
                    e.stopPropagation();
                    savedRange = null;
                    activeNote = mark;
                    const rect = mark.getBoundingClientRect();
                    showPopup(rect.left + rect.width / 2 - popup.offsetWidth / 2 + window.scrollX,
                               rect.top + window.scrollY, true);
                });

                return mark;
            }

            // ---- Mouse up: show popup on text selection ----
            document.addEventListener("mouseup", (e) => {
                if (popup.contains(e.target)) return;
                if (overlay.contains(e.target)) return;

                const sel = window.getSelection();
                if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
                    hidePopup();
                    activeNote = null;
                    return;
                }

                const range = expandToWords(sel.getRangeAt(0).cloneRange());
                sel.removeAllRanges();
                sel.addRange(range);

                if (range.collapsed) { hidePopup(); return; }

                savedRange = range;
                activeNote = null;
                removeBtn.style.display = "none";

                const rect = range.getBoundingClientRect();
                const x = rect.left + rect.width / 2 - 70 + window.scrollX;
                const y = rect.top + window.scrollY;
                showPopup(x, y, false);
            });

            // ---- Highlight button ----
            hlBtn.addEventListener("click", () => {
                if (savedRange) {
                    applyHighlight(savedRange);
                    savedRange = null;
                }
                window.getSelection().removeAllRanges();
                hidePopup();
            });

            // ---- Note button ----
            noteBtn.addEventListener("click", () => {
                hidePopup();
                textarea.value = activeNote ? (activeNote.dataset.note || "") : "";
                overlay.classList.add("visible");
                textarea.focus();
            });

            // ---- Save note ----
            noteSave.addEventListener("click", () => {
                const text = textarea.value.trim();
                overlay.classList.remove("visible");

                if (activeNote) {
                    // Edit note on existing mark
                    if (text) activeNote.dataset.note = text;
                    else delete activeNote.dataset.note;
                } else if (savedRange) {
                    if (text) applyHighlight(savedRange, text);
                    else applyHighlight(savedRange);
                    savedRange = null;
                }
                window.getSelection().removeAllRanges();
                activeNote = null;
            });

            // ---- Cancel note ----
            noteCancel.addEventListener("click", () => {
                overlay.classList.remove("visible");
                activeNote = null;
            });

            // ---- Remove highlight ----
            removeBtn.addEventListener("click", () => {
                if (activeNote) {
                    activeNote.replaceWith(document.createTextNode(activeNote.textContent));
                    activeNote = null;
                }
                hidePopup();
            });

            // ---- Hide popup on outside click ----
            document.addEventListener("mousedown", (e) => {
                if (!popup.contains(e.target) && !overlay.contains(e.target)) {
                    hidePopup();
                }
            });

            // ---- Note tooltip on hover ----
            document.addEventListener("mouseover", (e) => {
                const mark = e.target.closest("mark[data-note]");
                if (!mark) return;
                let tip = mark.querySelector(".note-tooltip");
                if (!tip) {
                    tip = document.createElement("div");
                    tip.className = "note-tooltip";
                    mark.appendChild(tip);
                }
                tip.textContent = mark.dataset.note;
                tip.style.display = "block";
                const rect = mark.getBoundingClientRect();
                tip.style.left = "0";
                tip.style.top  = (mark.offsetHeight + 4) + "px";
            });
            document.addEventListener("mouseout", (e) => {
                const mark = e.target.closest("mark[data-note]");
                if (!mark) return;
                const tip = mark.querySelector(".note-tooltip");
                if (tip) tip.style.display = "none";
            });
        })();
        </script>
    `;
    html = html.replace("</body>", highlightScript + "</body>");

    // Audio player if MP3 exists
    const folder = path.dirname(filePath);
    const dirFiles = fs.readdirSync(folder);
    const mp3 = dirFiles.find(f => f.toLowerCase().endsWith(".mp3"));

    if (mp3) {
        const audioDir = path.dirname(req.path);
        const audioUrl = audioDir + "/" + encodeURIComponent(mp3);
        const inject = `
            <audio id="autoAudio" controls autoplay loop style="position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:9999;width:90%;max-width:500px;background:#fff;border-radius:0;box-shadow:0 4px 20px rgba(0,0,0,0.3) !important;padding:4px;">
                <source src="${audioUrl}" type="audio/mpeg">
            </audio>
            <script>
                window.addEventListener("load", () => {
                    const a = document.getElementById("autoAudio");
                    if (a) a.play().catch(() => {});
                });
            </script>
        `;
        html = html.replace("</body>", inject + "</body>");
    }

    res.send(html);
});

// =====================
// 3. STATIC FILES
// =====================
app.use(express.static(__dirname));

// =====================
// 4. START SERVER
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("IELTS system running on http://localhost:" + PORT);
});
