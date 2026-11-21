const test = require('node:test');
const assert = require('node:assert/strict');

const User = require('../src/models/User.model');
const TrustedContact = require('../src/models/TrustedContact.model');
const { resolveCallingContact } = require('../src/controllers/call.controller');

const ownerId = '507f1f77bcf86cd799439011';
const contactId = '507f1f77bcf86cd799439012';
const recipientId = '507f1f77bcf86cd799439013';

const originalContactFindOne = TrustedContact.findOne;
const originalUserFindOne = User.findOne;

function makeResponse() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test.after(() => {
  TrustedContact.findOne = originalContactFindOne;
  User.findOne = originalUserFindOne;
});

test('rejects invalid contact ID', async () => {
  const req = {
    user: { _id: ownerId },
    body: { contactId: 'invalid-id' }
  };
  const res = makeResponse();

  await resolveCallingContact(req, res, error => {
    throw error;
  });

  assert.equal(res.statusCode, 400);
});

test('only searches contacts belonging to authenticated user', async () => {
  let actualQuery;

  TrustedContact.findOne = async query => {
    actualQuery = query;
    return null;
  };

  const req = {
    user: { _id: ownerId },
    body: { contactId }
  };
  const res = makeResponse();

  await resolveCallingContact(req, res, error => {
    throw error;
  });

  assert.equal(actualQuery._id, contactId);
  assert.equal(actualQuery.user, ownerId);
  assert.equal(res.statusCode, 404);
});

test('resolves registered active recipient', async () => {
  TrustedContact.findOne = async () => ({
    name: 'Test Contact',
    phoneNumber: '9876543210'
  });

  User.findOne = async query => {
    assert.equal(query.phoneNumber, '9876543210');
    assert.equal(query.isActive, true);

    return {
      _id: recipientId,
      name: 'Registered User'
    };
  };

  const req = {
    user: { _id: ownerId },
    body: { contactId }
  };
  const res = makeResponse();

  await resolveCallingContact(req, res, error => {
    throw error;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.recipientId, recipientId);
});

test('prevents calling own account', async () => {
  TrustedContact.findOne = async () => ({
    name: 'Self',
    phoneNumber: '9876543210'
  });

  User.findOne = async () => ({
    _id: ownerId
  });

  const req = {
    user: { _id: ownerId },
    body: { contactId }
  };
  const res = makeResponse();

  await resolveCallingContact(req, res, error => {
    throw error;
  });

  assert.equal(res.statusCode, 400);
});
