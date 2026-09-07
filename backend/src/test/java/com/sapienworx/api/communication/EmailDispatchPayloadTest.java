package com.sapienworx.api.communication;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EmailDispatchPayloadTest {

    @Test
    void acceptsCalendarInvitationsOnlyWhenFilenameAndContentArriveTogether() {
        EmailDispatchPayload payload = new EmailDispatchPayload(UUID.randomUUID(), UUID.randomUUID(), "SWX_NT_001",
                "candidate@sapienworx.qa", "Interview scheduled", "<p>Open your workspace.</p>",
                "sapienworx-interview.ics", "BEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\nEND:VCALENDAR\r\n");

        assertThat(payload.hasCalendarInvite()).isTrue();
        assertThat(payload.recipientUserId()).isNotNull();
        assertThatThrownBy(() -> new EmailDispatchPayload(UUID.randomUUID(), UUID.randomUUID(), null,
                "candidate@sapienworx.qa", "Interview scheduled", "<p>Open your workspace.</p>", "invite.ics", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("calendar invitation");
    }

    @Test
    void keepsExistingSixArgumentQueueMessagesCompatible() {
        EmailDispatchPayload payload = new EmailDispatchPayload(UUID.randomUUID(), UUID.randomUUID(), null,
                "candidate@sapienworx.qa", "Update", "<p>Secure update.</p>");

        assertThat(payload.hasCalendarInvite()).isFalse();
    }
}
