const { query } = require('../../config/db');

class PatientService {
  static async getAllPatients() {
    const { rows } = await query(
      'SELECT id, health_id, full_name, mobile, date_of_birth, gender, blood_group, emergency_contact, created_at FROM patients ORDER BY id DESC'
    );
    return rows;
  }

  static async getPatientByHealthId(healthId) {
    const { rows } = await query(
      'SELECT id, health_id, full_name, mobile, date_of_birth, gender, blood_group, emergency_contact, created_at FROM patients WHERE health_id = $1',
      [healthId]
    );
    return rows[0] || null;
  }

  static async createPatient({ full_name, mobile, date_of_birth, gender, blood_group, emergency_contact }) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const healthId = `BD-UHP-${new Date().getFullYear()}-${randomSuffix}`;
    const { rows } = await query(
      `INSERT INTO patients (health_id, full_name, mobile, date_of_birth, gender, blood_group, emergency_contact)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [healthId, full_name, mobile, date_of_birth || null, gender || null, blood_group || null, emergency_contact || null]
    );
    return rows[0];
  }
}

module.exports = PatientService;

