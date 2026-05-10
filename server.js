const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

// =====================
// 1. STATIC FILES
// =====================
app.use(express.static(__dirname));


// =====================
// 2. API ROUTES (IMPORTANT - DO NOT TOUCH HTML LOGIC HERE)
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
            results.push({
                name: file,
                path: base + file
            });
        }
    });

    return results;
}

app.get("/api/reading", (req, res) => {
    res.json(scan(path.join(__dirname, "Reading"), "Reading/"));
});

app.get("/api/listening", (req, res) => {
    res.json(scan(path.join(__dirname, "Listening"), "Listening/"));
});

app.get("/api/writing", (req, res) => {
    res.json(scan(path.join(__dirname, "Writing"), "Writing/"));
});


// =====================
// 3. AUDIO AUTO-INJECT (ONLY FOR TEST PAGES)
// =====================
app.get("*.html", (req, res, next) => {

    const filePath = path.join(__dirname, req.path);

    if (!fs.existsSync(filePath)) {
        return next();
    }

    let html = fs.readFileSync(filePath, "utf8");

    const folder = path.dirname(filePath);

    let mp3 = null;

    try {
        const files = fs.readdirSync(folder);
        mp3 = files.find(f => f.endsWith(".mp3"));
    } catch (e) {}

    if (mp3) {
        const inject = `
            <audio id="autoAudio" autoplay>
                <source src="${mp3}" type="audio/mpeg">
            </audio>

            <script>
                window.addEventListener("load", () => {
                    const a = document.getElementById("autoAudio");
                    if (a) a.play().catch(()=>{});
                });
            </script>
        `;

        html = html.replace("</body>", inject + "</body>");
    }

    res.send(html);
});


// =====================
// 4. START SERVER
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("IELTS system running on http://localhost:" + PORT);
});