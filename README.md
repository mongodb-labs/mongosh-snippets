# mongosh-snippets

An experimental plugin feature for [mongosh][].

## What is a snippet?

A snippet is a script that you can install using the `snippet` command in [mongosh][],
to provide additional functionality that mongosh does otherwise not provide.

## What does it mean that snippets are experimental?

It means that, for the time being, MongoDB does not offer any commercial
support for it, and that it may be changed or removed as we see fit.

It does not mean that bugs in this feature are an expected occurrence, and you
can and should file bugs in the mongosh [JIRA][] project if you experience any.

## How do I install a snippet?

You can manage snippets through the `snippet` command in mongosh. Running
`snippet help` gives an overview over all commands that are available.

For installing a snippet, you can use `snippet install <name>`:

```
> snippet uninstall analyze-schema
Running uninstall...
Done!
> snippet install analyze-schema
Running install...
Installed new snippets analyze-schema. Do you want to load them now? [Y/n]: y
Finished installing snippets: analyze-schema
> db.test.insertOne({ field: 'value' })
{
  acknowledged: true,
  insertedId: ObjectId("60b60758d381fd904f5dc517")
}
> schema(db.test)
┌─────────┬─────────┬───────────┬────────────┐
│ (index) │    0    │     1     │     2      │
├─────────┼─────────┼───────────┼────────────┤
│    0    │ '_id  ' │ '100.0 %' │ 'ObjectID' │
│    1    │ 'field' │ '100.0 %' │  'String'  │
└─────────┴─────────┴───────────┴────────────┘
```

You can list all installed snippets with `snippet ls`, and you can list all
available snippets with `snippet search`.

## Can I disable this feature?

Yes.

```
> config.set('snippetIndexSourceURLs', '')
```

## How do snippets work?

The snippets feature uses the [npm][] package manager under the hood to install
snippets from a pre-specified registry. The default registry currently points to
this Github repository here. When you install a snippet, mongosh will look up
its npm package name based on the information in the registry and install it,
and load it using `load()` by default on each mongosh startup.

This also means that snippets can depend on npm packages, and use them in their
functionality. For example, the `analyze-schema` example above uses the
[`mongodb-schema`][] package from npm to perform the analysis itself.

## Can I add my own snippets?

Absolutely! You should feel encouraged to do so, if you believe that you have
a script for the shell that you think others might find useful as well.

In order to add a new snippet:
- Fork and clone this repository
- Add a new directory under `snippets/`, using the name you wish to use
- Add at least the `package.json`, `index.js` and `LICENSE` files, and ideally
  also a short `README.md`.

A minimal package.json could contain:

```js
{
  "name": "@mongosh/snippet-<name>",
  "snippetName": "<name>",
  "version": "0.0.1",
  "description": "...",
  "main": "index.js",
  "license": "Apache-2.0",
  "publishConfig": {
    "access": "public"
  }
}
```

Once you have completed that, you can commit your changes and open a pull
request against this repository.

If it is merged, we will take care of publishing and adding it to the index.

## Can I run my own registry?

Yes. From the mongosh CLI perspective, a snippet registry is just a https URL
pointing to a [brotli][]-compressed [BSON][] file; no package contents are
actually provided in that file. This file has the following format (
in TypeScript syntax):

```typescript
interface ErrorMatcher {
  // Add additional information to shell errors matching one of the regular.
  // expressions. The message can point to a snippet helping solve that error.
  matches: RegExp[];
  message: string;
}

interface SnippetDescription {
  // The *npm* package name. Users do not interact with this.
  name: string;
  // The snippet name. This is what users interact with.
  snippetName: string;
  // An optional install specifier that can be used to point npm towards
  // packages that are not uploaded to the registry. For example,
  // this could be an URL to a git repository or a tarball.
  installSpec?: string;
  // A version field. Users do not interact with this, as currently, `snippet`
  // always installs the latest versions of snippets.
  version: string;
  description: string;
  readme: string;
  // License should be a SPDX license identifier.
  license: string;
  errorMatchers?: ErrorMatcher[];
}

interface SnippetIndexFile {
  // This must be 1 currently.
  indexFileVersion: 1;
  index: SnippetDescription[];
  metadata: { homepage: string };
}
```

[mongosh]: https://github.com/mongodb-js/mongosh
[JIRA]: https://jira.mongodb.org/projects/MONGOSH/issues
[npm]: https://www.npmjs.com/
[`mongodb-schema`]: https://www.npmjs.com/package/mongodb-schema
[brotli]: https://github.com/google/brotli/
[BSON]: https://bsonspec.org/
