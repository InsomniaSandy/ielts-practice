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
            // Extract title from <h4> or <p class="centered-title">
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

    // Make background white and clean
    const cleanStyle = `
        <style>
            body { background: #ffffff !important; }
            * { box-shadow: none !important; }
        </style>
    `;
    html = html.replace("</head>", cleanStyle + "</head>");

    // Inject audio player if MP3 exists in same folder
    const folder = path.dirname(filePath);
    const files  = fs.readdirSync(folder);
    const mp3    = files.find(f => f.toLowerCase().endsWith(".mp3"));

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
