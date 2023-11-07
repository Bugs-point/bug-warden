/**
 * Function to paint a text with color based on HTTP status code ranges.
 * @param {string} text - The text to be colored.
 * @param {number} statusCode - The HTTP status code.
 * @returns {string} - The colored text.
 */
function paintShop(text, statusCode) {
  let colorCode =
    statusCode >= 200 && statusCode < 300
      ? "\x1b[32m" // Green for 2xx status codes
      : statusCode >= 300 && statusCode < 400
      ? "\x1b[36m" // Cyan for 3xx status codes
      : statusCode >= 400 && statusCode < 500
      ? "\x1b[33m" // Yellow for 4xx status codes
      : statusCode >= 500
      ? "\x1b[31m" // Red for 5xx status codes
      : "\x1b[0m"; // Default color (reset)
  return `${colorCode}${text}\x1b[0m`;
}

/**
 * Middleware function for logging HTTP request details and response time.
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {function} next - The next middleware function.
 */

function BugWarden(req, res, next) {
  const startTime = Date.now();
  // listener
  res.on("finish", () => {
    const elapsedTime = Date.now() - startTime;
    const ip = req.ip;
    const timestamp = new Date().toUTCString();
    const method = req.method;
    const originalUrl = req.originalUrl;
    const httpVersion = `HTTP/${req.httpVersion}`;
    const status = +res.statusCode;
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

    console.log(paintShop(logDetails, status));
  });

  next();
}

module.exports = BugWarden;
