function BugWarden(req, res, next) {
  const startTime = Date.now();
  res.on("finish", () => {
    console.log("my directory + ", __dirname);
    const elapsedTime = Date.now() - startTime;
    const logDetails = `
      IP: ${req.ip}
      Timestamp: [${new Date().toUTCString()}]
      Method: "${req.method} ${req.originalUrl} HTTP/${req.httpVersion}"
      Status: ${res.statusCode}
      Content-Length: ${res.getHeader("content-length") || 0}
      Referrer: "${req.get("referrer") || "-"}"
      User-Agent: "${req.get("user-agent")}"
      Response-Time: ${elapsedTime}ms
    `;
    console.log(logDetails);
  });
  next();
}

module.exports = BugWarden;
