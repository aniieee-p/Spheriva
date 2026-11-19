const assert = require('node:assert/strict');
const test = require('node:test');
const SafetySession = require('../src/models/SafetySession.model');
const {
  createSession,
  getActiveSession,
  updateLocation,
  endSession
} = require('../src/controllers/session.controller');

const restoreSessionMethods = (stubs) => {
  const originals = new Map();
  for (const [name, stub] of Object.entries(stubs)) {
    originals.set(name, SafetySession[name]);
    SafetySession[name] = stub;
  }

  return () => {
    for (const [name, original] of originals) {
      SafetySession[name] = original;
    }
  };
};

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

test('session schema constrains status and location coordinates', () => {
  assert.deepEqual(SafetySession.schema.path('status').enumValues, ['active', 'ended']);
  assert.equal(SafetySession.schema.path('user').options.ref, 'User');
  assert.equal(SafetySession.schema.path('latestLocation').schema.path('latitude').options.min, -90);
  assert.equal(SafetySession.schema.path('latestLocation').schema.path('latitude').options.max, 90);
  assert.equal(SafetySession.schema.path('latestLocation').schema.path('longitude').options.min, -180);
  assert.equal(SafetySession.schema.path('latestLocation').schema.path('longitude').options.max, 180);

  const indexes = SafetySession.schema.indexes();
  assert.equal(SafetySession.schema.options.autoIndex, false);
  assert.equal(indexes.length, 1, 'only the explicit active-session index should be declared');
  assert.deepEqual(indexes[0], [
    { user: 1 },
    {
      unique: true,
      name: 'one_active_session_per_user',
      partialFilterExpression: { status: 'active' }
    }
  ]);
});

test('first session creation uses the authenticated user and returns the server-generated session', async () => {
  let created;
  const restore = restoreSessionMethods({
    create: async (data) => {
      created = data;
      return { _id: 'server-generated-id', ...data, status: 'active' };
    }
  });

  try {
    const res = createResponse();
    await createSession({
      user: { _id: 'authenticated-user' },
      body: {
        _id: 'client-id',
        sessionId: 'client-session-id',
        user: 'other-user',
        status: 'ended'
      }
    }, res);

    assert.deepEqual(created, { user: 'authenticated-user' });
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.session._id, 'server-generated-id');
  } finally {
    restore();
  }
});

test('getActiveSession returns the authenticated user’s active session', async () => {
  let query;
  const session = {
    _id: 'active-session-id',
    user: 'authenticated-user',
    status: 'active'
  };
  const restore = restoreSessionMethods({
    findOne: async (filter) => {
      query = filter;
      return session;
    }
  });

  try {
    const res = createResponse();
    await getActiveSession({ user: { _id: 'authenticated-user' } }, res);

    assert.deepEqual(query, {
      user: 'authenticated-user',
      status: 'active'
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      success: true,
      data: { session }
    });
  } finally {
    restore();
  }
});

test('getActiveSession returns null when the authenticated user has no active session', async () => {
  const restore = restoreSessionMethods({
    findOne: async () => null
  });

  try {
    const res = createResponse();
    await getActiveSession({ user: { _id: 'authenticated-user' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      success: true,
      data: { session: null }
    });
  } finally {
    restore();
  }
});

test('getActiveSession scopes the lookup to the authenticated user', async () => {
  let query;
  const restore = restoreSessionMethods({
    findOne: async (filter) => {
      query = filter;
      return null;
    }
  });

  try {
    const res = createResponse();
    await getActiveSession({ user: { _id: 'authenticated-user' } }, res);

    assert.equal(query.user, 'authenticated-user');
    assert.notEqual(query.user, 'another-user');
    assert.equal(query.status, 'active');
  } finally {
    restore();
  }
});

test('getActiveSession returns a server error when the database lookup fails', async () => {
  const restore = restoreSessionMethods({
    findOne: async () => {
      throw new Error('database unavailable');
    }
  });
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const res = createResponse();
    await getActiveSession({ user: { _id: 'authenticated-user' } }, res);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, {
      success: false,
      message: 'Server error while retrieving active safety session'
    });
  } finally {
    console.error = originalConsoleError;
    restore();
  }
});

