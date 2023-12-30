/**
 * Function to paint a text with color based on HTTP status code ranges.
 * @param {string} text - The text to be colored.
 * @param {number} statusCode - The HTTP status code.
 * @returns {string} - The colored text.
 */
export function paintShop(text: string, statusCode: number): string {
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
