const { query } = require('../../config/db');

class PricingService {
  static async compareTestPrices(searchTerm = '') {
    const params = [];
    let whereClause = '';
    if (searchTerm) {
      params.push(`%${searchTerm}%`);
      whereClause = `WHERE pi.item_name ILIKE $1 OR pi.item_code ILIKE $1`;
    }

    const { rows } = await query(
      `SELECT
         pi.id,
         pi.item_code,
         pi.item_name,
         pi.item_category,
         pi.price::float AS price,
         pi.source,
         pi.updated_at,
         p.id AS provider_id,
         p.name AS provider_name,
         p.provider_type,
         p.district
       FROM price_items pi
       JOIN providers p ON p.id = pi.provider_id
       ${whereClause}
       ORDER BY pi.item_name ASC, pi.price ASC`,
      params
    );
    return rows;
  }
}

module.exports = PricingService;

