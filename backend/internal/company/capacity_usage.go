package company

import "context"

func (s *SQLStore) CapacityUsage(ctx context.Context, id string) (map[string]int64, error) {
	result := map[string]int64{}
	rows, err := s.db.Query(ctx, `WITH members AS (SELECT COALESCE(m.role,'recruiter') AS role,COALESCE(m.talent_seat,true) AS talent FROM recruiter_profiles rp JOIN users u ON u.id=rp.user_id LEFT JOIN company_memberships m ON m.user_id=rp.user_id AND m.company_id=rp.company_id WHERE rp.company_id=$1 AND u.is_active AND u.status IN('active','pending_verification') AND COALESCE(m.status,'active')='active')
 SELECT 'sub_admins' AS key,count(*) FROM members WHERE role='sub_admin'
 UNION ALL SELECT 'recruiters',count(*) FROM members WHERE role='recruiter'
 UNION ALL SELECT 'talent_seats',count(*) FROM members WHERE talent
 UNION ALL SELECT 'active_jobs',count(*) FROM jobs WHERE company_id=$1 AND status='active'
 UNION ALL SELECT 'saved_searches',count(*) FROM recruiter_saved_searches s JOIN recruiter_profiles rp ON rp.user_id=s.recruiter_id WHERE rp.company_id=$1
 UNION ALL SELECT 'smart_pools',count(*) FROM recruiter_talent_pools WHERE company_id=$1 AND kind='smart'
 UNION ALL SELECT 'outreach_sequences',count(*) FROM outreach_sequences s JOIN recruiter_profiles rp ON rp.user_id=s.recruiter_id WHERE rp.company_id=$1 AND s.status<>'archived'`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var key string
		var used int64
		if err = rows.Scan(&key, &used); err != nil {
			return nil, err
		}
		result[key] = used
	}
	return result, rows.Err()
}
