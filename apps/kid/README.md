# Experimental kid-shell prototype

`apps/kid/` contains the earlier Planet → Zone → Activity shell experiment. As of v0.6.0 it is **not** the authoritative Summer Quest app and is not the PWA/Android entry point.

The source is retained as historical reference. The Strategy C recovery excludes its bootstrap, router, session store and iframe adapters from compilation, precaching and distribution. Do not route real games/books/music through `ActivityHostScreen` or reintroduce iframe hosting.

The authoritative child runtime is `/index.html`; future exploration UI must consume `window.SQContentRegistry` and launch content back into that same runtime.

`npm run build:mobile` builds the shared learning, agent, storage and core modules used by the root runtime. The old `/apps/kid/` source URL redirects once to `/index.html` without changing family state. Production payloads omit the prototype directory.
