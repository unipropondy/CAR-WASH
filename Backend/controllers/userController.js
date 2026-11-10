const { getPool, sql } = require('../config/db');

/**
 * Compare/encode password. Stored passwords in this schema use Base64 or plain string.
 */
function encodePassword(plain) {
  if (!plain) return '';
  return Buffer.from(plain.trim(), 'utf8').toString('base64');
}

/**
 * 1. GET /api/users
 * Retrieve all users joined with UserGroupMaster
 * Query params: ?search=...
 */
async function getUsers(req, res) {
  try {
    const { search } = req.query || {};
    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT 
        u.UserId,
        u.UserCode,
        u.UserName,
        u.UserGroupid,
        u.FullName,
        u.IsDisabled,
        u.CreatedBy,
        u.CreatedOn,
        u.ModifiedBy,
        u.ModifiedOn,
        u.LastLogInDate,
        g.UserGroupCode,
        g.UserGroupName,
        g.isActive AS GroupIsActive
      FROM dbo.UserMaster u
      LEFT JOIN dbo.UserGroupMaster g ON u.UserGroupid = g.UserGroupId
    `;

    if (search && search.trim()) {
      request.input('search', sql.NVarChar(100), `%${search.trim()}%`);
      query += ` WHERE (u.UserCode LIKE @search OR u.UserName LIKE @search OR u.FullName LIKE @search)`;
    }

    query += ` ORDER BY u.CreatedOn DESC, u.UserName ASC;`;

    const result = await request.query(query);

    const users = result.recordset.map((row) => ({
      userId: row.UserId,
      userCode: (row.UserCode || '').trim(),
      userName: (row.UserName || '').trim(),
      fullName: (row.FullName || '').trim(),
      userGroupId: row.UserGroupid,
      userGroupCode: row.UserGroupCode ? row.UserGroupCode.trim() : '',
      userGroupName: row.UserGroupName ? row.UserGroupName.trim() : 'Standard User',
      groupIsActive: row.GroupIsActive != null ? Boolean(row.GroupIsActive) : true,
      isDisabled: Boolean(row.IsDisabled),
      createdBy: row.CreatedBy,
      createdOn: row.CreatedOn,
      modifiedBy: row.ModifiedBy,
      modifiedOn: row.ModifiedOn,
      lastLoginDate: row.LastLogInDate,
    }));

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    console.error('[userController.getUsers Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve users from database.',
      error: err.message,
    });
  }
}

/**
 * 2. GET /api/users/groups
 * Retrieve all active user groups from UserGroupMaster
 */
async function getUserGroups(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        UserGroupId,
        UserGroupCode,
        UserGroupName,
        isActive
      FROM dbo.UserGroupMaster
      WHERE isActive = 1
      ORDER BY UserGroupName ASC;
    `);

    const groups = result.recordset.map((row) => ({
      userGroupId: row.UserGroupId,
      userGroupCode: (row.UserGroupCode || '').trim(),
      userGroupName: (row.UserGroupName || '').trim(),
      isActive: Boolean(row.isActive),
    }));

    return res.status(200).json({
      success: true,
      count: groups.length,
      data: groups,
    });
  } catch (err) {
    console.error('[userController.getUserGroups Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user groups.',
      error: err.message,
    });
  }
}

/**
 * 3. POST /api/users
 * Insert a new user into UserMaster
 */
async function createUser(req, res) {
  try {
    const {
      userCode,
      userName,
      password,
      userGroupId,
      fullName,
      isDisabled = false,
      createdBy,
    } = req.body || {};

    if (!userCode || !userCode.trim()) {
      return res.status(400).json({ success: false, message: 'User Code is required.' });
    }
    if (!userName || !userName.trim()) {
      return res.status(400).json({ success: false, message: 'User Name (login ID) is required.' });
    }
    if (!password || !password.trim()) {
      return res.status(400).json({ success: false, message: 'Password is required.' });
    }

    const pool = await getPool();

    // Check duplicate UserCode or UserName
    const dupCheck = pool.request();
    dupCheck.input('uCode', sql.VarChar(20), userCode.trim());
    dupCheck.input('uName', sql.VarChar(20), userName.trim());
    const dupResult = await dupCheck.query(`
      SELECT UserCode, UserName 
      FROM dbo.UserMaster 
      WHERE UserCode = @uCode OR UserName = @uName;
    `);

    if (dupResult.recordset.length > 0) {
      const match = dupResult.recordset[0];
      const field = match.UserCode === userCode.trim() ? 'User Code' : 'User Name';
      return res.status(409).json({
        success: false,
        message: `${field} "${field === 'User Code' ? userCode : userName}" already exists in the system.`,
      });
    }

    // Determine audit user ID
    let auditUserId = null;
    const rawCreator = req.user?.userId || createdBy;
    if (rawCreator && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawCreator)) {
      auditUserId = rawCreator;
    }

    const encodedPw = encodePassword(password);

    const insertReq = pool.request();
    insertReq.input('userCode', sql.VarChar(20), userCode.trim());
    insertReq.input('userName', sql.VarChar(20), userName.trim());
    insertReq.input('userPassword', sql.VarChar(20), encodedPw);
    insertReq.input('userGroupId', sql.UniqueIdentifier, userGroupId || null);
    insertReq.input('fullName', sql.VarChar(160), fullName ? fullName.trim() : userName.trim());
    insertReq.input('isDisabled', sql.Bit, isDisabled ? 1 : 0);
    insertReq.input('createdBy', sql.UniqueIdentifier, auditUserId);

    const result = await insertReq.query(`
      DECLARE @newUserId UNIQUEIDENTIFIER = NEWID();

      INSERT INTO dbo.UserMaster (
        UserId,
        UserCode,
        UserName,
        UserPassword,
        UserGroupid,
        FullName,
        IsDisabled,
        CreatedBy,
        CreatedOn
      )
      OUTPUT INSERTED.UserId, INSERTED.UserCode, INSERTED.UserName, INSERTED.FullName, INSERTED.UserGroupid, INSERTED.IsDisabled, INSERTED.CreatedOn
      VALUES (
        @newUserId,
        @userCode,
        @userName,
        @userPassword,
        @userGroupId,
        @fullName,
        @isDisabled,
        @createdBy,
        GETDATE()
      );
    `);

    const inserted = result.recordset[0];

    return res.status(201).json({
      success: true,
      message: `User ${userName} created successfully in database.`,
      data: inserted,
    });
  } catch (err) {
    console.error('[userController.createUser Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create user in database.',
      error: err.message,
    });
  }
}

