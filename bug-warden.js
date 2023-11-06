const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("../../bugwarden.db");

function dbMigrate() {
  db.exec(`
    CREATE TABLE api_monitoring_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      ip TEXT NOT NULL,
      timestamp DATETIME NOT NULL,
      method TEXT NOT NULL,
      original_url TEXT NOT NULL,
      http_version TEXT NOT NULL,
      status TEXT NOT NULL,
      content_length TEXT NOT NULL,
      referrer TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      response_time TEXT NOT NULL
    );
  `);
}

function BugWarden(req, res, next) {
  dbMigrate();

  const startTime = Date.now();
  // listener
  res.on("finish", () => {
    const elapsedTime = Date.now() - startTime;
    const ip = req.ip;
    const timestamp = new Date().toUTCString();
    const method = req.method;
    const originalUrl = req.originalUrl;
    const httpVersion = `HTTP/${req.httpVersion}`;
    const status = res.statusCode;
    const contentLength = `${res.getHeader("content-length") || 0}`;
    const referrer = `${req.get("referrer") || "-"}`;
    const userAgent = `${req.get("user-agent")}`;
    const responseTime = `${elapsedTime}ms`;

    const logDetails = `
      IP: ${ip}
      Timestamp: [${timestamp}]
      Method: ${method}
      OriginalUrl: ${originalUrl}
      HttpVersion: ${httpVersion}
      Status: ${status}
      Content-Length: ${contentLength}
      Referrer: ${referrer}
      User-Agent: "${userAgent}"
      Response-Time: ${responseTime}
    `;

    // Inserting logs into db
    dbInsert(
      ip,
      timestamp,
      method,
      originalUrl,
      httpVersion,
      status,
      contentLength,
      referrer,
      userAgent,
      responseTime
    );

    console.log(logDetails);
  });

  next();
}

function dbInsert(
  ip,
  timestamp,
  method,
  originalUrl,
  httpVersion,
  status,
  contentLength,
  refferrer,
  userAgent,
  responseTime
) {
  db.exec(`
  INSERT INTO your_table_name (
    ip, 
    timestamp, 
    method, 
    original_url,
    http_version,
    status, 
    contentlength,
    referrer, 
    user_agent, 
    response_time
    )
  VALUES (
    '${ip}', 
    '${timestamp}', 
    '${method}', 
    '${originalUrl}', 
    '${httpVersion}', 
    '${status}, 
    '${contentLength}'
    '${refferrer}'
    '${userAgent}'
    '${responseTime}'
    );
  `);
}

module.exports = BugWarden;
