const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

// 📁 serve static files (css, mp3, html, etc.)
app.use(express.static(__dirname));

/**
 * 🎧 AUTO INJECT AUDIO INTO Listening test HTML
 * Works for ANY test.html inside ANY folder
 */
app.use((req, res, next) => {

    // Only handle HTML test files
    if (!req.path.endsWith(".html")) {
        return next();
    }

    const filePath = path.join(__dirname, req.path);

    // If file doesn't exist → continue normally
    if (!fs.existsSync(filePath)) {
        return next();
    }

    let html = fs.readFileSync(filePath, "utf8");

    const folder = path.dirname(filePath);

    let mp3File = null;

    try {
        const files = fs.readdirSync(folder);
        mp3File = files.find(f => f.endsWith(".mp3"));
    } catch (err) {
        console.log("Folder read error:", err.message);
    }

    // 🎧 inject audio if found
    if (mp3File) {

        const audioBlock = `
            <audio id="autoAudio" autoplay>
                <source src="${mp3File}" type="audio/mpeg">
            </audio>

            <script>
                window.addEventListener("load", () => {
                    const audio = document.getElementById("autoAudio");
                    if (audio) {
                        audio.play().catch(() => {
                            console.log("Autoplay blocked by browser");
                        });
                    }
                });
            </script>
        `;

        html = html.replace("</body>", audioBlock + "</body>");
    }

    res.send(html);
});

// 🏠 OPTIONAL: home route (if needed)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`IELTS system running on http://localhost:${PORT}`);
});