test('second active session creation returns conflict on duplicate key', async () => {
  const duplicateKeyError = Object.assign(new Error('duplicate key'), {
    message: 'E11000 duplicate key error index: one_active_session_per_user dup key',
    code: 11000,
    keyPattern: { user: 1 }
  });
  const restore = restoreSessionMethods({
    create: async () => {
      throw duplicateKeyError;
    }
  });

  try {
    const res = createResponse();
    await createSession({ user: { _id: 'authenticated-user' }, body: {} }, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /active safety session already exists/i);
  } finally {
    restore();
  }
});

test('a new session can be created after the previous session ends', async () => {
  const sessions = new Map();
  const sessionIds = [
    '507f1f77bcf86cd799439011',
    '507f1f77bcf86cd799439012'
  ];
  const restore = restoreSessionMethods({
    create: async ({ user }) => {
      if ([...sessions.values()].some((session) =>
        session.user === user && session.status === 'active'
      )) {
        throw Object.assign(
          new Error('E11000 duplicate key error index: one_active_session_per_user dup key'),
          { code: 11000, keyPattern: { user: 1 } }
        );
      }

      const session = { _id: sessionIds.shift(), user, status: 'active' };
      sessions.set(session._id, session);
      return session;
    },
    findOneAndUpdate: async (filter, update) => {
      const session = sessions.get(filter._id);
      if (!session || session.user !== filter.user || session.status !== filter.status) {
        return null;
      }

      Object.assign(session, update.$set);
      return session;
    }
  });

  try {
    const firstResponse = createResponse();
    await createSession({ user: { _id: 'authenticated-user' }, body: {} }, firstResponse);
    assert.equal(firstResponse.statusCode, 201);

    const endResponse = createResponse();
    await endSession({
      params: { id: firstResponse.body.data.session._id },
      user: { _id: 'authenticated-user' }
    }, endResponse);
    assert.equal(endResponse.statusCode, 200);

    const secondResponse = createResponse();
    await createSession({ user: { _id: 'authenticated-user' }, body: {} }, secondResponse);
    assert.equal(secondResponse.statusCode, 201);
    assert.notEqual(
      secondResponse.body.data.session._id,
      firstResponse.body.data.session._id
    );
  } finally {
    restore();
  }
});

test('unrelated duplicate-key errors are not reported as active-session conflicts', async () => {
  const restore = restoreSessionMethods({
    create: async () => {
      throw Object.assign(
        new Error('E11000 duplicate key error index: _id_ dup key'),
        { code: 11000, keyPattern: { _id: 1 } }
      );
    }
  });
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const res = createResponse();
    await createSession({ user: { _id: 'authenticated-user' }, body: {} }, res);

    assert.equal(res.statusCode, 500);
    assert.doesNotMatch(res.body.message, /active safety session already exists/i);
  } finally {
    console.error = originalConsoleError;
    restore();
  }
});

test('concurrent creates are resolved by the unique active-session constraint', async () => {
  let activeSessionCreated = false;
  const restore = restoreSessionMethods({
    create: async ({ user }) => {
      if (activeSessionCreated) {
        throw Object.assign(
          new Error('E11000 duplicate key error index: one_active_session_per_user dup key'),
          { code: 11000, keyPattern: { user: 1 } }
        );
      }

      activeSessionCreated = true;
      return { _id: 'server-session-id', user, status: 'active' };
    }
  });

  try {
    const responses = [createResponse(), createResponse()];
    await Promise.all(responses.map((res) =>
      createSession({ user: { _id: 'authenticated-user' }, body: {} }, res)
    ));

    assert.deepEqual(
      responses.map((res) => res.statusCode).sort(),
      [201, 409]
    );
  } finally {
    restore();
  }
});