/**
 * 4. PUT /api/users/:id
 * Update an existing user in UserMaster
 */
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const {
      userName,
      password,
      userGroupId,
      fullName,
      isDisabled,
      modifiedBy,
    } = req.body || {};

    if (!id) {
      return res.status(400).json({ success: false, message: 'User ID is required.' });
    }

    const pool = await getPool();
    const reqDb = pool.request();
    reqDb.input('userId', sql.UniqueIdentifier, id);

    const updates = [`ModifiedOn = GETDATE()`];

    // Audit user ID
    let auditUserId = null;
    const rawModifier = req.user?.userId || modifiedBy;
    if (rawModifier && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawModifier)) {
      auditUserId = rawModifier;
      reqDb.input('modifiedBy', sql.UniqueIdentifier, auditUserId);
      updates.push(`ModifiedBy = @modifiedBy`);
    }

    if (userName !== undefined && userName.trim()) {
      reqDb.input('userName', sql.VarChar(20), userName.trim());
      updates.push(`UserName = @userName`);
    }

    if (fullName !== undefined) {
      reqDb.input('fullName', sql.VarChar(160), fullName.trim());
      updates.push(`FullName = @fullName`);
    }

    if (userGroupId !== undefined) {
      reqDb.input('userGroupId', sql.UniqueIdentifier, userGroupId || null);
      updates.push(`UserGroupid = @userGroupId`);
    }

    if (isDisabled !== undefined) {
      reqDb.input('isDisabled', sql.Bit, isDisabled ? 1 : 0);
      updates.push(`IsDisabled = @isDisabled`);
    }

    if (password && password.trim()) {
      const encodedPw = encodePassword(password);
      reqDb.input('userPassword', sql.VarChar(20), encodedPw);
      updates.push(`UserPassword = @userPassword`);
    }

    const query = `
      UPDATE dbo.UserMaster
      SET ${updates.join(', ')}
      OUTPUT INSERTED.UserId, INSERTED.UserCode, INSERTED.UserName, INSERTED.FullName, INSERTED.UserGroupid, INSERTED.IsDisabled, INSERTED.ModifiedOn
      WHERE UserId = @userId;
    `;

    const result = await reqDb.query(query);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: `User not found: ${id}` });
    }

    return res.status(200).json({
      success: true,
      message: 'User updated successfully in database.',
      data: result.recordset[0],
    });
  } catch (err) {
    console.error('[userController.updateUser Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user in database.',
      error: err.message,
    });
  }
}

/**
 * 5. DELETE /api/users/:id
 * Toggle IsDisabled or remove user
 */
async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const { permanent } = req.query || {};

    const pool = await getPool();
    const reqDb = pool.request();
    reqDb.input('userId', sql.UniqueIdentifier, id);

    if (permanent === 'true') {
      const result = await reqDb.query(`
        DELETE FROM dbo.UserMaster
        WHERE UserId = @userId;
      `);
      return res.status(200).json({
        success: true,
        message: 'User permanently deleted from database.',
      });
    } else {
      const result = await reqDb.query(`
        UPDATE dbo.UserMaster
        SET IsDisabled = 1, ModifiedOn = GETDATE()
        OUTPUT INSERTED.UserId, INSERTED.UserName, INSERTED.IsDisabled
        WHERE UserId = @userId;
      `);

      if (!result.recordset.length) {
        return res.status(404).json({ success: false, message: `User not found: ${id}` });
      }

      return res.status(200).json({
        success: true,
        message: 'User account disabled successfully in database.',
        data: result.recordset[0],
      });
    }
  } catch (err) {
    console.error('[userController.deleteUser Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete/disable user in database.',
      error: err.message,
    });
  }
}

module.exports = {
  getUsers,
  getUserGroups,
  createUser,
  updateUser,
  deleteUser,
};
