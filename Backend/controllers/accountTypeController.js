const { sql, getPool } = require('../config/db');

// In-memory cache for ultra-fast kiosk response
let accountTypeCache = {
  data: null,
  timestamp: 0,
};

function invalidateAccountTypeCache() {
  accountTypeCache.data = null;
  accountTypeCache.timestamp = 0;
}

/**
 * 1. GET /api/account-types
 * Query params: ?all=true, ?search=...
 */
async function getAccountTypes(req, res) {
  try {
    const { all, search } = req.query || {};
    const includeAll = all === 'true' || all === '1';

    if (!includeAll && !search && accountTypeCache.data && (Date.now() - accountTypeCache.timestamp < 120000)) {
      return res.status(200).json(accountTypeCache.data);
    }

    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT 
        AccountTypeId,
        TypeCode,
        TypeName,
        Description,
        ImageData,
        ImageContentType,
        ImageUrl,
        IconName,
        DisplayOrder,
        IsActive,
        CreatedDate,
        ModifiedDate
      FROM dbo.AccountTypeMaster
    `;

    const whereClauses = [];
    if (!includeAll) {
      whereClauses.push(`IsActive = 1`);
    }
    if (search && search.trim()) {
      request.input('search', sql.NVarChar(100), `%${search.trim()}%`);
      whereClauses.push(`(TypeCode LIKE @search OR TypeName LIKE @search OR Description LIKE @search)`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    query += ` ORDER BY DisplayOrder ASC, AccountTypeId ASC`;

    const result = await request.query(query);

    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const accountTypes = (result.recordset || []).map((row) => {
      const hasImage = Boolean(row.ImageData && Buffer.isBuffer(row.ImageData) && row.ImageData.length > 0);
      let imageUrl = row.ImageUrl || null;

      if (hasImage) {
        const mime = row.ImageContentType || 'image/png';
        const base64 = row.ImageData.toString('base64');
        imageUrl = `data:${mime};base64,${base64}`;
      } else if (row.ImageUrl) {
        imageUrl = row.ImageUrl;
      } else {
        imageUrl = `${baseUrl}/api/account-types/${row.AccountTypeId}/image`;
      }

      return {
        accountTypeId: row.AccountTypeId,
        id: row.AccountTypeId,
        typeCode: (row.TypeCode || '').trim(),
        code: (row.TypeCode || '').trim(),
        typeName: (row.TypeName || '').trim(),
        name: (row.TypeName || '').trim(),
        description: row.Description ? row.Description.trim() : '',
        iconName: row.IconName ? row.IconName.trim() : null,
        displayOrder: row.DisplayOrder ?? 0,
        no: row.DisplayOrder ?? 0,
        isActive: Boolean(row.IsActive),
        createdDate: row.CreatedDate,
        imageContentType: row.ImageContentType,
        imageUrl,
        hasImage,
      };
    });

    const responsePayload = {
      success: true,
      count: accountTypes.length,
      data: accountTypes,
    };

    if (!includeAll && !search) {
      accountTypeCache.data = responsePayload;
      accountTypeCache.timestamp = Date.now();
    }

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('[getAccountTypes Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve account types.',
      error: err.message,
    });
  }
}

/**
 * 2. GET /api/account-types/:id
 */
async function getAccountTypeById(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Account Type ID' });
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('id', sql.Int, id);

    const result = await request.query(`
      SELECT 
        AccountTypeId,
        TypeCode,
        TypeName,
        Description,
        ImageData,
        ImageContentType,
        ImageUrl,
        IconName,
        DisplayOrder,
        IsActive,
        CreatedDate,
        ModifiedDate
      FROM dbo.AccountTypeMaster
      WHERE AccountTypeId = @id
    `);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Account type not found.' });
    }

    const row = result.recordset[0];
    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;
    const hasImage = Boolean(row.ImageData && Buffer.isBuffer(row.ImageData) && row.ImageData.length > 0);
    let imageUrl = row.ImageUrl || null;
    if (hasImage) {
      imageUrl = `${baseUrl}/api/account-types/${row.AccountTypeId}/image`;
    }

    return res.status(200).json({
      success: true,
      data: {
        accountTypeId: row.AccountTypeId,
        id: row.AccountTypeId,
        typeCode: (row.TypeCode || '').trim(),
        code: (row.TypeCode || '').trim(),
        typeName: (row.TypeName || '').trim(),
        name: (row.TypeName || '').trim(),
        description: row.Description ? row.Description.trim() : '',
        iconName: row.IconName ? row.IconName.trim() : null,
        displayOrder: row.DisplayOrder ?? 0,
        no: row.DisplayOrder ?? 0,
        isActive: Boolean(row.IsActive),
        imageUrl,
        hasImage,
      },
    });
  } catch (err) {
    console.error('[getAccountTypeById Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 3. GET /api/account-types/:id/image
 */
async function getAccountTypeImage(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).send('Invalid ID');
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('id', sql.Int, id);

    const result = await request.query(`
      SELECT ImageData, ImageContentType
      FROM dbo.AccountTypeMaster
      WHERE AccountTypeId = @id
    `);

    if (!result.recordset || result.recordset.length === 0 || !result.recordset[0].ImageData) {
      return res.status(404).send('Image not found');
    }

    const row = result.recordset[0];
    const contentType = row.ImageContentType || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(row.ImageData);
  } catch (err) {
    console.error('[getAccountTypeImage Error]', err);
    return res.status(500).send(err.message);
  }
}

/**
 * 4. POST /api/account-types
 */
async function createAccountType(req, res) {
  try {
    const { typeCode, typeName, name, description, iconName, displayOrder, no, isActive, imageData } = req.body;
    const finalCode = (typeCode || name || '').trim().toUpperCase();
    const finalName = (typeName || name || '').trim();

    if (!finalCode || !finalName) {
      return res.status(400).json({ success: false, message: 'Type code and name are required.' });
    }

    let imgBuffer = null;
    let imgContentType = null;
    if (req.file) {
      imgBuffer = req.file.buffer;
      imgContentType = req.file.mimetype;
    } else if (imageData && typeof imageData === 'string') {
      if (imageData.startsWith('data:')) {
        const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          imgContentType = match[1];
          imgBuffer = Buffer.from(match[2], 'base64');
        }
      } else {
        imgContentType = 'image/png';
        imgBuffer = Buffer.from(imageData, 'base64');
      }
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('code', sql.NVarChar(30), finalCode);
    request.input('name', sql.NVarChar(100), finalName);
    request.input('desc', sql.NVarChar(500), description ? description.trim() : null);
    request.input('icon', sql.NVarChar(50), iconName ? iconName.trim() : null);
    request.input('order', sql.Int, displayOrder ?? no ?? 1);
    request.input('active', sql.Bit, isActive !== undefined ? (isActive ? 1 : 0) : 1);
    request.input('imgData', sql.VarBinary(sql.MAX), imgBuffer);
    request.input('imgContentType', sql.NVarChar(100), imgContentType);

    const insertRes = await request.query(`
      INSERT INTO dbo.AccountTypeMaster (
        TypeCode, TypeName, Description, IconName, DisplayOrder, IsActive, ImageData, ImageContentType, CreatedDate, ModifiedDate
      )
      OUTPUT INSERTED.AccountTypeId
      VALUES (@code, @name, @desc, @icon, @order, @active, @imgData, @imgContentType, GETDATE(), GETDATE())
    `);

    const newId = insertRes.recordset[0]?.AccountTypeId;
    invalidateAccountTypeCache();
    return res.status(201).json({ success: true, message: 'Account type created.', id: newId });
  } catch (err) {
    console.error('[createAccountType Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 5. PUT /api/account-types/:id
 */
async function updateAccountType(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const { typeCode, code, typeName, name, description, iconName, displayOrder, no, isActive, imageData } = req.body || {};
    const pool = await getPool();
    const reqDb = pool.request();
    reqDb.input('id', sql.Int, id);

    const updates = [];

    const finalCode = (typeCode || code || '').trim().toUpperCase();
    if (finalCode) {
      reqDb.input('code', sql.NVarChar(30), finalCode);
      updates.push(`TypeCode = @code`);
    }

    const finalName = (typeName || name || '').trim();
    if (finalName) {
      reqDb.input('name', sql.NVarChar(100), finalName);
      updates.push(`TypeName = @name`);
    }

    if (description !== undefined) {
      reqDb.input('desc', sql.NVarChar(500), description ? description.trim() : null);
      updates.push(`Description = @desc`);
    }

    if (iconName !== undefined) {
      reqDb.input('icon', sql.NVarChar(50), iconName ? iconName.trim() : null);
      updates.push(`IconName = @icon`);
    }

    if (displayOrder !== undefined || no !== undefined) {
      reqDb.input('order', sql.Int, parseInt(displayOrder ?? no ?? '1', 10));
      updates.push(`DisplayOrder = @order`);
    }

    if (isActive !== undefined) {
      reqDb.input('active', sql.Bit, isActive ? 1 : 0);
      updates.push(`IsActive = @active`);
    }

    if (req.file) {
      reqDb.input('imgData', sql.VarBinary(sql.MAX), req.file.buffer);
      reqDb.input('imgContentType', sql.NVarChar(100), req.file.mimetype);
      updates.push(`ImageData = @imgData, ImageContentType = @imgContentType`);
    } else if (imageData !== undefined) {
      if (imageData && typeof imageData === 'string') {
        if (imageData.startsWith('data:')) {
          const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            reqDb.input('imgData', sql.VarBinary(sql.MAX), Buffer.from(match[2], 'base64'));
            reqDb.input('imgContentType', sql.NVarChar(100), match[1]);
            updates.push(`ImageData = @imgData, ImageContentType = @imgContentType`);
          }
        } else if (!imageData.startsWith('http://') && !imageData.startsWith('https://')) {
          reqDb.input('imgData', sql.VarBinary(sql.MAX), Buffer.from(imageData, 'base64'));
          reqDb.input('imgContentType', sql.NVarChar(100), 'image/png');
          updates.push(`ImageData = @imgData, ImageContentType = @imgContentType`);
        }
      } else if (imageData === null || imageData === '') {
        updates.push(`ImageData = NULL, ImageContentType = NULL`);
      }
    }

    updates.push(`ModifiedDate = GETDATE()`);

    if (updates.length > 0) {
      const updateQuery = `
        UPDATE dbo.AccountTypeMaster
        SET ${updates.join(', ')}
        WHERE AccountTypeId = @id
      `;
      await reqDb.query(updateQuery);
    }

    invalidateAccountTypeCache();
    return res.status(200).json({ success: true, message: 'Account type updated.' });
  } catch (err) {
    console.error('[updateAccountType Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 6. DELETE /api/account-types/:id
 */
async function deleteAccountType(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const { permanent } = req.query || {};
    const pool = await getPool();
    const request = pool.request();
    request.input('id', sql.Int, id);

    if (permanent === 'true' || permanent === '1') {
      await request.query(`
        DELETE FROM dbo.AccountTypeMaster
        WHERE AccountTypeId = @id
      `);
      invalidateAccountTypeCache();
      return res.status(200).json({ success: true, message: 'Account type permanently deleted.' });
    } else {
      await request.query(`
        UPDATE dbo.AccountTypeMaster
        SET IsActive = 0, ModifiedDate = GETDATE()
        WHERE AccountTypeId = @id
      `);
      invalidateAccountTypeCache();
      return res.status(200).json({ success: true, message: 'Account type deactivated.' });
    }
  } catch (err) {
    console.error('[deleteAccountType Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAccountTypes,
  getAccountTypeById,
  getAccountTypeImage,
  createAccountType,
  updateAccountType,
  deleteAccountType,
};
