package com.sapienworx.api.cvparser;

import java.io.IOException;

/** A temporary state: GuardDuty has not completed its malware scan yet. */
public class CvDocumentQuarantinedException extends IOException {
    public CvDocumentQuarantinedException(String message) {
        super(message);
    }
}