test('updateLocation validates coordinates before writing', async () => {
  let writeCalled = false;
  const restore = restoreSessionMethods({
    findOneAndUpdate: async () => {
      writeCalled = true;
      return null;
    }
  });

  try {
    const res = createResponse();
    await updateLocation({
      params: { id: '507f1f77bcf86cd799439011' },
      body: { latitude: 91, longitude: 0 },
      user: { _id: 'authenticated-user' }
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(writeCalled, false);
  } finally {
    restore();
  }
});

test('updateLocation scopes the atomic update to the owner active session and stores a timestamp', async () => {
  let query;
  let update;
  const expectedSession = { _id: '507f1f77bcf86cd799439011', status: 'active' };
  const restore = restoreSessionMethods({
    findOneAndUpdate: async (filter, changes) => {
      query = filter;
      update = changes;
      return expectedSession;
    }
  });

  try {
    const res = createResponse();
    await updateLocation({
      params: { id: expectedSession._id },
      body: { latitude: 37.5, longitude: -122.2 },
      user: { _id: 'authenticated-user' }
    }, res);

    assert.deepEqual(query, {
      _id: expectedSession._id,
      user: 'authenticated-user',
      status: 'active'
    });
    assert.equal(update.$set.latestLocation.latitude, 37.5);
    assert.equal(update.$set.latestLocation.longitude, -122.2);
    assert.ok(update.$set.latestLocation.timestamp instanceof Date);
    assert.equal(res.statusCode, 200);
  } finally {
    restore();
  }
});

test('updateLocation rejects ended and other users’ sessions', async (t) => {
  for (const scenario of [
    { name: 'ended session', session: { status: 'ended' }, expectedStatus: 409 },
    { name: 'session owned by another user', session: null, expectedStatus: 404 }
  ]) {
    await t.test(scenario.name, async () => {
      const restore = restoreSessionMethods({
        findOneAndUpdate: async () => null,
        findOne: async (query) => {
          assert.deepEqual(query, {
            _id: '507f1f77bcf86cd799439011',
            user: 'authenticated-user'
          });
          return scenario.session;
        }
      });

      try {
        const res = createResponse();
        await updateLocation({
          params: { id: '507f1f77bcf86cd799439011' },
          body: { latitude: 0, longitude: 0 },
          user: { _id: 'authenticated-user' }
        }, res);

        assert.equal(res.statusCode, scenario.expectedStatus);
      } finally {
        restore();
      }
    });
  }
});

test('endSession ends only an active session owned by the authenticated user', async () => {
  let query;
  let update;
  const expectedSession = { _id: '507f1f77bcf86cd799439011', status: 'ended' };
  const restore = restoreSessionMethods({
    findOneAndUpdate: async (filter, changes) => {
      query = filter;
      update = changes;
      return expectedSession;
    }
  });

  try {
    const res = createResponse();
    await endSession({
      params: { id: expectedSession._id },
      user: { _id: 'authenticated-user' }
    }, res);

    assert.deepEqual(query, {
      _id: expectedSession._id,
      user: 'authenticated-user',
      status: 'active'
    });
    assert.equal(update.$set.status, 'ended');
    assert.ok(update.$set.endedAt instanceof Date);
    assert.equal(res.statusCode, 200);
  } finally {
    restore();
  }
});

test('invalid session IDs are rejected without a database lookup', async () => {
  let lookupCalled = false;
  const restore = restoreSessionMethods({
    findOneAndUpdate: async () => {
      lookupCalled = true;
      return null;
    }
  });

  try {
    const res = createResponse();
    await endSession({
      params: { id: 'not-an-object-id' },
      user: { _id: 'authenticated-user' }
    }, res);

    assert.equal(res.statusCode, 404);
    assert.equal(lookupCalled, false);
  } finally {
    restore();
  }
});
