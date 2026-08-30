# Third-party notices

## DeepSeek Harness Windows ACL sandbox

- Package: `@deepseek-ai/dsh-sandbox-windows-acl`
- Version: `0.1.0-rc.8`
- License: MIT
- Source: https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/sandbox/sandbox-windows-acl

This plugin calls the package's public `AclSandbox`, `workspaceWriteSid`, and `tempWriteSid` APIs. It also applies the repository-local [`patches/@deepseek-ai+dsh-sandbox-windows-acl+0.1.0-rc.8.patch`](../../../patches/@deepseek-ai+dsh-sandbox-windows-acl+0.1.0-rc.8.patch) during installation.

The patch changes only the pipe and inherited-runner spawn paths' `STARTUPINFOW` startup show state (`STARTF_USESHOWWINDOW` with `SW_HIDE`), plus matching type declarations and comments. It preserves `dwCreationFlags` (`0` for pipe, `CREATE_SUSPENDED`/`4` for runner), the restricted token, ACL grants, Job Object behavior, stdio, and permission semantics. It does not use `CREATE_NO_WINDOW` or `CREATE_NEW_CONSOLE`, and is not an upstream-released fix.

## Koffi

- Package: `koffi`, `@koromix/koffi-win32-x64`, and `@koromix/koffi-win32-arm64`
- Version: `3.1.2`
- License: MIT
- Source: https://github.com/Koromix/koffi

The Windows x64 and ARM64 Koffi prebuilds are embedded in `main.js` and extracted only into the Electron user-data directory after a version, architecture, byte-length, and SHA-256 check. SHA-256 checks integrity; it is not a signature.

## Managed Windows curl

- Package: curl for Windows
- Version: `8.21.0_7` (curl `8.21.0`)
- Source: https://curl.se/windows/
- License: curl license (MIT-like), retained in each managed install as `licenses/COPYING.txt`

Windows Bash downloads the fixed x64 or ARM64 curl.se archive only after the Bash hard guard and any required approval. The archive and every installed runtime/notice file are pinned by SHA-256. The managed runtime installs only `curl.exe`, the CA bundle, build metadata, and the notices for the actual static build dependencies; it does not install `trurl.exe`, libcurl libraries, headers, or documentation.

The curl.se `8.21.0_7` archives used here are built with LibreSSL 4.3.2, zlib-ng, zstd, brotli, PSL/libpsl, nghttp2, nghttp3, ngtcp2, libssh2, and certdata. Their upstream license files are retained under `licenses/` in the managed installation and are selected from the verified archive allowlist.

## fflate

- Package: `fflate`
- Version: `0.8.2`
- License: MIT
- Source: https://github.com/101arrowz/fflate

`fflate` is used only to decompress a curl archive after its fixed SHA-256 has been verified. A separate central-directory check rejects duplicate, absolute, traversal, backslash, and non-allowlisted ZIP entries before any output is written.
