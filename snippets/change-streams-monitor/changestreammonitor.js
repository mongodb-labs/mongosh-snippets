const localRequire = require("module").createRequire(__filename);
const { Table } = localRequire("to-tabel");
const { templates } = localRequire("boks");

function _listChangeStreams (extended = false, allUsers = true, nsFilter = []) {
  tableData = [];
  let changeStreamsDataRaw = getChangeStreams(allUsers, nsFilter);

  changeStreamsDataRaw.forEach(changeStreamOpData => {
    let clientDriver = "N/A";
    try {
      clientDriver =
        changeStreamOpData.clientMetadata.driver.name +
        ": " +
        changeStreamOpData.clientMetadata.driver.version;
    } catch (error) {}

    //format the pipeline for better rendering
    let changeStreamPipeline = EJSON.stringify(
      changeStreamOpData.cursor.originatingCommand.pipeline,
      null,
      1
    );

    let usersStr = "";
    if (changeStreamOpData.effectiveUsers){
      changeStreamOpData.effectiveUsers.forEach(user => {
        if (usersStr !== "") usersStr+= "; ";
        usersStr = usersStr + user.user + "@" + user.db;
      });
    }

    if (extended) {
      tableData.push(
        new ExtendedChangeStreamsData(
          changeStreamOpData.connectionId,
          changeStreamOpData.appName,
          changeStreamOpData.client,
          clientDriver,
          changeStreamOpData.ns,
          changeStreamOpData.type,
          changeStreamPipeline,
          changeStreamOpData.cursor.lastAccessDate,
          changeStreamOpData.cursor.nDocsReturned,
          changeStreamOpData.active,
          usersStr,
          changeStreamOpData.cursor.cursorId,
          changeStreamOpData.cursor.createdDate
        )
      );
    } else {
      tableData.push(
        new ChangeStreamsData(
          changeStreamOpData.connectionId,
          changeStreamOpData.appName,
          changeStreamOpData.client,
          clientDriver,
          changeStreamOpData.ns,
          changeStreamOpData.type,
          changeStreamPipeline,
          changeStreamOpData.cursor.lastAccessDate,
          changeStreamOpData.cursor.nDocsReturned
        )
      );
    }
    
  })

  customConsoleTable(tableData, extended);
  print("Found " + changeStreamsDataRaw.length + " change streams");
};

function _listChangeStreamsHelp(){
  print("listChangeStreams(extended?: boolean, allUsers?: boolean, nsFilter?: any): void")
  print("Prints a table with the currently open Change Streams. The behaviour of the function can be controlled with the available parameters (see parameter defaults for default behaviour).")
  print("\t See prettyPrintChangeStreamPipeline.help() to pretty print a change stream pipeline. ")
  print("\t See ChangeStreamsData.help() and ExtendedChangeStreamsData.help() for data outputted in extended and non-extended mode.")
  print("\t @param extended — Controls whether a simple or extended output is presented. Refer to ExtendedChangeStreamsData. Defaults to false.")
  print("\t @param allUsers — Boolean that correspond's to the allUsers flag of the $currentOp MongoDB Pipeline Stage i.e. If set to false, $currentOp only reports on operations/idle connections/idle cursors/idle sessions belonging to the user who ran the command. If set to true, $currentOp reports operations belonging to all users. Defailts to true.")
  print("\t @param nsFilter — An optional array of namespace filter. Defaults to [] i.e. to filter.")
}

/**
 * Prints a table with the currently open Change Streams. The behaviour of the function can be controlled with the available parameters (see parameter defaults for default behaviour). 
 * See prettyPrintChangeStreamPipeline() to pretty print a change stream pipeline.
 * See ChangeStreamsData and ExtendedChangeStreamsData for data outputted in extended and non-extended mode.
 * @param {boolean} extended Controls whether a simple or extended output is presented. Refer to ExtendedChangeStreamsData. Defaults to false.
 * @param {boolean} allUsers Boolean that correspond's to the allUsers flag of the $currentOp MongoDB Pipeline Stage i.e. 
 *                     If set to false, $currentOp only reports on operations/idle connections/idle cursors/idle sessions belonging to the user who ran the command.
 *                     If set to true, $currentOp reports operations belonging to all users.
 *                     Defailts to true.
 * @param {Array.<string>} nsFilter An optional array of namespace filter. Defaults to [] i.e. to filter.
 */
globalThis.listChangeStreams = function (extended = false, allUsers = true, nsFilter = []) {_listChangeStreams(extended, allUsers, nsFilter);}
globalThis.listChangeStreams.help = function () {_listChangeStreamsHelp();}

