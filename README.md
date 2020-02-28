# subnode
Child Node.js process which you can proxy to

## install
```
npm install subnode
```

## usage
### server.js
```js
const express = require('express');
const subnode = require('subnode');

const api = subnode('./api/index');

const app = express();

app.use('/api', api.proxy);

app.get('/', (req, res, next) => {
  res.send('Hello from 80');
});

app.listen(80);
```

### api/index.js
```js
const express = require('express');

const { NODE_PORT } = process.env;

const app = express();

app.set('trust proxy', true);

app.get('/', (req, res, next) => {
  res.send(`Hello from ${NODE_PORT} to ${req.ip}`);
});
```

## How does it work?
When you create "subnode", it gets [forked](https://nodejs.org/api/child_process.html#child_process_child_process_fork_modulepath_args_options) with a random port number and add NODE_PORT environment value.
