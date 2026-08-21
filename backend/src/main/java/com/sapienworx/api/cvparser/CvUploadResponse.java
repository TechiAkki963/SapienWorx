package com.sapienworx.api.cvparser;

import java.util.UUID;

public record CvUploadResponse(UUID requestId, String status) { }
