import express from "express";
import cors from "cors";
import AWS from "aws-sdk";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const s3 = new AWS.S3({ region: process.env.AWS_REGION || "us-east-1" });
const BUCKET = process.env.AWS_S3_BUCKET || "";

/**
 * 🧱 Serve main HTML page (inject <base> + fix paths)
 */
app.get("/projects/:repoId", async (req, res) => {
  const { repoId } = req.params;
  const key = `main/${repoId}/index.html`;

  try {
    const file = await s3.getObject({ Bucket: BUCKET, Key: key }).promise();

    if (!file.Body) {
      console.error("❌ S3 object has no Body for key:", key);
      return res.status(404).send("Project not found");
    }

    let bodyStr = file.Body.toString();

    // ⚙️ Inject <base> tag so all relative assets load from /projects/:repoId/
    if (bodyStr.includes("<head>")) {
      bodyStr = bodyStr.replace(
        "<head>",
        `<head><base href="/projects/${repoId}/">`
      );
    } else {
      // fallback in case <head> missing
      bodyStr = `<base href="/projects/${repoId}/">` + bodyStr;
    }

    // ⚙️ Fix absolute paths like src="/..." or href="/..."
    // Changes "/assets/..." -> "assets/..."
    bodyStr = bodyStr
      .replace(/src="\//g, 'src="')
      .replace(/href="\//g, 'href="');

    res.setHeader("Content-Type", "text/html");
    res.setHeader("Cache-Control", "public, max-age=60"); // Optional cache
    res.send(bodyStr);
  } catch (err) {
    console.error("❌ Error fetching HTML from S3:", err);
    res.status(404).send("Project not found");
  }
});

/**
 * ⚙️ Serve static assets (CSS, JS, images, fonts, etc.)
 */
app.get("/projects/:repoId/*", async (req, res) => {
  const { repoId } = req.params;
  const filePath = ((req.params as any)[0] as string) || "";
  const key = `main/${repoId}/${filePath}`;

  try {
    const file = await s3.getObject({ Bucket: BUCKET, Key: key }).promise();

    // Detect content type by extension
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      ".js": "application/javascript",
      ".css": "text/css",
      ".html": "text/html",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
      ".ttf": "font/ttf",
      ".json": "application/json",
    };

    const contentType = contentTypes[ext] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache 1 day
    res.send(file.Body);
  } catch (err) {
    console.error(`❌ Asset not found in S3 for key: ${key}`);
    res.status(404).send("Asset not found");
  }
});

app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);