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
