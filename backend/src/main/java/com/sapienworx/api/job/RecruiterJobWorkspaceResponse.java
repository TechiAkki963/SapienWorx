package com.sapienworx.api.job;

import com.sapienworx.api.web.ApiPageResponse;

public record RecruiterJobWorkspaceResponse(
        RecruiterManagedJobResponse summary,
        ApiPageResponse<RecruiterJobApplicantResponse> applications
) {
}
