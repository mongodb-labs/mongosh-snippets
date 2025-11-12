# change-stream-monitor

## Index <!-- omit from toc -->
- [change-stream-monitor](#change-stream-monitor)
  - [listChangeStreams(extended?: boolean, allUsers?: boolean, nsFilter?: Array)](#listchangestreamsextended-boolean-allusers-boolean-nsfilter-array)
    - [Sample Output - Normal Mode](#sample-output---normal-mode)
    - [Sample Output - Extended](#sample-output---extended)
  - [listChangeStreams.help()](#listchangestreamshelp)
  - [listChangeStreamsAsTable(extended?: boolean, allUsers?: boolean, nsFilter?: Array)](#listchangestreamsastableextended-boolean-allusers-boolean-nsfilter-array)
  - [listChangeStreamsAsTable.help()](#listchangestreamsastablehelp)
  - [listChangeStreamsAsJSON(extended?: boolean, allUsers?: boolean, nsFilter?: Array)](#listchangestreamsasjsonextended-boolean-allusers-boolean-nsfilter-array)
  - [listChangeStreamsAsJSON.help()](#listchangestreamsasjsonhelp)
  - [listChangeStreamsAsCSV(extended?: boolean, delimiter: string, allUsers?: boolean, nsFilter?: Array)](#listchangestreamsascsvextended-boolean-delimiter-string-allusers-boolean-nsfilter-array)
  - [listChangeStreamsAsCSV.help()](#listchangestreamsascsvhelp)
  - [prettyPrintChangeStreamPipeline(connectionId: any)](#prettyprintchangestreampipelineconnectionid-any)
    - [Example](#example)
  - [prettyPrintChangeStreamPipeline.help()](#prettyprintchangestreampipelinehelp)
  - [ChangeStreamsData.help()](#changestreamsdatahelp)
  - [ExtendedChangeStreamsData.help()](#extendedchangestreamsdatahelp)

This snippet allows mongosh users to monitor Change Streams on the current server.

On installation of this snippet, the following are available to the user.

## listChangeStreams(extended?: boolean, allUsers?: boolean, nsFilter?: Array<string>)

Prints a table with the currently open Change Streams. Note that the table resizes itself based on the size of the terminal.

The behaviour of the function can be controlled with the available parameters (see parameter defaults for default behaviour). See prettyPrintChangeStreamPipeline() to pretty print a change stream pipeline. See ChangeStreamsData and ExtendedChangeStreamsData for data outputted in extended and non-extended mode.

* *extended* - Controls whether a simple or extended output is presented. Refer to ExtendedChangeStreamsData. Defaults to false.
* *allUsers* - Boolean that correspond's to the allUsers flag of the $currentOp MongoDB Pipeline Stage i.e. If set to false, $currentOp only reports on operations/idle connections/idle cursors/idle sessions belonging to the user who ran the command. If set to true, $currentOp reports operations belonging to all users. Defailts to true.
* *nsFilter* - An optional array of namespace filter. Defaults to [] i.e. to filter.

| Column Name    | Extended Output | Description                                                                                                                                                              |
|----------------|-----------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ConnID         | No              | An identifier for the connection where the specific operation originated.                                                                                                |
| AppName        | No              | The identifier of the client application which ran the operation. Use the appName connection string option to set a custom value for the appName field.                  |
| Remote         | No              | The IP address (or hostname) and the ephemeral port of the client connection where the operation originates.                                                             |
| Driver         | No              | The MongoDB Driver used to connect and run the Change Stream.                                                                                                            |
| NS             | No              |  The namespace the operation targets. A namespace consists of the database name and the collection name concatenated with a dot (.); that is, "<database>.<collection>". |
| Type           | No              | The type of operation. Values are either: op / idleSession / idleCursor.                                                                                                 |
| Pipeline       | No              | The Change Stream pipeline. Use prettyPrintChangeStreamPipeline(connId) to pretty print the full pipeline.                                                               |
| LastAccessDate | No              | The date and time when the cursor was last used.                                                                                                                         |
| Docs Returned  | No              | The cumulative number of documents returned by the cursor.                                                                                                               |
| Active         | Yes             | A boolean value specifying whether the operation has started.                                                                                                            |
| User           | Yes             | Users associated with the operation                                                                                                                                      |
| CursorId       | Yes             | The ID of the cursor.                                                                                                                                                    |
| CreatedDate    | Yes             | The date and time when the cursor was created.                                                                                                                           |


### Sample Output - Normal Mode

```
replset [primary] test> listChangeStreams()
  ┏━━━━━━━━━━━┳━━━━━━━━━━━━┳━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━┳━━━━━━━━┳━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━┓
  ┃  ConnID   ┃  AppName   ┃  Remote      ┃  Driver      ┃  NS          ┃  Type  ┃  Pipeline    ┃  LastAccess  ┃  DocsReturn  ┃
  ┃           ┃            ┃              ┃              ┃              ┃        ┃              ┃  Date        ┃  ed          ┃
  ┡━━━━━━━━━━━╇━━━━━━━━━━━━╇━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━╇━━━━━━━━╇━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━┩
  │  74       │  cs2       │  127.0.0.1:  │  mongo-java  │  test.event  │  op    │  [           │  "2024-04-2  │  0           │
  │           │            │  54989       │  -driver|sy  │  s           │        │  {           │  2T13:23:10  │              │
  │           │            │              │  nc: 4.9.1   │              │        │  "$changeSt  │  .160Z"      │              │
  │           │            │              │              │              │        │  ream": {}   │              │              │
  │           │            │              │              │              │        │  },          │              │              │
  │           │            │              │              │              │        │  {           │              │              │
  │           │            │              │              │              │        │  "$match":   │              │              │
  │           │            │              │              │              │        │  {           │              │              │
  │           │            │              │              │              │        │  "operation  │              │              │
  │           │            │              │              │              │        │  Type": {    │              │              │
  │           │            │              │              │              │        │  "$in": [    │              │              │
  │           │            │              │              │              │        │  "insert",   │              │              │
  │           │            │              │              │              │        │  "update"    │              │              │
  │           │            │              │              │              │        │  ]           │              │              │
  │           │            │              │              │              │        │  }           │              │              │
  │           │            │              │              │              │        │  }           │              │              │
  │           │            │              │              │              │        │  }           │              │              │
  │           │            │              │              │              │        │  ]           │              │              │
  ├───────────┼────────────┼──────────────┼──────────────┼──────────────┼────────┼──────────────┼──────────────┼──────────────┤
  │  79       │  cs1       │  127.0.0.1:  │  mongo-java  │  test.event  │  op    │  [           │  "2024-04-2  │  0           │
  │           │            │  55011       │  -driver|sy  │  s           │        │  {           │  2T13:23:10  │              │
  │           │            │              │  nc: 4.9.1   │              │        │  "$changeSt  │  .181Z"      │              │
  │           │            │              │              │              │        │  ream": {}   │              │              │
  │           │            │              │              │              │        │  },          │              │              │
  │           │            │              │              │              │        │  {           │              │              │
  │           │            │              │              │              │        │  "$match":   │              │              │
  │           │            │              │              │              │        │  {           │              │              │
  │           │            │              │              │              │        │  "operation  │              │              │
  │           │            │              │              │              │        │  Type": {    │              │              │
  │           │            │              │              │              │        │  "$in": [    │              │              │
  │           │            │              │              │              │        │  "insert",   │              │              │
  │           │            │              │              │              │        │  "update"    │              │              │
  │           │            │              │              │              │        │  ]           │              │              │
  │           │            │              │              │              │        │  }           │              │              │
  │           │            │              │              │              │        │  }           │              │              │
  │           │            │              │              │              │        │  }           │              │              │
  │           │            │              │              │              │        │  ]           │              │              │
  └───────────┴────────────┴──────────────┴──────────────┴──────────────┴────────┴──────────────┴──────────────┴──────────────┘
Found 2 change streams
```

### Sample Output - Extended

```
replset [primary] test> listChangeStreams(true)
  ┏━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━┓
  ┃  ConnID  ┃  AppNam  ┃  Remote  ┃  Driver  ┃  NS      ┃  Type  ┃  Pipeli  ┃  LastAc  ┃  DocsRe  ┃  Active  ┃  User    ┃  Cursor  ┃  Create  ┃
  ┃          ┃  e       ┃          ┃          ┃          ┃        ┃  ne      ┃  cessDa  ┃  turned  ┃          ┃          ┃  Id      ┃  dDate   ┃
  ┃          ┃          ┃          ┃          ┃          ┃        ┃          ┃  te      ┃          ┃          ┃          ┃          ┃          ┃
  ┡━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━━┩
  │  74      │  cs2     │  127.0.  │  mongo-  │  test.e  │  op    │  [       │  "2024-  │  0       │  true    │  john@a  │  754369  │  "2024-  │
  │          │          │  0.1:54  │  java-d  │  vents   │        │  {       │  04-22T  │          │          │  dmin    │  716098  │  04-22T  │
  │          │          │  989     │  river|  │          │        │  "$chan  │  13:24:  │          │          │          │  703700  │  12:15:  │
  │          │          │          │  sync:   │          │        │  geStre  │  25.528  │          │          │          │  0       │  31.896  │
  │          │          │          │  4.9.1   │          │        │  am":    │  Z"      │          │          │          │          │  Z"      │
  │          │          │          │          │          │        │  {}      │          │          │          │          │          │          │
  │          │          │          │          │          │        │  },      │          │          │          │          │          │          │
  │          │          │          │          │          │        │  {       │          │          │          │          │          │          │
  │          │          │          │          │          │        │  "$matc  │          │          │          │          │          │          │
  │          │          │          │          │          │        │  h": {   │          │          │          │          │          │          │
  │          │          │          │          │          │        │  "opera  │          │          │          │          │          │          │
  │          │          │          │          │          │        │  tionTy  │          │          │          │          │          │          │
  │          │          │          │          │          │        │  pe": {  │          │          │          │          │          │          │
  │          │          │          │          │          │        │  "$in":  │          │          │          │          │          │          │
  │          │          │          │          │          │        │  [       │          │          │          │          │          │          │
  │          │          │          │          │          │        │  "inser  │          │          │          │          │          │          │
  │          │          │          │          │          │        │  t",     │          │          │          │          │          │          │
  │          │          │          │          │          │        │  "updat  │          │          │          │          │          │          │
  │          │          │          │          │          │        │  e"      │          │          │          │          │          │          │
  │          │          │          │          │          │        │  ]       │          │          │          │          │          │          │
  │          │          │          │          │          │        │  }       │          │          │          │          │          │          │
  │          │          │          │          │          │        │  }       │          │          │          │          │          │          │
  │          │          │          │          │          │        │  }       │          │          │          │          │          │          │
  │          │          │          │          │          │        │  ]       │          │          │          │          │          │          │
  ├──────────┼──────────┼──────────┼──────────┼──────────┼────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
  │  79      │  cs1     │  127.0.  │  mongo-  │  test.e  │  op    │  [       │  "2024-  │  0       │  true    │  mary@a  │  697267  │  "2024-  │
  │          │          │  0.1:55  │  java-d  │  vents   │        │  {       │  04-22T  │          │          │  dmin    │  149292  │  04-22T  │
  │          │          │  011     │  river|  │          │        │  "$chan  │  13:24:  │          │          │          │  716100  │  12:16:  │
  │          │          │          │  sync:   │          │        │  geStre  │  25.542  │          │          │          │  0       │  01.889  │
  │          │          │          │  4.9.1   │          │        │  am":    │  Z"      │          │          │          │          │  Z"      │
  │          │          │          │          │          │        │  {}      │          │          │          │          │          │          │
  │          │          │          │          │          │        │  },      │          │          │          │          │          │          │
  │          │          │          │          │          │        │  {       │          │          │          │          │          │          │
  │          │          │          │          │          │        │  "$matc  │          │          │          │          │          │          │
  │          │          │          │          │          │        │  h": {   │          │          │          │          │          │          │
  │          │          │          │          │          │        │  "opera  │          │          │          │          │          │          │
  │          │          │          │          │          │        │  tionTy  │          │          │          │          │          │          │
  │          │          │          │          │          │        │  pe": {  │          │          │          │          │          │          │
  │          │          │          │          │          │        │  "$in":  │          │          │          │          │          │          │
  │          │          │          │          │          │        │  [       │          │          │          │          │          │          │
  │          │          │          │          │          │        │  "inser  │          │          │          │          │          │          │
  │          │          │          │          │          │        │  t",     │          │          │          │          │          │          │
  │          │          │          │          │          │        │  "updat  │          │          │          │          │          │          │
  │          │          │          │          │          │        │  e"      │          │          │          │          │          │          │
  │          │          │          │          │          │        │  ]       │          │          │          │          │          │          │
  │          │          │          │          │          │        │  }       │          │          │          │          │          │          │
  │          │          │          │          │          │        │  }       │          │          │          │          │          │          │
  │          │          │          │          │          │        │  }       │          │          │          │          │          │          │
  │          │          │          │          │          │        │  ]       │          │          │          │          │          │          │
  └──────────┴──────────┴──────────┴──────────┴──────────┴────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
Found 2 change streams
```

## listChangeStreams.help()
Provides help on how to use the function.

## listChangeStreamsAsTable(extended?: boolean, allUsers?: boolean, nsFilter?: Array<string>)
Alias for `listChangeStreams(extended?: boolean, allUsers?: boolean, nsFilter?: Array<string>)`

## listChangeStreamsAsTable.help()
Provides help on how to use the function. Alias for `listChangeStreams.help()`

## listChangeStreamsAsJSON(extended?: boolean, allUsers?: boolean, nsFilter?: Array<string>)
Prints the currently open Change Streams as a JSON string. A JSON string is printed separately on a newline for each open Change Stream. The behaviour of the function can be controlled with the available parameters (see parameter defaults for default behaviour). See documentation for `listChangeStreams(extended?: boolean, allUsers?: boolean, nsFilter?: Array<string>)` for more details about the available parameters.

## listChangeStreamsAsJSON.help()
Provides help on how to use the function.

## listChangeStreamsAsCSV(extended?: boolean, delimiter: string, allUsers?: boolean, nsFilter?: Array<string>)
Prints the currently open Change Streams as a CSV string with "||||" as the default delimeter. A string is printed separately on a newline for each open Change Stream. The behaviour of the function can be controlled with the available parameters (see parameter defaults for default behaviour). The delimiter parameter allows overriding the default delimiter. See documentation for `listChangeStreams(extended?: boolean, allUsers?: boolean, nsFilter?: Array<string>)` for more details about the other available parameters.

## listChangeStreamsAsCSV.help()
Provides help on how to use the function.

## prettyPrintChangeStreamPipeline(connectionId: any)

Pretty prints the Change Stream pipeline for a given Connection ID.
* *connectionId* - The connection ID where the change stream is executing.

### Example

```
replset [primary] test> prettyPrintChangeStreamPipeline(74)
[
  { '$changeStream': {} },
  {
    '$match': { operationType: { '$in': [ 'insert', 'update' ] } }
  }
]
```

## prettyPrintChangeStreamPipeline.help()
Provides help on how to use the function.

## ChangeStreamsData.help()
Describes the table output in normal mode.

## ExtendedChangeStreamsData.help()
Describes the table output in extended mode.