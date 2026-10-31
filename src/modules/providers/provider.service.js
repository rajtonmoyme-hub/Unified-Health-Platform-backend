const { query } = require('../../config/db');

class ProviderService {
  static async getAllProviders() {
    const { rows } = await query(
      'SELECT id, name, provider_type, license_number, district, address, contact_phone, is_verified, created_at FROM providers ORDER BY name ASC'
    );
    return rows;
  }

  static async createProvider({ name, provider_type, license_number, district, address, contact_phone }) {
    const { rows } = await query(
      `INSERT INTO providers (name, provider_type, license_number, district, address, contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, provider_type, license_number, district, address, contact_phone || null]
    );
    return rows[0];
  }
}

module.exports = ProviderService;

