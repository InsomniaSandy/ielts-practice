const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.static(__dirname));

// 🔥 AUTO INJECT AUDIO INTO HTML RESPONSE
app.get("*/test.html", (req, res) => {

    const filePath = path.join(__dirname, req.path);

    let html = fs.readFileSync(filePath, "utf8");

    // folder where HTML is located
    const folder = path.dirname(filePath);

    // find ANY mp3 in same folder
    const files = fs.readdirSync(folder);
    const mp3 = files.find(f => f.endsWith(".mp3"));

    if (mp3) {
        const audioTag = `
            <audio id="autoAudio" autoplay>
                <source src="${mp3}" type="audio/mpeg">
            </audio>

            <script>
                window.onload = () => {
                    const a = document.getElementById("autoAudio");
                    if (a) {
                        a.play().catch(() => {});
                    }
                }
            </script>
        `;

        // inject before closing body
        html = html.replace("</body>", audioTag + "</body>");
    }

    res.send(html);
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});