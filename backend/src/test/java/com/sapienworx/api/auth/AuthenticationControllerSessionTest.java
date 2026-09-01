package com.sapienworx.api.auth;

import com.sapienworx.api.security.AuthenticationCookieService;
import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.security.PlatformRole;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class AuthenticationControllerSessionTest {

    private final AuthenticationController controller = new AuthenticationController(
            mock(AuthenticationService.class),
            mock(AuthenticationCookieService.class),
            mock(AccountSessionService.class),
            mock(PasswordResetService.class)
    );

    @Test
    void anonymousBrowserCannotResolveAPortalRole() {
        var response = controller.currentSession(null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).isNull();
    }

    @Test
    void sessionResponseContainsOnlyThePortalIdentityContract() {
        UUID recruiterId = UUID.randomUUID();

        var response = controller.currentSession(new AuthenticatedUser(recruiterId, PlatformRole.RECRUITER));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(
                new AuthenticationController.CurrentSessionResponse(recruiterId, "RECRUITER")
        );
    }
}
