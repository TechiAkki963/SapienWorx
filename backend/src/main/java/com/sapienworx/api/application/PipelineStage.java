package com.sapienworx.api.application;

/** Ordered applicant workflow states used consistently in dashboard analytics and pipeline views. */
public enum PipelineStage {
    APPLIED,
    SCREENING,
    INTERVIEWING,
    FINAL_STAGE,
    OFFER,
    ONBOARDED,
    REJECTED
}
