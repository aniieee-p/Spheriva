const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const SafetySession = require('../src/models/SafetySession.model');
const connectDB = require('../src/config/database');

const withDatabaseStubs = async (t, { connect, createIndexes, disconnect }) => {
  const originalUri = process.env.MONGODB_URI;
  const originalConnect = mongoose.connect;
  const originalDisconnect = mongoose.disconnect;
  const originalCreateIndexes = SafetySession.createIndexes;

  t.after(() => {
    if (originalUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalUri;
    }

    mongoose.connect = originalConnect;
    mongoose.disconnect = originalDisconnect;
    SafetySession.createIndexes = originalCreateIndexes;
  });

  process.env.MONGODB_URI = 'mongodb://test.invalid/spheriva';
  mongoose.connect = connect;
  mongoose.disconnect = disconnect || (async () => {});
  SafetySession.createIndexes = createIndexes;
};

test('connectDB waits for the required session index before reporting readiness', async (t) => {
  const calls = [];
  await withDatabaseStubs(t, {
    connect: async (uri) => {
      calls.push(['connect', uri]);
      return { connection: { host: 'test-mongodb' } };
    },
    createIndexes: async () => {
      calls.push(['createIndexes']);
    }
  });

  const connection = await connectDB();

  assert.equal(connection.connection.host, 'test-mongodb');
  assert.deepEqual(calls, [
    ['connect', 'mongodb://test.invalid/spheriva'],
    ['createIndexes']
  ]);
});

test('connectDB rejects startup and disconnects if the session index cannot be created', async (t) => {
  const expectedError = new Error('index build failed');
  let disconnectCalled = false;
  await withDatabaseStubs(t, {
    connect: async () => ({ connection: { host: 'test-mongodb' } }),
    createIndexes: async () => {
      throw expectedError;
    },
    disconnect: async () => {
      disconnectCalled = true;
    }
  });

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await assert.rejects(connectDB(), (error) => error === expectedError);
    assert.equal(disconnectCalled, true);
  } finally {
    console.error = originalConsoleError;
  }
});

test('connectDB rejects missing MongoDB configuration', async (t) => {
  await withDatabaseStubs(t, {
    connect: async () => {
      assert.fail('MongoDB must not be contacted without a configured URI');
    },
    createIndexes: async () => {
      assert.fail('Indexes must not be created without a database connection');
    }
  });
  delete process.env.MONGODB_URI;

  await assert.rejects(connectDB(), /MONGODB_URI is required/);
});
