package com.sapienworx.api.knowledge;

import com.sapienworx.api.admin.PlatformAdminRole;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class KnowledgePostServiceTest {
    @Test
    void createsStableEditorialSlugs() {
        assertThat(KnowledgePostService.slugify("  A Better CV: Evidence & Outcomes  "))
                .isEqualTo("a-better-cv-evidence-outcomes");
    }

    @Test
    void rejectsAnUnusableSlug() {
        assertThatThrownBy(() -> KnowledgePostService.slugify("--"))
                .hasMessageContaining("at least three");
    }

    @Test
    void estimatesReadingTimeWithoutClaimingZeroMinutes() {
        assertThat(KnowledgePostService.readingMinutes("Short editorial note")).isEqualTo(1);
        assertThat(KnowledgePostService.readingMinutes("word ".repeat(441))).isEqualTo(3);
    }

    @Test
    void limitsEditorialChangesToOwnerAndOperationsRoles() {
        assertThat(KnowledgePostService.mayEdit(PlatformAdminRole.OWNER)).isTrue();
        assertThat(KnowledgePostService.mayEdit(PlatformAdminRole.OPERATIONS)).isTrue();
        assertThat(KnowledgePostService.mayEdit(PlatformAdminRole.SUPPORT)).isFalse();
        assertThat(KnowledgePostService.mayEdit(PlatformAdminRole.READ_ONLY)).isFalse();
    }
}
