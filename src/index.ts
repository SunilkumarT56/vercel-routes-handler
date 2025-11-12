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

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION || "us-east-1",
});

const s3 = new AWS.S3();
const BUCKET = process.env.AWS_S3_BUCKET || "";

/**
 * 🧱 Serve main HTML page (✅ base tag removed)
 */
app.get(["/projects/:repoId", "/projects/:repoId/index.html"], async (req, res) => {
  const { repoId } = req.params;
  const key = `main/${repoId}/index.html`;

  try {
    const file = await s3.getObject({ Bucket: BUCKET, Key: key }).promise();

    if (!file.Body) {
      console.error("❌ No content found for key:", key);
      return res.status(404).send("Project not found");
    }

    let bodyStr = file.Body.toString();

    // ✅ Keep your old URL replacements exactly
    bodyStr = bodyStr
      .replace(/src="\//g, `src="/projects/${repoId}/`)
      .replace(/href="\//g, `href="/projects/${repoId}/`)
      .replace(/content="\//g, `content="/projects/${repoId}/`); // handles icons, meta images

    res.setHeader("Content-Type", "text/html");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.send(bodyStr);
  } catch (err) {
    console.error("❌ Error fetching HTML:", err);
    res.status(404).send("Project not found");
  }
});

/**
 * ⚙️ Serve static assets (JS, CSS, images, etc.)
 */
app.get(/^\/projects\/([^/]+)\/(.*)/, async (req, res) => {
  const repoId = req.params[0];
  const filePath = req.params[1] || "";
  const key = `main/${repoId}/${filePath}`;

  try {
    const file = await s3.getObject({ Bucket: BUCKET, Key: key }).promise();

    const ext = path.extname(filePath || "").toLowerCase();
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
    res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day
    res.send(file.Body);
  } catch (err) {
    console.error(`❌ Asset not found for key: ${key}`);
    res.status(404).send("Asset not found");
  }
});
// ✅ Handle React client routes inside project
app.get(/^\/projects\/([^/]+)\/.*$/, async (req, res) => {
  const repoId = req.params[0];
  const key = `main/${repoId}/index.html`;

  try {
    const file = await s3.getObject({ Bucket: BUCKET, Key: key }).promise();

    if (!file.Body) {
      console.error("❌ No index.html found for SPA route:", key);
      return res.status(404).send("Project not found");
    }

    let bodyStr = file.Body.toString();

    // ✅ Keep your path replacements
    bodyStr = bodyStr
      .replace(/src="\//g, `src="/projects/${repoId}/`)
      .replace(/href="\//g, `href="/projects/${repoId}/`)
      .replace(/content="\//g, `content="/projects/${repoId}/`);

    res.setHeader("Content-Type", "text/html");
    res.send(bodyStr);
  } catch (err) {
    console.error("❌ SPA route fetch failed:", err);
    res.status(404).send("Project not found");
  }
});
/**
 * 🚀 Start the server
 */
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
