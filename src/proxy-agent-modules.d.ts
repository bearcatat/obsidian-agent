declare module "http-proxy-agent" {
  export class HttpProxyAgent {
    constructor(proxyUrl: string | URL);
  }
}

declare module "https-proxy-agent" {
  export class HttpsProxyAgent {
    constructor(proxyUrl: string | URL);
  }
}

declare module "socks-proxy-agent" {
  export class SocksProxyAgent {
    constructor(proxyUrl: string | URL);
  }
}