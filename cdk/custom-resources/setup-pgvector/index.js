const { Client } = require("pg");
const { getSecret } = require("@aws-lambda-powertools/parameters/secrets");

// Aurora Serverless may be down, so retry until it connect
async function connectWithRetry(maxRetries = 5, retryDelay = 60000) {
  let retries = 0;
  let client = null;

  const secrets = await getSecret(process.env.DB_SECRETS_ARN);
  const dbInfo = JSON.parse(secrets);
  const dbConfig = {
    host: dbInfo["host"],
    user: dbInfo["username"],
    password: dbInfo["password"],
    database: dbInfo["dbname"],
    port: dbInfo["port"],
  };

  while (retries < maxRetries) {
    try {
      client = new Client(dbConfig);
      await client.connect();
      console.log('Connected to PostgreSQL');
      return client;
    } catch (error) {
      console.error(`Connection attempt ${retries + 1} failed:`, error);
      retries++;
      
      if (retries < maxRetries) {
        console.log(`Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw new Error('Could not connect to PostgreSQL after multiple retries');
}

const setUp = async () => {
  const client = await connectWithRetry();
  try {
    // Create pgvector table and index
    // Ref: https://github.com/pgvector/pgvector
    await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
    await client.query("CREATE EXTENSION IF NOT EXISTS vector;");
    await client.query("DROP TABLE IF EXISTS items;");
    // NOTE: Cohere multi lingual embedding dimension is 1024
    // Ref: https://txt.cohere.com/introducing-embed-v3/
    await client.query(`CREATE TABLE IF NOT EXISTS items(
                         id CHAR(26) primary key,
                         botid CHAR(26),
                         content text,
                         source text,
                         metadata jsonb,
                         embedding vector(1024));`);
    // `lists` parameter controls the nubmer of clusters created during index building.
    // Also it's important to choose the same index method as the one used in the query.
    // Here we use L2 distance for the index method.
    // See: https://txt.cohere.com/introducing-embed-v3/
    await client.query(`CREATE INDEX idx_items_embedding ON items 
                         USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);`);
    await client.query(`CREATE INDEX idx_items_botid ON items (botid);`);

    console.log("SQL execution successful.");
  } catch (err) {
    console.error("Error executing SQL: ", err.stack);
    throw err;
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
};

const updateTable = async () => {
  const client = await connectWithRetry();
  try {
    await client.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS metadata jsonb;`);
    console.log("SQL execution successful.");
  } catch (err) {
    console.error("Error executing SQL: ", err.stack);
    throw err;
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
};

const updateStatus = async (event, status, reason, physicalResourceId) => {
  const body = JSON.stringify({
    Status: status,
    Reason: reason,
    PhysicalResourceId: physicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    NoEcho: false,
    Data: {},
  });

  const res = await fetch(event.ResponseURL, {
    method: "PUT",
    body,
    headers: {
      "Content-Type": "",
      "Content-Length": body.length.toString(),
    },
  });

  console.log(res);
  console.log(await res.text());
};

exports.handler = async (event, context) => {
  console.log(`Received event: ${JSON.stringify(event, null, 2)}`);
  console.log(`Received context: ${JSON.stringify(context, null, 2)}`);
  console.log(`DB_SECRETS_ARN: ${process.env.DB_SECRETS_ARN}`);

  const dbClusterIdentifier = process.env.DB_CLUSTER_IDENTIFIER;

  try {
    switch (event.RequestType) {
      case "Create":
        await setUp();
        await updateStatus(
          event,
          "SUCCESS",
          "Setup succeeded",
          dbClusterIdentifier
        );
        break;
      case "Update":
        await updateTable();
        await updateStatus(
          event,
          "SUCCESS",
          "Update succeeded",
          dbClusterIdentifier
        );
        break;
      case "Delete":
        await updateStatus(event, "SUCCESS", "", dbClusterIdentifier);
    }
  } catch (error) {
    console.log(error);
    if (event.PhysicalResourceId) {
      await updateStatus(
        event,
        "FAILED",
        error.message,
        event.PhysicalResourceId
      );
    } else {
      await updateStatus(event, "FAILED", error.message, dbClusterIdentifier);
    }
  }
};