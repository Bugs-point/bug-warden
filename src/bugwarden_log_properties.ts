export class BugwardenLogProperties {
  constructor(
    public ip?: string,
    public timestamp?: string,
    public method?: string,
    public originalURL?: string,
    public httpVersion?: string,
    public statusCode?: string,
    public contentLength?: string,
    public referrer?: string,
    public userAgent?: string,
    public responseTime?: string
  ) {
    this.ip = ip;
    this.timestamp = timestamp;
    this.method = method;
    this.originalURL = originalURL;
    this.httpVersion = httpVersion;
    this.statusCode = statusCode;
    this.contentLength = contentLength;
    this.referrer = referrer;
    this.userAgent = userAgent;
    this.responseTime = responseTime;
  }
}
