package com.sapienworx.api.workflow;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TalentPoolAccessService {
    private final JdbcTemplate jdbc;

    public Set<UUID> visiblePoolIds(UUID recruiterId) {
        UUID organisationId = organisationId(recruiterId);
        return new HashSet<>(jdbc.query("""
                select id from talent_pools
                where organisation_id=?
                  and (visibility='ORGANISATION' or created_by_recruiter_id=?)
                """, (rs, row) -> rs.getObject(1, UUID.class), organisationId, recruiterId));
    }

    public void requireVisible(UUID recruiterId, UUID poolId) {
        if (!visiblePoolIds(recruiterId).contains(poolId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Talent pool was not found.");
        }
    }

    private UUID organisationId(UUID recruiterId) {
        UUID organisationId = jdbc.query("select organisation_id from recruiters where id=?", rs -> rs.next() ? rs.getObject(1, UUID.class) : null, recruiterId);
        if (organisationId == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Recruiter profile was not found.");
        return organisationId;
    }
}
