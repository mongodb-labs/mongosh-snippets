# mock-collection

Provide a fake read-only collection based on input documents.

```js
> mockCollection([{ field: 1 },{ field: 2},{ field: 3 }])
> coll.find({ field: {$gt:2} }, { _id: 1 })
[ { _id: ObjectId("6079840f2454d2cd1073ba6c") } ]
> coll.mapReduce(function() { emit('fieldValue', this.field); },
...              function(key, values) { return key + values.join(','); },
...              { out: { inline: 1 } })
{ results: [ { _id: 'fieldValue', value: 'fieldValue1,2,3' } ], ok: 1 }
```