/**
 * @class Contains the data that will be presented in tabular format. This is the basic data set - @see {ExtendedChangeStreamsData} for the extended version.
 * @param {*} connId An identifier for the connection where the specific operation originated.
 * @param {*} appName The identifier of the client application which ran the operation. Use the appName connection string option to set a custom value for the appName field.
 * @param {*} clientIp The IP address (or hostname) and the ephemeral port of the client connection where the operation originates.
 * @param {*} clientDriver The MongoDB Driver used to connect and run the Change Stream.
 * @param {*} ns The namespace the operation targets. A namespace consists of the database name and the collection name concatenated with a dot (.); that is, "<database>.<collection>".
 * @param {*} type The type of operation. Values are either: op / idleSession / idleCursor.
 * @param {*} pipeline The Change Stream pipeline. Use prettyPrintChangeStreamPipeline(connId) to pretty print the full pipeline.
 * @param {*} lastAccessDate The date and time when the cursor was last used.
 * @param {*} nDocsReturned The cumulative number of documents returned by the cursor.
 */
class ChangeStreamsData {
  constructor(
    connId,
    appName,
    clientIp,
    clientDriver,
    ns,
    type,
    pipeline,
    lastAccessDate,
    nDocsReturned
  ) {
    this.connId = connId;
    this.appName = appName;
    this.clientIp = clientIp;
    this.clientDriver = clientDriver;
    this.ns = ns;
    this.type = type;
    this.pipeline = pipeline;
    this.lastAccessDate = lastAccessDate;

    if (nDocsReturned && nDocsReturned instanceof Long) {
      this.nDocsReturned = nDocsReturned.toNumber();
    } else {
      this.nDocsReturned = nDocsReturned;
    }
  }

  static headers() {
    return [
      { name: "connId", printName: "ConnID", description: "An identifier for the connection where the specific operation originated." },
      { name: "appName", printName: "AppName", description: "The identifier of the client application which ran the operation. Use the appName connection string option to set a custom value for the appName field." },
      { name: "clientIp", printName: "Remote", description: "The IP address (or hostname) and the ephemeral port of the client connection where the operation originates." },
      { name: "clientDriver", printName: "Driver", description: "The MongoDB Driver used to connect and run the Change Stream." },
      { name: "ns", printName: "NS", description: "The namespace the operation targets. A namespace consists of the database name and the collection name concatenated with a dot (.); that is, \"<database>.<collection>\"." },
      { name: "type", printName: "Type", description: "The type of operation. Values are either: op / idleSession / idleCursor." },
      { name: "pipeline", printName: "Pipeline", description: "The Change Stream pipeline. Use prettyPrintChangeStreamPipeline(connId) to pretty print the full pipeline." },
      { name: "lastAccessDate", printName: "LastAccessDate", description: "The date and time when the cursor was last used." },
      { name: "nDocsReturned", printName: "DocsReturned", description: "The cumulative number of documents returned by the cursor." },
    ];
  }

  static help(){
    const options = {
      maxSize: process.stdout.columns - 10,
      borders: [templates.bold, templates.single],
      columns: [{name: "printName", printName: "Column Name"}, {name: "description", printName: "Description"}],
      maxDepth: 1,
      fill: true,
      inclusive: true,
    };

    let newTbl = new Table(ChangeStreamsData.headers(), options);
    newTbl.print();
  }
};

globalThis.ChangeStreamsData = ChangeStreamsData;

/**
 * @class
 * @extends {ChangeStreamsData}
 * @param {*} connId @see {ChangeStreamsData#connId}
 * @param {*} appName @see {ChangeStreamsData#appName}
 * @param {*} clientIp @see {ChangeStreamsData#clientIp}
 * @param {*} clientDriver @see {ChangeStreamsData#clientDriver}
 * @param {*} ns @see {ChangeStreamsData#ns}
 * @param {*} type @see {ChangeStreamsData#type}
 * @param {*} pipeline @see {ChangeStreamsData#pipeline}
 * @param {*} lastAccessDate @see {ChangeStreamsData#lastAccessDate}
 * @param {*} nDocsReturned @see {ChangeStreamsData#nDocsReturned}
 * @param {*} active A boolean value specifying whether the operation has started.
 * @param {*} users Users associated with the operation
 * @param {*} cursorId The ID of the cursor.
 * @param {*} createdDate The date and time when the cursor was created.
 */
class ExtendedChangeStreamsData extends ChangeStreamsData {
  constructor(
    connId,
    appName,
    clientIp,
    clientDriver,
    ns,
    type,
    pipeline,
    lastAccessDate,
    nDocsReturned,
    active,
    users,
    cursorId,
    createdDate
  ) {
    super(
      connId,
      appName,
      clientIp,
      clientDriver,
      ns,
      type,
      pipeline,
      lastAccessDate,
      nDocsReturned
    );
    this.active = active;
    this.users = users;

    if (cursorId && cursorId instanceof Long) {
      this.cursorId = cursorId.toNumber();
    } else {
      this.cursorId = cursorId;
    }

    this.createdDate = createdDate;
  }

