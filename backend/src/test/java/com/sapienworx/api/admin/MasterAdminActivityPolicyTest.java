package com.sapienworx.api.admin;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MasterAdminActivityPolicyTest {

    @Test
    void groupsContentFreeActivityIntoReadableCategories() {
        assertThat(MasterAdminService.activityCategory("ACCOUNT_SIGNED_IN")).isEqualTo("AUTHENTICATION");
        assertThat(MasterAdminService.activityCategory("CANDIDATE_PROFILE_DOWNLOADED")).isEqualTo("PROFILE");
        assertThat(MasterAdminService.activityCategory("PIPELINE_STAGE_CHANGED")).isEqualTo("RECRUITMENT");
        assertThat(MasterAdminService.activityCategory("INTERNAL_MESSAGE_SENT")).isEqualTo("COMMUNICATION");
        assertThat(MasterAdminService.activityCategory("CANDIDATE_DATA_ERASED")).isEqualTo("PRIVACY");
    }

    @Test
    void highlightsSensitiveActivityWithoutExposingItsContent() {
        assertThat(MasterAdminService.activityRisk("CANDIDATE_CONTACT_REVEALED")).isEqualTo("HIGH");
        assertThat(MasterAdminService.activityRisk("CANDIDATE_PROFILE_DOWNLOADED")).isEqualTo("HIGH");
        assertThat(MasterAdminService.activityRisk("ACCOUNT_SIGNED_IN")).isEqualTo("MEDIUM");
        assertThat(MasterAdminService.activityRisk("CANDIDATE_PROFILE_UPDATED")).isEqualTo("LOW");
    }

    @Test
    void limitsInvestigationsToSupportedRetentionWindows() {
        assertThat(MasterAdminService.investigationRange(7)).isEqualTo(7);
        assertThat(MasterAdminService.investigationRange(90)).isEqualTo(90);
        assertThat(MasterAdminService.investigationRange(365)).isEqualTo(30);
        assertThat(MasterAdminService.investigationRange(null)).isEqualTo(30);
    }

    @Test
    void createsPlainLanguageLabels() {
        assertThat(MasterAdminService.activityLabel("ACCOUNT_SIGNED_IN")).isEqualTo("Signed in successfully");
        assertThat(MasterAdminService.activityLabel("RECRUITER_SEARCH_SAVED")).isEqualTo("Recruiter search saved");
    }

    @Test
    void restrictsInvestigationPurposesByAdministratorRole() {
        assertThat(MasterAdminService.mayInvestigate(PlatformAdminRole.OWNER, "SECURITY")).isTrue();
        assertThat(MasterAdminService.mayInvestigate(PlatformAdminRole.SUPPORT, "SUPPORT")).isTrue();
        assertThat(MasterAdminService.mayInvestigate(PlatformAdminRole.SUPPORT, "COMPLIANCE")).isFalse();
        assertThat(MasterAdminService.mayInvestigate(PlatformAdminRole.COMPLIANCE, "SECURITY")).isTrue();
        assertThat(MasterAdminService.mayInvestigate(PlatformAdminRole.READ_ONLY, "ACCOUNT_REVIEW")).isFalse();
        assertThat(MasterAdminService.mayInvestigate(PlatformAdminRole.OPERATIONS, "SECURITY")).isFalse();
    }
}
