const { sql, getPool } = require('../config/db');

// Fallback SVG icon when ImageData is missing
const DEFAULT_CAR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 70" width="120" height="70">
  <rect width="120" height="70" rx="10" fill="#F8FAFC"/>
  <!-- Car Body -->
  <path d="M15 42 L25 24 C28 18 36 14 46 14 L74 14 C84 14 92 18 95 24 L105 42 C108 43 110 46 110 50 L110 54 C110 56 108 58 106 58 L100 58 C100 52 95 48 89 48 C83 48 78 52 78 58 L42 58 C42 52 37 48 31 48 C25 48 20 52 20 58 L14 58 C12 58 10 56 10 54 L10 50 C10 46 12 43 15 42 Z" fill="#ED0712"/>
  <!-- Windows -->
  <path d="M30 25 L45 25 L45 38 L22 38 Z" fill="#FFFFFF" opacity="0.85"/>
  <path d="M50 25 L70 25 L70 38 L50 38 Z" fill="#FFFFFF" opacity="0.85"/>
  <path d="M75 25 L88 25 L97 38 L75 38 Z" fill="#FFFFFF" opacity="0.85"/>
  <!-- Wheels -->
  <circle cx="31" cy="56" r="8" fill="#1E293B"/>
  <circle cx="31" cy="56" r="4" fill="#94A3B8"/>
  <circle cx="89" cy="56" r="8" fill="#1E293B"/>
  <circle cx="89" cy="56" r="4" fill="#94A3B8"/>
  <!-- Headlight -->
  <path d="M104 45 L108 45 L107 48 L104 48 Z" fill="#FEF08A"/>
</svg>
`.trim();

/**
 * 1. GET /api/vehicle-types or /api/vehicles
 * Retrieve vehicle types from VehicleTypeMaster
 * Query params: ?all=true, ?search=...
 */
async function getVehicleTypes(req, res) {
  try {
    const { all, search } = req.query || {};
    const includeAll = all === 'true' || all === '1';

    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT 
        VehicleTypeId,
        VehicleTypeCode,
        VehicleTypeName,
        Description,
        ImageData,
        ImageContentType,
        DisplayOrder,
        IsActive,
        CreatedDate
      FROM dbo.VehicleTypeMaster
    `;

    const whereClauses = [];
    if (!includeAll) {
      whereClauses.push(`IsActive = 1`);
    }
    if (search && search.trim()) {
      request.input('search', sql.NVarChar(100), `%${search.trim()}%`);
      whereClauses.push(`(VehicleTypeCode LIKE @search OR VehicleTypeName LIKE @search OR Description LIKE @search)`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` ORDER BY DisplayOrder ASC, VehicleTypeId ASC;`;

    const result = await request.query(query);

    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const vehicleTypes = result.recordset.map((row) => {
      let imageUrl = null;
      const hasImage = Boolean(row.ImageData && row.ImageData.length > 0);

      if (hasImage) {
        const mime = row.ImageContentType || 'image/png';
        const base64 = Buffer.isBuffer(row.ImageData)
          ? row.ImageData.toString('base64')
          : Buffer.from(row.ImageData).toString('base64');
        imageUrl = `data:${mime};base64,${base64}`;
      } else {
        imageUrl = `${baseUrl}/api/vehicle-types/${row.VehicleTypeId}/image`;
      }

      return {
        vehicleTypeId: row.VehicleTypeId,
        vehicleTypeCode: (row.VehicleTypeCode || '').trim(),
        vehicleTypeName: (row.VehicleTypeName || '').trim(),
        description: row.Description ? row.Description.trim() : '',
        displayOrder: row.DisplayOrder ?? 0,
        isActive: Boolean(row.IsActive),
        createdDate: row.CreatedDate,
        imageContentType: row.ImageContentType,
        imageUrl,
        hasImage,
      };
    });

    return res.status(200).json({
      success: true,
      count: vehicleTypes.length,
      data: vehicleTypes,
    });
  } catch (err) {
    console.error('[getVehicleTypes Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve vehicle types.',
      error: err.message,
    });
  }
}

/**
 * 2. GET /api/vehicle-types/:id/image
 * Stream the raw binary ImageData with proper ImageContentType
 */
