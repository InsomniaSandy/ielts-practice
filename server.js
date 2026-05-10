const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.static("public"));
app.use(express.static(__dirname));

// 🔥 AUTO SCANNER (no lists needed)
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

// 📘 READING AUTO API
app.get("/api/reading", (req, res) => {
    res.json(scan(path.join(__dirname, "Reading"), "Reading/"));
});

// 🎧 LISTENING AUTO API
app.get("/api/listening", (req, res) => {
    res.json(scan(path.join(__dirname, "Listening"), "Listening/"));
});

// ✍️ WRITING AUTO API
app.get("/api/writing", (req, res) => {
    res.json(scan(path.join(__dirname, "Writing"), "Writing/"));
});

app.listen(3000, () => {
    console.log("IELTS system running: http://localhost:3000");
});