  static headers() {
    return ChangeStreamsData.headers().concat([
      { name: "active", printName: "Active", description: "A boolean value specifying whether the operation has started." },
      { name: "users", printName: "User", description: "Users associated with the operation" },
      { name: "cursorId", printName: "CursorId", description: "The ID of the cursor." },
      { name: "createdDate", printName: "CreatedDate", description: "The date and time when the cursor was created." },
    ]);
  }

  static help(){
    const options = {
      maxSize: process.stdout.columns - 10,
      borders: [templates.bold, templates.single],
      columns: [{name: "printName", printName: "Column Name"}, {name: "description", printName: "Description"}],
      maxDepth: 1,
      fill: true,
      inclusive: true,
    };

    let newTbl = new Table(ExtendedChangeStreamsData.headers(), options);
    newTbl.print();
  }
};

globalThis.ExtendedChangeStreamsData = ExtendedChangeStreamsData;

/**
 * Retrieves the currently open change streams by running the $currentOp aggregation stage on the admin database.
 * @param {*} allUsers Boolean that correspond's to the allUsers flag of the $currentOp MongoDB Pipeline Stage i.e. 
 *                     If set to false, $currentOp only reports on operations/idle connections/idle cursors/idle sessions belonging to the user who ran the command.
 *                     If set to true, $currentOp reports operations belonging to all users.
 *                     Defailts to true. 
 * @param {Array.<string>} nsFilter An optional array of namespace filter. Defaults to [] i.e. to filter.
 * @returns currently open change streams by running the $currentOp aggregation stage on the admin database
 */
globalThis.getChangeStreams = function (allUsers, nsFilter) {
  //define admin pipeline to extract changestreams
  let idleConnections = true;
  let idleCursors = true;
  let idleSessions = true;
  let backtrace = true;
  let localOps = true;

  let pipeline = [
    {
      $currentOp: {
        allUsers: allUsers,
        idleConnections: idleConnections,
        idleCursors: idleCursors,
        idleSessions: idleSessions,
        backtrace: backtrace,
        localOps: localOps,
      },
    }
  ]

  let match = {
    $match: {
      "cursor.tailable": true,
      "cursor.originatingCommand.pipeline.0.$changeStream": {
        $exists: true,
      },
    },
  }
  if (nsFilter && Array.isArray(nsFilter) && nsFilter.length > 0){
    match['$match'].ns = {'$in' : nsFilter}
  }
  pipeline.push(match)

  //excute pipeline
  let changeStreamsDataRaw = db
    .getSiblingDB("admin")
    .aggregate(pipeline)
    .toArray();
  return changeStreamsDataRaw;
};

/**
 * Generates a table for the extracted changestream data
 * @param {*} data The data to be displayed in a table
 * @param {boolean} extended Whether the extended output format is being used. This is used to generate the output table headers.
 */
globalThis.customConsoleTable = function (data, extended) {
  if (data && data.length > 0) {
    const options = {
      maxSize: process.stdout.columns - 10,
      borders: [templates.bold, templates.single],
      columns: extended
        ? ExtendedChangeStreamsData.headers()
        : ChangeStreamsData.headers(),
      maxDepth: 1,
      fill: true,
      inclusive: true,
    };

    let newTbl = new Table(data, options);
    newTbl.print();
  } else {
    print("No Change Streams found!");
  }
};


function _prettyPrintChangeStreamPipeline(connectionId) {
  let pipeline = [
    {
      $currentOp: {
        allUsers: true,
        idleConnections: true,
        idleCursors: true,
        idleSessions: true,
        backtrace: true,
        localOps: true,
      },
    },
    {
      $match: {
        connectionId: connectionId,
      },
    },
  ];

  //excute pipeline
  let changeStreamsDataRaw = db
    .getSiblingDB("admin")
    .aggregate(pipeline)
    .toArray()[0];
  if (
    changeStreamsDataRaw &&
    changeStreamsDataRaw.cursor &&
    changeStreamsDataRaw.cursor.originatingCommand &&
    changeStreamsDataRaw.cursor.originatingCommand.pipeline
  ) {
    print(changeStreamsDataRaw.cursor.originatingCommand.pipeline);
  } else {
    print("Not found");
  }
  
};

function _prettyPrintChangeStreamPipelineHelp(){
  print("prettyPrintChangeStreamPipeline(connectionId: any): void")
  print("Pretty prints the Change Stream pipeline for a given Connection ID.")
  print("\t  * @param {*} connectionId The connection ID where the change stream is executing.")
}

/**
 * Pretty prints the Change Stream pipeline for a given Connection ID.
 * @param {*} connectionId The connection ID where the change stream is executing.
 */
globalThis.prettyPrintChangeStreamPipeline = function (connectionId) {
  _prettyPrintChangeStreamPipeline(connectionId);
}
globalThis.prettyPrintChangeStreamPipeline.help = function () {_prettyPrintChangeStreamPipelineHelp();}