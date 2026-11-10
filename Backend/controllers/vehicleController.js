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
 * GET /api/vehicle-types or /api/vehicles
 * Retrieve all active vehicle types from VehicleTypeMaster
 */
async function getVehicleTypes(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        VehicleTypeId,
        VehicleTypeCode,
        VehicleTypeName,
        Description,
        ImageData,
        ImageContentType,
        DisplayOrder,
        IsActive
      FROM VehicleTypeMaster
      WHERE IsActive = 1
      ORDER BY DisplayOrder ASC, VehicleTypeId ASC
    `);

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
        // Fallback to placeholder image endpoint
        imageUrl = `${baseUrl}/api/vehicle-types/${row.VehicleTypeId}/image`;
      }

      return {
        vehicleTypeId: row.VehicleTypeId,
        vehicleTypeCode: row.VehicleTypeCode,
        vehicleTypeName: row.VehicleTypeName,
        description: row.Description || '',
        displayOrder: row.DisplayOrder,
        isActive: row.IsActive,
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
 * GET /api/vehicle-types/:id/image or /api/vehicles/:id/image
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
      FROM VehicleTypeMaster
      WHERE VehicleTypeId = @id AND IsActive = 1
    `);

    if (!result.recordset || result.recordset.length === 0) {
      // Return placeholder SVG
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(DEFAULT_CAR_SVG);
    }

    const row = result.recordset[0];

    if (!row.ImageData || row.ImageData.length === 0) {
      // Graceful fallback to SVG placeholder
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(DEFAULT_CAR_SVG);
    }

    const contentType = row.ImageContentType || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1-day cache
    return res.send(row.ImageData);
  } catch (err) {
    console.error('[getVehicleImage Error]', err);
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(DEFAULT_CAR_SVG);
  }
}

module.exports = {
  getVehicleTypes,
  getVehicleImage,
};

