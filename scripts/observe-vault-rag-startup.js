(async () => {
  const pluginId = 'obsidian-agent';
  const observationMs = 35_000;
  const { vault, plugins } = app;
  const previousPlugin = plugins.getPlugin(pluginId);
  if (vault.getName() !== 'note' || !previousPlugin || !plugins.enabledPlugins.has(pluginId)) {
    throw new Error('Open note with Obsidian Agent enabled before running the H7 startup check.');
  }

  const watchedEvents = new Set(['create', 'modify', 'delete', 'rename']);
  const legacyWatcher = /\b(?:onVaultChanged|onVaultRenamed|VaultRagService)\b/;
  const counters = () => ({ vaultSubscriptions: 0, ragSubscriptions: 0, embeddingFetches: 0, embeddingXhrOpens: 0 });
  const control = counters();
  const observed = counters();
  let counts = control;
  const probe = new Request('https://h7-monitor.invalid/embeddings');

  const isEmbedding = (url) => {
    try {
      return /\/embeddings\/?$/i.test(new URL(url, window.location.href).pathname);
    } catch {
      return false;
    }
  };

  const restore = [];
  const patch = (target, name, makeWrapper) => {
    const own = Object.getOwnPropertyDescriptor(target, name);
    const wrapper = makeWrapper(target[name]);
    Object.defineProperty(target, name, { configurable: true, writable: true, value: wrapper });
    restore.push(() => {
      if (target[name] !== wrapper) return;
      if (own) Object.defineProperty(target, name, own);
      else delete target[name];
    });
  };

  let previousUnloaded;
  let began;
  try {
    patch(vault, 'on', (original) => function (name, callback, ...rest) {
      if (watchedEvents.has(name)) {
        counts.vaultSubscriptions += 1;
        if (typeof callback === 'function' && legacyWatcher.test(Function.prototype.toString.call(callback))) {
          counts.ragSubscriptions += 1;
        }
      }
      return Reflect.apply(original, this, [name, callback, ...rest]);
    });
    patch(window, 'fetch', (original) => function (input, ...rest) {
      if (isEmbedding(input?.url ?? input)) counts.embeddingFetches += 1;
      if (input === probe) return Promise.resolve(new Response(null, { status: 204 }));
      return Reflect.apply(original, this, [input, ...rest]);
    });
    patch(XMLHttpRequest.prototype, 'open', (original) => function (method, url, ...rest) {
      if (isEmbedding(url)) counts.embeddingXhrOpens += 1;
      return Reflect.apply(original, this, [method, url, ...rest]);
    });
    patch(previousPlugin, 'onunload', (original) => function (...args) {
      previousUnloaded = Promise.resolve(Reflect.apply(original, this, args));
      return previousUnloaded;
    });

    const eventRef = vault.on('modify', function onVaultChanged() {});
    vault.offref(eventRef);
    // The fetch wrapper responds locally. An XHR opened without send makes no network request.
    const response = await window.fetch(probe);
    new XMLHttpRequest().open('POST', probe.url);
    if (response.status !== 204 || Object.values(control).some((count) => count !== 1)) {
      throw new Error('H7 monitor positive controls did not match the expected counts.');
    }

    await plugins.disablePlugin(pluginId);
    if (!previousUnloaded || plugins.getPlugin(pluginId)) throw new Error('Obsidian Agent did not unload.');
    await previousUnloaded;

    counts = observed;
    began = Date.now();
    const enabled = await plugins.enablePlugin(pluginId);
    await new Promise((resolve) => setTimeout(resolve, observationMs));
    const currentPlugin = plugins.getPlugin(pluginId);
    if (!enabled || !currentPlugin || currentPlugin === previousPlugin || !plugins.enabledPlugins.has(pluginId)) {
      throw new Error('Obsidian Agent did not restart with the original enabled state.');
    }
    if (observed.vaultSubscriptions === 0) throw new Error('The monitor observed no Vault subscriptions during startup.');

    return { elapsedMs: Date.now() - began, control, observed };
  } finally {
    restore.reverse().forEach((undo) => undo());
    if (!plugins.getPlugin(pluginId)) await plugins.enablePlugin(pluginId);
  }
})()
