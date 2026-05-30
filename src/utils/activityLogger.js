import { base44 } from '@/api/base44Client';

export const logActivity = async (user, action, entityType = '', entityId = '', details = '') => {
  try {
    await base44.entities.ActivityLog.create({
      user_id: user.id,
      user_name: user.full_name || user.email || 'Unknown',
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      department_id: user.department_id || ''
    });
  } catch {
    // Silent fail — never block main flow
  }
};