# Third-party notices

## DeepSeek Harness Windows ACL sandbox

- Package: `@deepseek-ai/dsh-sandbox-windows-acl`
- Version: `0.1.0-rc.8`
- License: MIT
- Source: https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/sandbox/sandbox-windows-acl

This plugin only calls the package's public `AclSandbox`, `workspaceWriteSid`, and `tempWriteSid` APIs. It does not copy or modify its Win32, token, ACL, or Job Object implementation.

## Koffi

- Package: `koffi`, `@koromix/koffi-win32-x64`, and `@koromix/koffi-win32-arm64`
- Version: `3.1.2`
- License: MIT
- Source: https://github.com/Koromix/koffi

The Windows x64 and ARM64 Koffi prebuilds are embedded in `main.js` and extracted only into the Electron user-data directory after a version, architecture, byte-length, and SHA-256 check. SHA-256 checks integrity; it is not a signature.