async function getVehicleImage(req, res) {
  try {
    const vehicleId = parseInt(req.params.id, 10);
    if (isNaN(vehicleId)) {
      return res.status(400).send('Invalid Vehicle ID');
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('id', sql.Int, vehicleId);

    const result = await request.query(`
      SELECT ImageData, ImageContentType
      FROM dbo.VehicleTypeMaster
      WHERE VehicleTypeId = @id
    `);

    if (!result.recordset || result.recordset.length === 0) {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(DEFAULT_CAR_SVG);
    }

    const row = result.recordset[0];

    if (!row.ImageData || row.ImageData.length === 0) {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(DEFAULT_CAR_SVG);
    }

    const contentType = row.ImageContentType || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(row.ImageData);
  } catch (err) {
    console.error('[getVehicleImage Error]', err);
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(DEFAULT_CAR_SVG);
  }
}

/**
 * 3. POST /api/vehicle-types
 * Create a new vehicle type in VehicleTypeMaster
 */
async function createVehicleType(req, res) {
  try {
    const {
      vehicleTypeCode,
      vehicleTypeName,
      description,
      displayOrder = 1,
      isActive = true,
      imageData,
    } = req.body || {};

    if (!vehicleTypeCode || !vehicleTypeCode.trim()) {
      return res.status(400).json({ success: false, message: 'Vehicle Type Code is required.' });
    }
    if (!vehicleTypeName || !vehicleTypeName.trim()) {
      return res.status(400).json({ success: false, message: 'Vehicle Type Name is required.' });
    }

    const pool = await getPool();

    // Check duplicate code
    const dupCheck = pool.request();
    dupCheck.input('code', sql.NVarChar(30), vehicleTypeCode.trim().toUpperCase());
    const dupRes = await dupCheck.query(`
      SELECT VehicleTypeId FROM dbo.VehicleTypeMaster WHERE UPPER(VehicleTypeCode) = @code
    `);
    if (dupRes.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Vehicle Type Code "${vehicleTypeCode}" already exists.`,
      });
    }

    let imgBuffer = null;
    let imgContentType = null;
    if (imageData && typeof imageData === 'string') {
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

    const insertReq = pool.request();
    insertReq.input('code', sql.NVarChar(30), vehicleTypeCode.trim().toUpperCase());
    insertReq.input('name', sql.NVarChar(100), vehicleTypeName.trim());
    insertReq.input('desc', sql.NVarChar(250), description ? description.trim() : null);
    insertReq.input('order', sql.Int, parseInt(displayOrder || '1', 10));
    insertReq.input('active', sql.Bit, isActive ? 1 : 0);
    insertReq.input('imgData', sql.VarBinary(sql.MAX), imgBuffer);
    insertReq.input('imgContentType', sql.NVarChar(100), imgContentType);

    const result = await insertReq.query(`
      INSERT INTO dbo.VehicleTypeMaster (
        VehicleTypeCode,
        VehicleTypeName,
        Description,
        DisplayOrder,
        IsActive,
        ImageData,
        ImageContentType,
        CreatedDate
      )
      OUTPUT INSERTED.VehicleTypeId, INSERTED.VehicleTypeCode, INSERTED.VehicleTypeName, INSERTED.Description, INSERTED.DisplayOrder, INSERTED.IsActive, INSERTED.CreatedDate
      VALUES (
        @code,
        @name,
        @desc,
        @order,
        @active,
        @imgData,
        @imgContentType,
        GETDATE()
      );
    `);

    return res.status(201).json({
      success: true,
      message: `Vehicle Type "${vehicleTypeName}" created successfully.`,
      data: result.recordset[0],
    });
  } catch (err) {
    console.error('[createVehicleType Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create vehicle type in database.',
      error: err.message,
    });
  }
}

/**
 * 4. PUT /api/vehicle-types/:id
 * Update an existing vehicle type
 */
async function updateVehicleType(req, res) {
  try {
    const vehicleTypeId = parseInt(req.params.id, 10);
    if (isNaN(vehicleTypeId)) {
      return res.status(400).json({ success: false, message: 'Invalid Vehicle Type ID.' });
    }

    const {
      vehicleTypeCode,
      vehicleTypeName,
      description,
      displayOrder,
      isActive,
      imageData,
    } = req.body || {};

    const pool = await getPool();
    const reqDb = pool.request();
    reqDb.input('id', sql.Int, vehicleTypeId);

    const updates = [];

    if (vehicleTypeCode !== undefined && vehicleTypeCode.trim()) {
      reqDb.input('code', sql.NVarChar(30), vehicleTypeCode.trim().toUpperCase());
      updates.push(`VehicleTypeCode = @code`);
    }
    if (vehicleTypeName !== undefined && vehicleTypeName.trim()) {
      reqDb.input('name', sql.NVarChar(100), vehicleTypeName.trim());
      updates.push(`VehicleTypeName = @name`);
    }
    if (description !== undefined) {
      reqDb.input('desc', sql.NVarChar(250), description ? description.trim() : null);
      updates.push(`Description = @desc`);
    }
    if (displayOrder !== undefined) {
      reqDb.input('order', sql.Int, parseInt(displayOrder, 10));
      updates.push(`DisplayOrder = @order`);
    }
    if (isActive !== undefined) {
      reqDb.input('active', sql.Bit, isActive ? 1 : 0);
      updates.push(`IsActive = @active`);
    }
    if (imageData !== undefined) {
      if (imageData && typeof imageData === 'string') {
        let imgBuffer = null;
        let imgContentType = null;
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
        reqDb.input('imgData', sql.VarBinary(sql.MAX), imgBuffer);
        reqDb.input('imgContentType', sql.NVarChar(100), imgContentType);
        updates.push(`ImageData = @imgData, ImageContentType = @imgContentType`);
      } else if (imageData === null || imageData === '') {
        updates.push(`ImageData = NULL, ImageContentType = NULL`);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update provided.' });
    }

    const query = `
      UPDATE dbo.VehicleTypeMaster
      SET ${updates.join(', ')}
      OUTPUT INSERTED.VehicleTypeId, INSERTED.VehicleTypeCode, INSERTED.VehicleTypeName, INSERTED.Description, INSERTED.DisplayOrder, INSERTED.IsActive
      WHERE VehicleTypeId = @id;
    `;

    const result = await reqDb.query(query);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: `Vehicle Type ${vehicleTypeId} not found.` });
    }

    return res.status(200).json({
      success: true,
      message: 'Vehicle Type updated successfully.',
      data: result.recordset[0],
    });
  } catch (err) {
    console.error('[updateVehicleType Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update vehicle type.',
      error: err.message,
    });
  }
}

/**
 * 5. DELETE /api/vehicle-types/:id
 * Soft delete or deactivate vehicle type
 */
async function deleteVehicleType(req, res) {
  try {
    const vehicleTypeId = parseInt(req.params.id, 10);
    if (isNaN(vehicleTypeId)) {
      return res.status(400).json({ success: false, message: 'Invalid Vehicle Type ID.' });
    }

    const pool = await getPool();

    // Check if vehicle type is used by active orders
    const usageCheck = await pool.request()
      .input('id', sql.Int, vehicleTypeId)
      .query(`SELECT TOP 1 OrderId FROM dbo.CarWashOrder WHERE VehicleTypeId = @id`);

    if (usageCheck.recordset.length > 0) {
      // Soft-delete by setting IsActive = 0
      await pool.request()
        .input('id', sql.Int, vehicleTypeId)
        .query(`UPDATE dbo.VehicleTypeMaster SET IsActive = 0 WHERE VehicleTypeId = @id`);

      return res.status(200).json({
        success: true,
        message: 'Vehicle type has existing orders, deactivated successfully.',
      });
    }

    // Direct delete if never used
    const result = await pool.request()
      .input('id', sql.Int, vehicleTypeId)
      .query(`DELETE FROM dbo.VehicleTypeMaster WHERE VehicleTypeId = @id`);

    return res.status(200).json({
      success: true,
      message: 'Vehicle type deleted successfully from database.',
    });
  } catch (err) {
    console.error('[deleteVehicleType Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete vehicle type.',
      error: err.message,
    });
  }
}

module.exports = {
  getVehicleTypes,
  getVehicleImage,
  createVehicleType,
  updateVehicleType,
  deleteVehicleType,
};
