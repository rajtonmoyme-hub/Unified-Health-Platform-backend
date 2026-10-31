const { query } = require('../../config/db');

class DoctorService {
  static async getDoctorDirectory({ specialty, district } = {}) {
    const params = [];
    const conditions = [];

    if (specialty) {
      params.push(`%${specialty}%`);
      conditions.push(`d.specialty ILIKE $${params.length}`);
    }
    if (district) {
      params.push(`%${district}%`);
      conditions.push(`p.district ILIKE $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query(
      `SELECT
         d.id AS doctor_id,
         d.bmdc_reg_number,
         d.full_name,
         d.specialty,
         d.qualifications,
         p.id AS provider_id,
         p.name AS facility_name,
         p.district,
         p.address,
         pr.schedule_days,
         pr.schedule_hours,
         pr.visit_fee::float AS visit_fee,
         pr.followup_fee::float AS followup_fee,
         pr.updated_at
       FROM doctors d
       LEFT JOIN practitioner_roles pr ON pr.doctor_id = d.id
       LEFT JOIN providers p ON p.id = pr.provider_id
       ${whereClause}
       ORDER BY d.full_name ASC`,
      params
    );
    return rows;
  }
}

module.exports = DoctorService;

