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
            results.push({ name: file, path: base + file });
        }
    });
    return results;
}

app.get("/api/reading",   (req, res) => res.json(scan(path.join(__dirname, "Reading"),   "Reading/")));
app.get("/api/listening", (req, res) => res.json(scan(path.join(__dirname, "Listening"), "Listening/")));
app.get("/api/writing",   (req, res) => res.json(scan(path.join(__dirname, "Writing"),   "Writing/")));

// =====================
// 2. HTML HANDLER - injects audio player
// =====================
app.use(function (req, res, next) {
    if (!req.path.toLowerCase().endsWith(".html")) return next();

    const filePath = path.join(__dirname, decodeURIComponent(req.path));

    if (!fs.existsSync(filePath)) return next();

    let html = fs.readFileSync(filePath, "utf8");

    const folder = path.dirname(filePath);
    const files  = fs.readdirSync(folder);
    const mp3    = files.find(f => f.toLowerCase().endsWith(".mp3"));

    if (mp3) {
        const audioDir = path.dirname(req.path);
        const audioUrl = audioDir + "/" + encodeURIComponent(mp3);

        const inject = `
            <audio id="autoAudio" controls autoplay loop style="position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:9999;width:90%;max-width:500px;background:#fff;border-radius:0;box-shadow:0 4px 20px rgba(0,0,0,0.3);padding:4px;">
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
// 3. STATIC FILES (CSS, MP3, images, etc.)
// =====================
app.use(express.static(__dirname));

// =====================
// 4. START SERVER
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("IELTS system running on http://localhost:" + PORT);
});
