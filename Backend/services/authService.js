const { sql, getPool } = require('../config/db');

/**
 * Compare entered password with stored password.
 * Supports Base64 encoded passwords (standard in this schema),
 * direct string matching, and hyphenated composite keys.
 */
function verifyPassword(inputPassword, storedPassword) {
  if (typeof inputPassword !== 'string' || typeof storedPassword !== 'string') {
    return false;
  }

  const trimmedInput = inputPassword.trim();
  const trimmedStored = storedPassword.trim();

  // 1. Direct match
  if (trimmedStored === trimmedInput) {
    return true;
  }

  // 2. Base64 encoded match (e.g., '786' -> 'Nzg2', '999' -> 'OTk5')
  const inputBase64 = Buffer.from(trimmedInput, 'utf8').toString('base64');
  if (trimmedStored === inputBase64) {
    return true;
  }

  // 3. Stored is base64, decode to UTF-8 and compare
  try {
    const decodedStored = Buffer.from(trimmedStored, 'base64').toString('utf8');
    if (decodedStored === trimmedInput) {
      return true;
    }
  } catch {
    // Ignore decode errors
  }

  // 4. Handle hyphenated format if stored like "444-NDQ0"
  if (trimmedStored.includes('-')) {
    const parts = trimmedStored.split('-');
    if (parts.some((p) => p === trimmedInput || p === inputBase64)) {
      return true;
    }
  }

  return false;
}

/**
 * Authenticate user credentials against UserMaster and UserGroupMaster
 * @param {string} loginId User ID, UserCode, or UserName
 * @param {string} password User password
 * @returns {Promise<{ user?: object, error?: string }>}
 */
async function authenticateUser(loginId, password) {
  if (!loginId || !password) {
    return { error: 'User ID and Password are required.' };
  }

  const pool = await getPool();
  const request = pool.request();

  request.input('loginId', sql.VarChar(100), loginId.trim());

  // Join UserMaster and UserGroupMaster using UserGroupId
  // Parameterized query prevents SQL injection
  const query = `
    SELECT 
      u.UserId,
      u.UserCode,
      u.UserName,
      u.UserPassword,
      u.UserGroupid AS UserGroupId,
      u.IsDisabled,
      g.UserGroupId AS Group_UserGroupId,
      g.UserGroupCode,
      g.UserGroupName,
      g.isActive AS Group_isActive
    FROM UserMaster u
    INNER JOIN UserGroupMaster g ON u.UserGroupid = g.UserGroupId
    WHERE (u.UserName = @loginId OR u.UserCode = @loginId)
  `;

  const result = await request.query(query);

  if (!result.recordset || result.recordset.length === 0) {
    return { error: 'Invalid User ID or Password' };
  }

  const record = result.recordset[0];

  // 1. Validate User Account Active Status (IsDisabled column in UserMaster)
  if (record.IsDisabled === true || record.IsDisabled === 1) {
    return { error: 'Account is disabled. Please contact administrator.' };
  }

  // 2. Validate User Group is Active (isActive column in UserGroupMaster)
  if (!record.Group_isActive || record.Group_isActive === 0 || record.Group_isActive === false) {
    return { error: 'User group is inactive. Please contact administrator.' };
  }

  // 3. Validate UserGroup linkage
  if (!record.Group_UserGroupId || record.Group_UserGroupId !== record.UserGroupId) {
    return { error: 'Invalid user group assignment.' };
  }

  // 4. Validate UserPassword
  const isPasswordValid = verifyPassword(password, record.UserPassword);
  if (!isPasswordValid) {
    return { error: 'Invalid User ID or Password' };
  }

  // Success: Return only the required user fields (NEVER expose UserPassword)
  return {
    user: {
      userId: record.UserId,
      userCode: record.UserCode,
      userName: record.UserName,
      userGroupId: record.UserGroupId,
      userGroupCode: record.UserGroupCode,
      userGroupName: record.UserGroupName,
    },
  };
}

module.exports = {
  verifyPassword,
  authenticateUser,
};

