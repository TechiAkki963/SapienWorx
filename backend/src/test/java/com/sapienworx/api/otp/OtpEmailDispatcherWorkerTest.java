package com.sapienworx.api.otp;

import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import com.sapienworx.api.queue.QueueDeliveryGuard;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OtpEmailDispatcherWorkerTest {

    @Test
    void sendsPasswordResetOtpWithSecuritySpecificCopy() {
        JavaMailSender sender = mock(JavaMailSender.class);
        QueueDeliveryGuard deliveryGuard = mock(QueueDeliveryGuard.class);
        when(deliveryGuard.executeOnce(any(), any(), any(), any())).thenAnswer(invocation -> {
            ((Runnable) invocation.getArgument(3)).run();
            return true;
        });
        OtpEmailSender worker = new OtpEmailSender(sender, deliveryGuard);
        ReflectionTestUtils.setField(worker, "fromAddress", "security@sapienworx.test");

        worker.send(new OtpDispatchPayload(UUID.randomUUID(), "transaction", OtpPurpose.PASSWORD_RESET,
                OtpChannel.EMAIL, "candidate@example.test", "123456"));

        var captor = org.mockito.ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender).send(captor.capture());
        assertThat(captor.getValue().getSubject()).isEqualTo("Reset your Sapienworx password");
        assertThat(captor.getValue().getText()).contains("123456").contains("expires in 10 minutes");
        assertThat(captor.getValue().getTo()).containsExactly("candidate@example.test");
    }
}
