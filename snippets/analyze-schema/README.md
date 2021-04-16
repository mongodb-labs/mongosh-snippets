# analyze-schema

Analyze the schema of a collection or a cursor.

```js
> schema(db.coll);
┌─────────┬───────┬───────────┬────────────┐
│ (index) │   0   │     1     │     2      │
├─────────┼───────┼───────────┼────────────┤
│    0    │ '_id' │ '100.0 %' │ 'ObjectID' │
│    1    │ 'a  ' │ '50.0 %'  │  'Number'  │
│    2    │ 'a  ' │ '50.0 %'  │  'String'  │
└─────────┴───────┴───────────┴────────────┘
> schema(db.coll.find({ }));
┌─────────┬───────┬───────────┬────────────┐
│ (index) │   0   │     1     │     2      │
├─────────┼───────┼───────────┼────────────┤
│    0    │ '_id' │ '100.0 %' │ 'ObjectID' │
│    1    │ 'a  ' │ '100.0 %' │  'Number'  │
└─────────┴───────┴───────────┴────────────┘
> schema(db.test.aggregate([{ $group: { _id: null, count: { $sum: 1 } } }]));
┌─────────┬─────────┬───────────┬──────────┐
│ (index) │    0    │     1     │    2     │
├─────────┼─────────┼───────────┼──────────┤
│    0    │ '_id  ' │ '100.0 %' │  'Null'  │
│    1    │ 'count' │ '100.0 %' │ 'Number' │
└─────────┴─────────┴───────────┴──────────┘
> schema(db.coll, { verbose: true });
{
  fields: [
    {
      name: '_id',
      // [ ... ]
    },
    {
      path: 'a',
      count: 2,
      types: [
        {
          name: 'Number',
          path: 'a',
          probability: 0.5,
          unique: 1,
          // [ ... ]
        },
        {
          name: 'String',
          bsonType: 'String',
          // [ ... ]
        }
      ],
      total_count: 2,
      type: [ 'Number', 'String' ],
      probability: 1
    }
  ],
  count: 2
}

```
